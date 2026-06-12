import { useEffect, useMemo, useRef, useState } from 'react';
import type { MachineEmulator } from '../dialects/types';
import type {
  EditorKeyAction,
  KeyDef,
  KeyboardLayout,
  LayerDef,
} from './layoutSchema';
import { KeyboardInputEngine } from './inputEngine';
import { isRepeatable, resolveEditorAction } from './editorActions';

/**
 * Where key presses go. Callers must keep the object identity stable
 * (useMemo) or the engine — and its sticky-modifier state — resets.
 */
export type KeyboardTarget =
  | {
      kind: 'machine';
      getMachine(): MachineEmulator | null;
      /** Lets the emulator's rAF tick drive engine.onFrame(). Must be stable. */
      registerFrameHook(cb: (() => void) | null): void;
    }
  | { kind: 'editor'; apply(action: EditorKeyAction): void };

interface VirtualKeyboardProps {
  layout: KeyboardLayout;
  target: KeyboardTarget;
  /** When false the keyboard greys out and ignores input. */
  enabled: boolean;
  sound: boolean;
  haptics: boolean;
}

/** Pointer id used for activation via the physical keyboard (a11y path). */
const KEYBOARD_POINTER_ID = -1;

/** Below this container width there isn't room for every legend at once. */
const COMPACT_MAX_WIDTH = 520;

/** Below this viewport height keys shrink too far for every legend (must
    match the landscape media query in styles.css). */
const COMPACT_MAX_VIEWPORT_HEIGHT = 560;

/** Hold-to-repeat timing for editor actions (backspace, cursor moves). */
const REPEAT_DELAY_MS = 450;
const REPEAT_INTERVAL_MS = 60;

interface RepeatTimer {
  timeout?: ReturnType<typeof setTimeout>;
  interval?: ReturnType<typeof setInterval>;
}

function GlyphSvg({
  glyph,
}: {
  glyph?: { viewBox: string; paths: { d: string; fill?: string }[] };
}) {
  if (!glyph) return null;
  // Constrained path data only — never raw SVG markup (XSS surface for
  // future community layouts).
  return (
    <svg viewBox={glyph.viewBox} aria-hidden="true" focusable="false">
      {glyph.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'currentColor'} />
      ))}
    </svg>
  );
}

function keyAriaLabel(
  def: KeyDef,
  layout: KeyboardLayout,
  activeLayerId: string,
): string {
  const activeIdx = layout.layers.findIndex((l) => l.id === activeLayerId);
  const label =
    def.labels[activeIdx] ?? def.labels.find((l) => l !== null) ?? null;
  return label?.text ?? (label?.glyph ? `graphic ${label.glyph}` : def.id);
}

