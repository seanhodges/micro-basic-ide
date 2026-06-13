import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useIdeStore } from '../app/store';
import { useMediaQuery, HAS_TOUCH, MOBILE_QUERY } from '../app/useMediaQuery';
import {
  computeIntegerScale,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
} from '../app/screenScale';
import type { MachineEmulator } from '../dialects/types';
import { VariableWatcher } from './VariableWatcher';

const romCache = new Map<string, Promise<Uint8Array>>();

/** The machine handle the virtual-keyboard overlay needs to send keys. */
export interface MachineApi {
  getMachine: () => MachineEmulator | null;
  registerFrameHook: (cb: (() => void) | null) => void;
}

interface EmulatorPaneProps {
  /**
   * The keyboard lives outside this pane (the workspace overlay), so the parent
   * passes a ref that we populate so the shared keyboard can drive the
   * emulator. Assigned synchronously during render (see below).
   */
  apiRef?: MutableRefObject<MachineApi | null>;
}

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

export function EmulatorPane({ apiRef }: EmulatorPaneProps = {}) {
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
  const variableWatcher = useIdeStore((s) => s.variableWatcher);
  const setVariableWatcher = useIdeStore((s) => s.setVariableWatcher);

  const display = dialect.displaySize ?? {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  };
  // Classic small displays render at 2× on desktop; large framebuffers at 1×.
  const desktopCssWidth = display.width * (display.width <= 480 ? 2 : 1);

  const containerRef = useRef<HTMLDivElement>(null);
  const watcherHostRef = useRef<HTMLDivElement>(null);
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
      setVariableWatcher(false); // running hides the watcher (back to the screen)
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

  // Switching target machine: dispose the old emulator so the next run builds a
  // fresh one with the new dialect's ROM. The editor and virtual keyboard
  // re-render from the new dialect on their own.
  useEffect(() => {
    stopLoop();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    setError('');
  }, [dialect, stopLoop]);

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

  // The on-screen keyboard and the variable watcher share the slot below the
  // screen; opening the keyboard closes the watcher.
  useEffect(() => {
    if (virtualKeyboard) setVariableWatcher(false);
  }, [virtualKeyboard, setVariableWatcher]);

  // Fit-to-pane scaling. When the keyboard overlay is up it caps the screen to
  // the top 60% (the keyboard owns the bottom 40%) and scales fractionally; on
  // mobile without the keyboard it's integer-perfect. Fires on rotation,
  // address-bar collapse, and when the Preview tab becomes visible again.
  useEffect(() => {
    if (!isMobile && !virtualKeyboard) return;
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      // The watcher (if open) shares the pane below the screen.
      const panelHeight = watcherHostRef.current?.offsetHeight ?? 0;
      const availWidth = rect.width - 2 * MOBILE_BEZEL;
      // With the keyboard up, never grow past 60% of the pane so the bottom-40%
      // overlay can never cover the screen.
      const heightBudget = virtualKeyboard
        ? Math.min(rect.height, rect.height * 0.6)
        : rect.height;
      const availHeight =
        heightBudget -
        2 * MOBILE_BEZEL -
        (panelHeight > 0 ? panelHeight + 10 : 0);
      let next: number;
      if (virtualKeyboard) {
        // Fractional scale: fill the available 60% region, retaining aspect.
        next =
          availWidth > 0 && availHeight > 0
            ? Math.min(availWidth / display.width, availHeight / display.height)
            : 1;
      } else {
        next = computeIntegerScale(
          availWidth,
          availHeight,
          display.width,
          display.height,
        );
        // Displays too large for even 1× (e.g. the BBC's 896×600) shrink
        // fractionally instead of overflowing the pane.
        if (display.width * next > availWidth && availWidth > 0) {
          next = Math.min(
            availWidth / display.width,
            availHeight / display.height,
          );
        }
      }
      setScale(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (watcherHostRef.current) observer.observe(watcherHostRef.current);
    return () => observer.disconnect();
  }, [
    isMobile,
    virtualKeyboard,
    variableWatcher,
    display.width,
    display.height,
  ]);

  const getMachine = useCallback(() => machineRef.current, []);
  const registerFrameHook = useCallback((cb: (() => void) | null) => {
    frameHookRef.current = cb;
  }, []);

  // Publish the machine handle to a parent-owned ref so the overlay keyboard
  // (rendered outside this pane) can drive the emulator. Assigned during render
  // — not in an effect — so it's populated before the keyboard's frame-hook
  // effect runs; otherwise frame-counted key releases would never fire.
  if (apiRef) apiRef.current = { getMachine, registerFrameHook };
  useEffect(() => {
    if (!apiRef) return;
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

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
    <div
      className={`emulator-pane ${virtualKeyboard ? 'overlay' : ''}`}
      ref={containerRef}
    >
      <div
        className={`screen-shell ${crtEffect ? 'crt' : ''} ${focused ? 'focused' : ''}`}
      >
        <canvas
          ref={canvasRef}
          width={display.width}
          height={display.height}
          className="emulator-screen"
          style={
            isMobile || virtualKeyboard
              ? {
                  width: display.width * scale,
                  height: display.height * scale,
                }
              : { width: desktopCssWidth }
          }
          tabIndex={0}
          onKeyDown={(e) => handleKey(e, true)}
          onKeyUp={(e) => handleKey(e, false)}
          onFocus={() => {
            setFocused(true);
            // On touch, tapping the screen re-opens the keyboard if hidden.
            if (HAS_TOUCH && !useIdeStore.getState().virtualKeyboard)
              setVirtualKeyboard(true);
          }}
          onBlur={() => setFocused(false)}
        />
      </div>
      <div className="emulator-status-row">
        <span className={`emulator-state ${emulatorStatus}`}>
          {emulatorStatus === 'running'
            ? focused
              ? `running — keys go to ${dialect.name} (Esc to release)`
              : virtualKeyboard
                ? 'running — tap the keys below'
                : 'running — click screen to type'
            : 'stopped'}
        </span>
      </div>
      {error && <div className="emulator-error">{error}</div>}
      {variableWatcher && !virtualKeyboard && (
        <div className="watcher-host" ref={watcherHostRef}>
          <VariableWatcher
            getMachine={getMachine}
            running={emulatorStatus === 'running'}
          />
        </div>
      )}
    </div>
  );
}
