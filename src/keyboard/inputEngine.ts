import type { MachineEmulator } from '../dialects/types';
import type { KeyDef, KeyboardLayout, LayerDef } from './layoutSchema';

export type ModifierState = 'off' | 'held' | 'sticky' | 'locked';

const DEFAULT_MIN_HOLD_FRAMES = 3;

interface ActivePress {
  keyId: string;
  tokens: string[];
  pressedAtFrame: number;
  /** Sticky modifier ids this press consumes (released after its release). */
  consumesModifiers: string[];
  /** Modifier id when this press is on a modifier key. */
  modifierId?: string;
  /** Modifier state when the pointer went down (drives the tap cycle). */
  modifierStateAtDown?: ModifierState;
}

interface PendingRelease {
  tokens: string[];
  releaseAtFrame: number;
  consumesModifiers: string[];
}

/**
 * All virtual-keyboard press logic, independent of the DOM so it is
 * unit-testable. The owning component forwards pointer events in and calls
 * onFrame() once per emulated frame; matrix presses go out through
 * MachineEmulator.setKey.
 *
 * Time is counted in emulated frames, not wall-clock: the emulator's rAF loop
 * pauses when stopped or backgrounded and keys must not release while paused.
 */
export class KeyboardInputEngine {
  private readonly keyById = new Map<string, KeyDef>();
  private readonly minHoldFrames: number;
  private frame = 0;
  private readonly presses = new Map<number, ActivePress>();
  private readonly pendingReleases: PendingRelease[] = [];
  /**
   * Engine-level per-token press counts: several virtual keys may share a
   * token (sticky SHIFT + a '"' key that emits Shift+P); the matrix cell only
   * clears when the last engine press of that token ends.
   */
  private readonly tokenCounts = new Map<string, number>();
  private readonly modifierStates = new Map<string, ModifierState>();
  /** Modifiers in 'held' that had a non-modifier key pressed while held. */
  private readonly usedWhileHeld = new Set<string>();
  /** Notifies the UI that pressed-key / modifier / layer state changed. */
  onChange: (() => void) | null = null;

  constructor(
    private readonly layout: KeyboardLayout,
    private readonly getMachine: () => MachineEmulator | null,
  ) {
    this.minHoldFrames =
      layout.options?.minHoldFrames ?? DEFAULT_MIN_HOLD_FRAMES;
    for (const row of layout.rows)
      for (const k of row) this.keyById.set(k.id, k);
    for (const m of layout.modifiers) this.modifierStates.set(m.id, 'off');
  }

  pointerDown(keyId: string, pointerId: number): void {
    if (this.presses.has(pointerId)) this.pointerUp(pointerId);
    const key = this.keyById.get(keyId);
    if (!key) return;
    if (key.modifier) this.modifierDown(key, pointerId);
    else this.keyDown(key, pointerId);
    this.notify();
  }

  pointerUp(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (!press) return;
    this.presses.delete(pointerId);
    if (press.modifierId) this.modifierUp(press);
    else this.scheduleRelease(press);
    this.notify();
  }

  /**
   * Pointer slid onto a key (or off all keys when keyId is null). Sliding off
   * releases the old key; sliding onto a non-modifier key presses it.
   * Modifier keys don't participate in slides — gaining/losing a modifier
   * mid-drag would be surprising.
   */
  pointerEnter(keyId: string | null, pointerId: number): void {
    const current = this.presses.get(pointerId);
    if (current?.keyId === keyId) return;
    if (current) {
      this.presses.delete(pointerId);
      if (current.modifierId) this.cancelModifierPress(current);
      else this.scheduleRelease(current);
    }
    const key = keyId === null ? undefined : this.keyById.get(keyId);
    if (key && !key.modifier) this.keyDown(key, pointerId);
    this.notify();
  }

  /** Pointer lost (pointercancel): release without modifier tap semantics. */
  cancel(pointerId: number): void {
    const press = this.presses.get(pointerId);
    if (!press) return;
    this.presses.delete(pointerId);
    if (press.modifierId) this.cancelModifierPress(press);
    else this.scheduleRelease(press);
    this.notify();
  }

  /** Release everything everywhere (window blur, stop, machine swap…). */
  cancelAll(): void {
    this.presses.clear();
    this.pendingReleases.length = 0;
    this.tokenCounts.clear();
    for (const id of this.modifierStates.keys())
      this.modifierStates.set(id, 'off');
    this.usedWhileHeld.clear();
    this.getMachine()?.releaseAllKeys();
    this.notify();
  }