export function VirtualKeyboard({
  layout,
  target,
  enabled,
  sound,
  haptics,
}: VirtualKeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;

  // Editor-target input mode (the ZX81 K/F/G cursor as a selector bar).
  const editorModes =
    target.kind === 'editor' ? (layout.editorModes ?? []) : [];
  const [modeId, setModeId] = useState<string | null>(null);
  useEffect(() => setModeId(null), [layout]);
  const mode =
    editorModes.find((m) => m.id === modeId) ?? editorModes[0] ?? null;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const baseLayer = useMemo(
    () =>
      layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0]!,
    [layout],
  );
  const baseLayerRef = useRef(baseLayer);
  baseLayerRef.current = baseLayer;

  /** Action resolved by the engine's key-down callback, for repeat setup. */
  const lastActionRef = useRef<EditorKeyAction | null>(null);

  // Rebuilt on machine/dialect swap (layout identity changes). Callbacks go
  // through refs so the engine never holds stale closures.
  const targetKind = target.kind;
  const engine = useMemo(() => {
    if (targetKind === 'machine') {
      return new KeyboardInputEngine(layout, {
        kind: 'machine',
        getMachine: () => {
          const t = targetRef.current;
          return t.kind === 'machine' ? t.getMachine() : null;
        },
      });
    }
    return new KeyboardInputEngine(layout, {
      kind: 'editor',
      onKeyPress: (key: KeyDef, activeLayer: LayerDef) => {
        const m = modeRef.current;
        // In the base (ABC) mode the engine's layer applies (shift works);
        // other modes pin the layer regardless of modifiers.
        const layerId =
          m && m.layer !== baseLayerRef.current.id ? m.layer : activeLayer.id;
        const action = resolveEditorAction(layout, key, layerId);
        lastActionRef.current = action;
        const t = targetRef.current;
        if (action && t.kind === 'editor') t.apply(action);
      },
    });
  }, [layout, targetKind]);
  useEffect(() => () => engine.cancelAll(), [engine]);

  const [, setVersion] = useState(0);
  useEffect(() => {
    engine.onChange = () => setVersion((v) => v + 1);
    return () => {
      engine.onChange = null;
    };
  }, [engine]);

  useEffect(() => {
    if (target.kind !== 'machine') return;
    target.registerFrameHook(() => engine.onFrame());
    return () => target.registerFrameHook(null);
  }, [engine, target]);

  // ---- hold-to-repeat (editor target only) --------------------------------

  const repeatTimers = useRef(new Map<number, RepeatTimer>());
  /** Key currently under each pointer, to detect slides for repeat resets. */
  const pointerKey = useRef(new Map<number, string | null>());

  const stopRepeat = (pointerId: number) => {
    const timer = repeatTimers.current.get(pointerId);
    if (!timer) return;
    if (timer.timeout !== undefined) clearTimeout(timer.timeout);
    if (timer.interval !== undefined) clearInterval(timer.interval);
    repeatTimers.current.delete(pointerId);
  };

  const stopAllRepeats = () => {
    for (const id of [...repeatTimers.current.keys()]) stopRepeat(id);
  };
  const stopAllRepeatsRef = useRef(stopAllRepeats);
  stopAllRepeatsRef.current = stopAllRepeats;

  const startRepeat = (pointerId: number, action: EditorKeyAction) => {
    stopRepeat(pointerId);
    const apply = () => {
      const t = targetRef.current;
      if (t.kind === 'editor') t.apply(action);
    };
    const timeout = setTimeout(() => {
      const interval = setInterval(apply, REPEAT_INTERVAL_MS);
      repeatTimers.current.set(pointerId, { interval });
    }, REPEAT_DELAY_MS);
    repeatTimers.current.set(pointerId, { timeout });
  };

  /** Consume the action captured by the engine callback during a key-down. */
  const takeLastAction = (): EditorKeyAction | null => {
    const action = lastActionRef.current;
    lastActionRef.current = null;
    return action;
  };

  useEffect(() => () => stopAllRepeatsRef.current(), []);

  useEffect(() => {
    if (!enabled) {
      engine.cancelAll();
      stopAllRepeatsRef.current();
    }
  }, [enabled, engine]);

  // Sticky state must not leak across input modes.
  useEffect(() => {
    engine.cancelAll();
    stopAllRepeatsRef.current();
  }, [modeId, engine]);

  // Compact mode: too narrow to render every legend without overlap, so
  // show the base layer plus one selectable secondary layer per key.
  const [compact, setCompact] = useState(
    () =>
      typeof window !== 'undefined' &&
      (window.innerWidth < 600 ||
        window.innerHeight < COMPACT_MAX_VIEWPORT_HEIGHT),
  );
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setCompact(
        el.clientWidth < COMPACT_MAX_WIDTH ||
          window.innerHeight < COMPACT_MAX_VIEWPORT_HEIGHT,
      );
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const secondaryLayers = useMemo(
    () => layout.layers.filter((l) => l !== baseLayer),
    [layout, baseLayer],
  );
  const [legendChoice, setLegendChoice] = useState<string | null>(null);
  useEffect(() => setLegendChoice(null), [layout]);
  const legendLayerId =
    legendChoice ??
    layout.options?.compactDefaultLayer ??
    secondaryLayers[0]?.id;

  // Any path that can lose pointers clears all matrix state (R5).
  useEffect(() => {
    const cancelAll = () => {
      engine.cancelAll();
      stopAllRepeatsRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAll();
    };
    window.addEventListener('blur', cancelAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancelAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [engine]);

  const activePointers = useRef(new Set<number>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    },
    [],
  );

  const pressFeedback = () => {
    if (hapticsRef.current) navigator.vibrate?.(8);
    if (!soundRef.current || typeof AudioContext === 'undefined') return;
    // Created lazily inside a pointerdown so iOS unlocks it.
    audioCtxRef.current ??= new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 1700;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.03);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  };

  const keyIdAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    const keyEl = el?.closest('[data-keyid]');
    if (!keyEl || !containerRef.current?.contains(keyEl)) return null;
    return keyEl.getAttribute('data-keyid');
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Load-bearing (R4): stops the tap from stealing focus from the canvas
    // or the editor, so physical-keyboard input keeps working.
    e.preventDefault();
    if (!enabled) return;
    const keyId = (e.target as Element)
      .closest('[data-keyid]')
      ?.getAttribute('data-keyid');
    if (!keyId) return;
    // Capture on the container: pointermove keeps firing here while we
    // hit-test slides with elementFromPoint.
    containerRef.current?.setPointerCapture(e.pointerId);
    activePointers.current.add(e.pointerId);
    pointerKey.current.set(e.pointerId, keyId);
    engine.pointerDown(keyId, e.pointerId);
    const action = takeLastAction();
    if (action && isRepeatable(action)) startRepeat(e.pointerId, action);
    pressFeedback();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!enabled || !activePointers.current.has(e.pointerId)) return;
    const keyId = keyIdAt(e.clientX, e.clientY);
    const prev = pointerKey.current.get(e.pointerId);
    engine.pointerEnter(keyId, e.pointerId);
    if (keyId !== prev) {
      pointerKey.current.set(e.pointerId, keyId);
      stopRepeat(e.pointerId);
      const action = takeLastAction();
      if (action && isRepeatable(action)) startRepeat(e.pointerId, action);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!activePointers.current.delete(e.pointerId)) return;
    pointerKey.current.delete(e.pointerId);
    stopRepeat(e.pointerId);
    engine.pointerUp(e.pointerId);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (!activePointers.current.delete(e.pointerId)) return;
    pointerKey.current.delete(e.pointerId);
    stopRepeat(e.pointerId);
    engine.cancel(e.pointerId);
  };

  // Roving focus: the whole keyboard is one tab stop; arrows move between
  // keys, Enter/Space presses the focused key.
  const flatKeys = useMemo(() => layout.rows.flat(), [layout]);
  const [focusIdx, setFocusIdx] = useState(0);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      setFocusIdx((i) => (i + dir + flatKeys.length) % flatKeys.length);
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const rowLen = layout.rows[0]?.length ?? 1;
      setFocusIdx(
        (i) => (i + dir * rowLen + flatKeys.length) % flatKeys.length,
      );
      e.preventDefault();
    } else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      const key = flatKeys[focusIdx];
      if (key) {
        engine.pointerDown(key.id, KEYBOARD_POINTER_ID);
        takeLastAction(); // no hold-to-repeat on the a11y path
        pressFeedback();
      }
      e.preventDefault();
    }
  };

  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      engine.pointerUp(KEYBOARD_POINTER_ID);
      e.preventDefault();
    }
  };

  const pressed = engine.getPressedKeyIds();
  const activeLayer = engine.getActiveLayer();
  const focusKeyId = flatKeys[focusIdx]?.id;
  // A non-base editor mode pins the highlighted layer; otherwise an engaged
  // modifier decides it.
  const modeLayerId = mode && mode.layer !== baseLayer.id ? mode.layer : null;
  const highlightLayerId = modeLayerId ?? activeLayer.id;
  // In compact mode the displayed secondary legends follow the same choice.
  // For the editor target in the base mode, show the modifier-driven layer
  // (its legends are the only secondaries reachable without a mode change).
  const modifierLayer = layout.layers.find((l) => l.activeWhen.length > 0);
  const visibleSecondaryId =
    modeLayerId ??
    (activeLayer.id !== baseLayer.id
      ? activeLayer.id
      : target.kind === 'editor'
        ? (modifierLayer?.id ?? legendLayerId)
        : legendLayerId);

  return (
    <div
      ref={containerRef}
      className={`virtual-keyboard ${layout.theme}${enabled ? '' : ' vk-disabled'}${compact ? ' vk-compact' : ''}`}
      role="group"
      aria-label={`${layout.name} on-screen keyboard`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => engine.pointerUp(KEYBOARD_POINTER_ID)}
    >
      {editorModes.length > 0 ? (
        <div
          className="vk-legend-bar vk-mode-bar"
          role="radiogroup"
          aria-label="Input mode"
        >
          {editorModes.map((m) => (
            <button
              key={m.id}
              className={`vk-legend-btn${m.id === mode?.id ? ' active' : ''}`}
              role="radio"
              aria-checked={m.id === mode?.id}
              tabIndex={-1}
              onPointerDown={(e) => {
                e.preventDefault(); // keep editor focus (R4)
                setModeId(m.id);
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      ) : (
        compact &&
        secondaryLayers.length > 1 && (
          <div
            className="vk-legend-bar"
            role="radiogroup"
            aria-label="Key legends shown"
          >
            {secondaryLayers.map((layer) => (
              <button
                key={layer.id}
                className={`vk-legend-btn${layer.id === visibleSecondaryId ? ' active' : ''}`}
                role="radio"
                aria-checked={layer.id === visibleSecondaryId}
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.preventDefault(); // keep canvas focus (R4)
                  setLegendChoice(layer.id);
                }}
              >
                {layer.name ?? layer.id}
              </button>
            ))}
          </div>
        )
      )}
      {layout.rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="vk-row"
          style={{ gridTemplateColumns: `repeat(${layout.gridColumns}, 1fr)` }}
        >
          {row.map((def) => {
            const modState = def.modifier
              ? engine.getModifierState(def.modifier)
              : 'off';
            const classes = ['vk-key'];
            if (pressed.has(def.id)) classes.push('vk-pressed');
            if (modState === 'held' || modState === 'sticky')
              classes.push('vk-mod-engaged');
            if (modState === 'locked') classes.push('vk-mod-locked');
            if (def.style) classes.push(`vk-style-${def.style}`);
            if (def.id === focusKeyId) classes.push('vk-focus');
            if (
              target.kind === 'editor' &&
              !def.modifier &&
              resolveEditorAction(layout, def, highlightLayerId) === null
            )
              classes.push('vk-noaction');
            return (
              <div
                key={def.id}
                data-keyid={def.id}
                className={classes.join(' ')}
                style={{ gridColumn: `span ${def.spanX}` }}
                role="button"
                tabIndex={-1}
                aria-label={keyAriaLabel(def, layout, highlightLayerId)}
                aria-pressed={
                  def.modifier
                    ? modState !== 'off'
                    : pressed.has(def.id) || undefined
                }
              >
                <span className="vk-keycap" aria-hidden="true">
                  {layout.layers.map((layer, layerIdx) => {
                    const label = def.labels[layerIdx];
                    if (!label) return null;
                    if (
                      compact &&
                      layer !== baseLayer &&
                      layer.id !== visibleSecondaryId
                    )
                      return null;
                    const cls = [
                      'vk-label',
                      `vk-pos-${layer.position}`,
                      `vk-layer-${layer.id}`,
                    ];
                    if (layer.id === highlightLayerId) cls.push('vk-active');
                    return (
                      <span key={layer.id} className={cls.join(' ')}>
                        {label.glyph ? (
                          <GlyphSvg glyph={layout.glyphs[label.glyph]} />
                        ) : (
                          label.text
                        )}
                      </span>
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
