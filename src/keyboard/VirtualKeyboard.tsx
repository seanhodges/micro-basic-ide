import { useEffect, useMemo, useRef, useState } from 'react';
import type { MachineEmulator } from '../dialects/types';
import type { KeyDef, KeyboardLayout } from './layoutSchema';
import { KeyboardInputEngine } from './inputEngine';

interface VirtualKeyboardProps {
  layout: KeyboardLayout;
  getMachine: () => MachineEmulator | null;
  /** When false the keyboard greys out and ignores input. */
  enabled: boolean;
  /** Lets the emulator's rAF tick drive engine.onFrame(). Must be stable. */
  registerFrameHook: (cb: (() => void) | null) => void;
  sound: boolean;
  haptics: boolean;
}

/** Pointer id used for activation via the physical keyboard (a11y path). */
const KEYBOARD_POINTER_ID = -1;

/** Below this container width there isn't room for every legend at once. */
const COMPACT_MAX_WIDTH = 520;

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
  getMachine,
  enabled,
  registerFrameHook,
  sound,
  haptics,
}: VirtualKeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const getMachineRef = useRef(getMachine);
  getMachineRef.current = getMachine;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const hapticsRef = useRef(haptics);
  hapticsRef.current = haptics;

  // Rebuilt on machine/dialect swap (layout identity changes).
  const engine = useMemo(
    () => new KeyboardInputEngine(layout, () => getMachineRef.current()),
    [layout],
  );
  useEffect(() => () => engine.cancelAll(), [engine]);

  const [, setVersion] = useState(0);
  useEffect(() => {
    engine.onChange = () => setVersion((v) => v + 1);
    return () => {
      engine.onChange = null;
    };
  }, [engine]);

  useEffect(() => {
    registerFrameHook(() => engine.onFrame());
    return () => registerFrameHook(null);
  }, [engine, registerFrameHook]);

  useEffect(() => {
    if (!enabled) engine.cancelAll();
  }, [enabled, engine]);

  // Compact mode: too narrow to render every legend without overlap, so
  // show the base layer plus one selectable secondary layer per key.
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 600,
  );
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setCompact(el.clientWidth < COMPACT_MAX_WIDTH),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const baseLayer = useMemo(
    () =>
      layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0]!,
    [layout],
  );
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
    const cancelAll = () => engine.cancelAll();
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
    // Load-bearing (R4): stops the tap from stealing focus from the canvas,
    // so the physical keyboard keeps working.
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
    engine.pointerDown(keyId, e.pointerId);
    pressFeedback();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!enabled || !activePointers.current.has(e.pointerId)) return;
    engine.pointerEnter(keyIdAt(e.clientX, e.clientY), e.pointerId);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!activePointers.current.delete(e.pointerId)) return;
    engine.pointerUp(e.pointerId);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (!activePointers.current.delete(e.pointerId)) return;
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
  // An engaged modifier temporarily shows its own legends in compact mode.
  const visibleSecondaryId =
    activeLayer.id !== baseLayer.id ? activeLayer.id : legendLayerId;

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
      {compact && secondaryLayers.length > 1 && (
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
            return (
              <div
                key={def.id}
                data-keyid={def.id}
                className={classes.join(' ')}
                style={{ gridColumn: `span ${def.spanX}` }}
                role="button"
                tabIndex={-1}
                aria-label={keyAriaLabel(def, layout, activeLayer.id)}
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
                    if (layer.id === activeLayer.id) cls.push('vk-active');
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