  /** Called once per emulated frame; flushes min-hold-deferred releases. */
  onFrame(): void {
    this.frame++;
    if (this.pendingReleases.length === 0) return;
    let changed = false;
    for (let i = this.pendingReleases.length - 1; i >= 0; i--) {
      const pending = this.pendingReleases[i]!;
      if (this.frame >= pending.releaseAtFrame) {
        this.pendingReleases.splice(i, 1);
        this.finishRelease(pending.tokens, pending.consumesModifiers);
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  // ---- UI queries ---------------------------------------------------------

  getModifierState(id: string): ModifierState {
    return this.modifierStates.get(id) ?? 'off';
  }

  getActiveLayer(): LayerDef {
    const active = [...this.modifierStates.entries()]
      .filter(([, s]) => s !== 'off')
      .map(([id]) => id);
    return (
      this.layout.layers.find(
        (l) =>
          l.activeWhen.length === active.length &&
          l.activeWhen.every((id) => active.includes(id)),
      ) ?? this.layout.layers.find((l) => l.activeWhen.length === 0)!
    );
  }

  /** Key ids a pointer currently holds (for visual press feedback). */
  getPressedKeyIds(): Set<string> {
    const ids = new Set<string>();
    for (const press of this.presses.values()) ids.add(press.keyId);
    return ids;
  }

  // ---- internals ----------------------------------------------------------

  private keyDown(key: KeyDef, pointerId: number): void {
    const consumesModifiers: string[] = [];
    for (const [id, state] of this.modifierStates) {
      if (state === 'sticky') consumesModifiers.push(id);
      if (state === 'held') this.usedWhileHeld.add(id);
    }
    for (const token of key.emits) this.pressToken(token);
    this.presses.set(pointerId, {
      keyId: key.id,
      tokens: key.emits,
      pressedAtFrame: this.frame,
      consumesModifiers,
    });
  }

  private modifierDown(key: KeyDef, pointerId: number): void {
    const id = key.modifier!;
    const mod = this.layout.modifiers.find((m) => m.id === id);
    if (!mod) return;
    const state = this.getModifierState(id);
    if (state === 'off') {
      this.modifierStates.set(id, 'held');
      this.usedWhileHeld.delete(id);
      for (const token of mod.emits) this.pressToken(token);
    }
    // sticky/locked: tokens are already down; the tap cycle advances on up.
    this.presses.set(pointerId, {
      keyId: key.id,
      tokens: mod.emits,
      pressedAtFrame: this.frame,
      consumesModifiers: [],
      modifierId: id,
      modifierStateAtDown: state,
    });
  }

  private modifierUp(press: ActivePress): void {
    const id = press.modifierId!;
    const mod = this.layout.modifiers.find((m) => m.id === id);
    if (!mod) return;
    switch (press.modifierStateAtDown) {
      case 'off':
        if (this.usedWhileHeld.has(id) || !mod.sticky) {
          this.setModifierOff(id, mod.emits, press.pressedAtFrame);
        } else {
          this.modifierStates.set(id, 'sticky'); // tokens stay down
        }
        break;
      case 'sticky':
        if (mod.lockable) this.modifierStates.set(id, 'locked');
        else this.setModifierOff(id, mod.emits, press.pressedAtFrame);
        break;
      case 'locked':
      case 'held':
        this.setModifierOff(id, mod.emits, press.pressedAtFrame);
        break;
    }
    this.usedWhileHeld.delete(id);
  }

  /** Abort a modifier press (slide-off / pointercancel): no tap cycle. */
  private cancelModifierPress(press: ActivePress): void {
    const id = press.modifierId!;
    if (this.getModifierState(id) === 'held') {
      const mod = this.layout.modifiers.find((m) => m.id === id);
      this.setModifierOff(id, mod?.emits ?? [], press.pressedAtFrame);
    }
    this.usedWhileHeld.delete(id);
  }

  private setModifierOff(
    id: string,
    tokens: string[],
    pressedAtFrame: number,
  ): void {
    this.modifierStates.set(id, 'off');
    this.scheduleTokenRelease(tokens, pressedAtFrame, []);
  }

  private scheduleRelease(press: ActivePress): void {
    this.scheduleTokenRelease(
      press.tokens,
      press.pressedAtFrame,
      press.consumesModifiers,
    );
  }

  /** Release now if the press is mature, else defer until it is (R2). */
  private scheduleTokenRelease(
    tokens: string[],
    pressedAtFrame: number,
    consumesModifiers: string[],
  ): void {
    const releaseAtFrame = pressedAtFrame + this.minHoldFrames;
    if (this.frame >= releaseAtFrame)
      this.finishRelease(tokens, consumesModifiers);
    else
      this.pendingReleases.push({ tokens, releaseAtFrame, consumesModifiers });
  }

  private finishRelease(tokens: string[], consumesModifiers: string[]): void {
    for (const token of tokens) this.releaseToken(token);
    // Sticky modifiers release only after the consuming key's release has
    // fully completed, so the chord overlaps for the whole hold window.
    for (const id of consumesModifiers) {
      if (this.getModifierState(id) !== 'sticky') continue;
      const mod = this.layout.modifiers.find((m) => m.id === id);
      this.modifierStates.set(id, 'off');
      for (const token of mod?.emits ?? []) this.releaseToken(token);
    }
  }

  private pressToken(token: string): void {
    const count = (this.tokenCounts.get(token) ?? 0) + 1;
    this.tokenCounts.set(token, count);
    if (count === 1) this.getMachine()?.setKey(token, true);
  }

  private releaseToken(token: string): void {
    const count = this.tokenCounts.get(token) ?? 0;
    if (count <= 1) {
      this.tokenCounts.delete(token);
      if (count === 1) this.getMachine()?.setKey(token, false);
    } else {
      this.tokenCounts.set(token, count - 1);
    }
  }

  private notify(): void {
    this.onChange?.();
  }
}
