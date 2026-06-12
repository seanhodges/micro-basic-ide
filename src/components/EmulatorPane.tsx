import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';
import {
  computeIntegerScale,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from '../app/screenScale';
import type { MachineEmulator } from '../dialects/types';
import { VirtualKeyboard } from '../keyboard/VirtualKeyboard';

const romCache = new Map<string, Promise<Uint8Array>>();

/** Bezel width of .screen-shell in the mobile media query. */
const MOBILE_BEZEL = 8;

function fetchRom(url: string): Promise<Uint8Array> {
  let cached = romCache.get(url);
  if (!cached) {
    cached = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Failed to fetch ROM (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    });
    romCache.set(url, cached);
  }
  return cached;
}

export function EmulatorPane() {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const runRequest = useIdeStore((s) => s.runRequest);
  const stopRequest = useIdeStore((s) => s.stopRequest);
  const resetRequest = useIdeStore((s) => s.resetRequest);
  const speed = useIdeStore((s) => s.emulatorSpeed);
  const crtEffect = useIdeStore((s) => s.crtEffect);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const setEmulatorStatus = useIdeStore((s) => s.setEmulatorStatus);
  const virtualKeyboard = useIdeStore((s) => s.virtualKeyboard);
  const setVirtualKeyboard = useIdeStore((s) => s.setVirtualKeyboard);
  const keyboardSound = useIdeStore((s) => s.keyboardSound);
  const keyboardHaptics = useIdeStore((s) => s.keyboardHaptics);

  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const machineRef = useRef<MachineEmulator | null>(null);
  const frameHookRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [scale, setScale] = useState(1);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const machine = machineRef.current;
      const canvas = canvasRef.current;
      if (machine && canvas) {
        machine.runFrame();
        frameHookRef.current?.(); // virtual-keyboard frame-counted releases
        const ctx = canvas.getContext('2d');
        if (ctx) machine.renderTo(ctx);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const ensureMachine = useCallback(async (): Promise<MachineEmulator> => {
    if (machineRef.current) return machineRef.current;
    const rom = await fetchRom(dialect.romUrl);
    const machine = dialect.createEmulator({ rom, ramKb: 16 });
    machineRef.current = machine;
    return machine;
  }, [dialect]);

  // Run requests from the toolbar
  useEffect(() => {
    if (runRequest === 0) return;
    let cancelled = false;
    (async () => {
      setError('');
      try {
        const result = dialect.tokenize(source);
        if (result.errors.length > 0) {
          setError(`Fix ${result.errors.length} error(s) before running`);
          return;
        }
        if (result.image.length === 0) {
          setError('Program is empty');
          return;
        }
        const machine = await ensureMachine();
        if (cancelled) return;
        stopLoop();
        machine.loadProgram(result.image); // includes boot, may take ~200ms
        machine.setSpeed(speed);
        setEmulatorStatus('running');
        startLoop();
        canvasRef.current?.focus();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRequest]);

  // Stop requests from the toolbar
  useEffect(() => {
    if (stopRequest === 0) return;
    stopLoop();
    machineRef.current?.releaseAllKeys(); // nothing stays held while paused
    setEmulatorStatus('stopped');
  }, [stopRequest, stopLoop, setEmulatorStatus]);

  // Reset requests from the toolbar
  useEffect(() => {
    if (resetRequest === 0) return;
    let cancelled = false;
    (async () => {
      setError('');
      try {
        const machine = await ensureMachine();
        if (cancelled) return;
        machine.releaseAllKeys();
        machine.reset();
        setEmulatorStatus('running');
        startLoop();
        canvasRef.current?.focus();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetRequest]);

  useEffect(
    () => () => {
      stopLoop();
      machineRef.current?.releaseAllKeys();
      machineRef.current?.dispose();
      machineRef.current = null;
    },
    [stopLoop],
  );

  // Backgrounding pauses the rAF loop; clear the matrix so no key stays held.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden')
        machineRef.current?.releaseAllKeys();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    machineRef.current?.setSpeed(speed);
  }, [speed]);

  // Integer-perfect scaling on mobile: fires on rotation, address-bar
  // collapse, and when the Preview tab becomes visible again.
  useEffect(() => {
    if (!isMobile) return;
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      // The virtual keyboard shares the pane; the screen gets what's left.
      const kbHeight = keyboardHostRef.current?.offsetHeight ?? 0;
      setScale(
        computeIntegerScale(
          rect.width - 2 * MOBILE_BEZEL,
          rect.height - 2 * MOBILE_BEZEL - (kbHeight > 0 ? kbHeight + 10 : 0),
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (keyboardHostRef.current) observer.observe(keyboardHostRef.current);
    return () => observer.disconnect();
  }, [isMobile, virtualKeyboard]);

  const getMachine = useCallback(() => machineRef.current, []);
  const registerFrameHook = useCallback((cb: (() => void) | null) => {
    frameHookRef.current = cb;
  }, []);
  const keyboardTarget = useMemo(
    () => ({ kind: 'machine' as const, getMachine, registerFrameHook }),
    [getMachine, registerFrameHook],
  );

  const handleKey = (e: React.KeyboardEvent, down: boolean) => {
    if (e.key === 'Escape') {
      canvasRef.current?.blur();
      return;
    }
    const machine = machineRef.current;
    if (machine && machine.keyEvent(e.nativeEvent, down)) {
      e.preventDefault();
    }
  };

  return (
    <div className="emulator-pane" ref={containerRef}>
      <div
        className={`screen-shell ${crtEffect ? 'crt' : ''} ${focused ? 'focused' : ''}`}
      >
        <canvas
          ref={canvasRef}
          width={SCREEN_WIDTH}
          height={SCREEN_HEIGHT}
          className="emulator-screen"
          style={
            isMobile
              ? { width: SCREEN_WIDTH * scale, height: SCREEN_HEIGHT * scale }
              : undefined
          }
          tabIndex={0}
          onKeyDown={(e) => handleKey(e, true)}
          onKeyUp={(e) => handleKey(e, false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      <div className="emulator-status-row">
        <span className={`emulator-state ${emulatorStatus}`}>
          {emulatorStatus === 'running'
            ? focused
              ? 'running — keys go to ZX81 (Esc to release)'
              : virtualKeyboard
                ? 'running — tap the keys below'
                : 'running — click screen to type'
            : 'stopped'}
        </span>
        <button
          className={`vk-toggle ${virtualKeyboard ? 'active' : ''}`}
          aria-pressed={virtualKeyboard}
          title={
            virtualKeyboard
              ? 'Hide on-screen keyboard'
              : 'Show on-screen keyboard'
          }
          onClick={() => setVirtualKeyboard(!virtualKeyboard)}
        >
          ⌨
        </button>
      </div>
      {error && <div className="emulator-error">{error}</div>}
      {virtualKeyboard && (
        <div className="vk-host" ref={keyboardHostRef}>
          <VirtualKeyboard
            layout={dialect.keyboardLayout}
            target={keyboardTarget}
            enabled={emulatorStatus === 'running'}
            sound={keyboardSound}
            haptics={keyboardHaptics}
          />
        </div>
      )}
    </div>
  );
}
