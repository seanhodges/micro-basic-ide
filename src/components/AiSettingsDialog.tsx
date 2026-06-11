import { useState } from 'react';
import { useIdeStore } from '../app/store';
import { getApiKey, setApiKey } from '../storage/settings';

export function AiSettingsDialog() {
  const open = useIdeStore((s) => s.settingsOpen);
  const setOpen = useIdeStore((s) => s.setSettingsOpen);
  const autoLineNumbering = useIdeStore((s) => s.autoLineNumbering);
  const lineNumberIncrement = useIdeStore((s) => s.lineNumberIncrement);
  const setAutoLineNumbering = useIdeStore((s) => s.setAutoLineNumbering);
  const setLineNumberIncrement = useIdeStore((s) => s.setLineNumberIncrement);
  const [key, setKey] = useState(getApiKey());

  if (!open) return null;

  const save = () => {
    setApiKey(key.trim());
    setOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <h3>Editor</h3>
        <label className="inline">
          <input
            type="checkbox"
            checked={autoLineNumbering}
            onChange={(e) => setAutoLineNumbering(e.target.checked)}
          />
          Automatic line numbering
        </label>
        <label>
          Line number increment
          <input
            type="number"
            min={1}
            max={1000}
            value={lineNumberIncrement}
            disabled={!autoLineNumbering}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setLineNumberIncrement(Number.isFinite(n) && n >= 1 ? n : 10);
            }}
          />
        </label>
        <h3>AI</h3>
        <p>
          Code generation calls the Claude API directly from your browser.
          Create an API key at{' '}
          <a href="https://platform.claude.com/" target="_blank" rel="noreferrer">
            platform.claude.com
          </a>
          .
        </p>
        <label>
          Anthropic API key
          <input
            type="password"
            value={key}
            placeholder="sk-ant-…"
            onChange={(e) => setKey(e.target.value)}
            autoFocus
          />
        </label>
        <p className="modal-warning">
          The key is stored only in this browser&apos;s localStorage and sent only to
          api.anthropic.com. Don&apos;t use this on a shared computer.
        </p>
        <div className="modal-actions">
          <button onClick={() => setOpen(false)}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
