import { useIdeStore } from '../app/store';
import { useProgramStats } from '../app/useProgramStats';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';

export function StatusBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const dirty = useIdeStore((s) => s.dirty);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const virtualKeyboard = useIdeStore((s) => s.virtualKeyboard);
  const setVirtualKeyboard = useIdeStore((s) => s.setVirtualKeyboard);
  const variableWatcher = useIdeStore((s) => s.variableWatcher);
  const setVariableWatcher = useIdeStore((s) => s.setVariableWatcher);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const stats = useProgramStats();

  const ramBudget = 16 * 1024 - 4 * 1024; // rough usable space in 16K
  const pct = Math.min(100, Math.round((stats.bytes / ramBudget) * 100));

  return (
    <div className={`status-bar ${isMobile ? 'slim' : ''}`}>
      {/* The verbose stats are dropped on narrow screens to keep the bar slim;
          the keyboard/watcher toggles always show (they have no other home on
          mobile, where the status bar replaces the per-pane toggles). */}
      {!isMobile && (
        <>
          <span>
            {fileName}
            {dirty ? ' •' : ''}
          </span>
          <span>{dialect.name}</span>
          <span title="Tokenized program size">
            {stats.bytes.toLocaleString()} bytes ({pct}% of 16K budget)
          </span>
          <span className={stats.errors > 0 ? 'status-errors' : ''}>
            {stats.errors === 0
              ? 'no errors'
              : `${stats.errors} error${stats.errors > 1 ? 's' : ''}`}
          </span>
        </>
      )}
      <span className={`status-emu ${emulatorStatus}`}>
        emulator: {emulatorStatus}
      </span>
      <div className="status-toggles">
        <button
          className={`vk-toggle watcher-toggle ${variableWatcher ? 'active' : ''}`}
          aria-pressed={variableWatcher}
          title={
            variableWatcher ? 'Hide variable watcher' : 'Show variable watcher'
          }
          onClick={() => {
            const next = !variableWatcher;
            setVariableWatcher(next);
            if (next) setVirtualKeyboard(false); // mutually exclusive
          }}
        >
          {'{x}'}
        </button>
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
    </div>
  );
}
