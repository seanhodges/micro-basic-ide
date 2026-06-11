import { useIdeStore } from '../app/store';
import { SettingsForm } from './SettingsForm';

export function AiSettingsDialog() {
  const open = useIdeStore((s) => s.settingsOpen);
  const setOpen = useIdeStore((s) => s.setSettingsOpen);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <SettingsForm />
        <div className="modal-actions">
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
