import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';
import { computeIntegerScale, SCREEN_WIDTH, SCREEN_HEIGHT } from '../app/screenScale';
import type { MachineEmulator } from '../dialects/types';

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

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const machineRef = useRef<MachineEmulator | null>(null);
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

  useEffect(() => () => {
    stopLoop();
    machineRef.current?.dispose();
    machineRef.current = null;
  }, [stopLoop]);

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
      setScale(
        computeIntegerScale(rect.width - 2 * MOBILE_BEZEL, rect.height - 2 * MOBILE_BEZEL),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [isMobile]);

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
      <div className={`screen-shell ${crtEffect ? 'crt' : ''} ${focused ? 'focused' : ''}`}>
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
      <span className={`emulator-state ${emulatorStatus}`}>
        {emulatorStatus === 'running'
          ? focused
            ? 'running — keys go to ZX81 (Esc to release)'
            : 'running — click screen to type'
          : 'stopped'}
      </span>
      {error && <div className="emulator-error">{error}</div>}
    </div>
  );
}
