import { useState } from 'react';
import { useIdeStore } from '../app/store';
import { getApiKey, setApiKey } from '../storage/settings';

export function SettingsForm() {
  const autoLineNumbering = useIdeStore((s) => s.autoLineNumbering);
  const lineNumberIncrement = useIdeStore((s) => s.lineNumberIncrement);
  const setAutoLineNumbering = useIdeStore((s) => s.setAutoLineNumbering);
  const setLineNumberIncrement = useIdeStore((s) => s.setLineNumberIncrement);
  const crtEffect = useIdeStore((s) => s.crtEffect);
  const setCrtEffect = useIdeStore((s) => s.setCrtEffect);
  const emulatorSpeed = useIdeStore((s) => s.emulatorSpeed);
  const setEmulatorSpeed = useIdeStore((s) => s.setEmulatorSpeed);
  const [key, setKey] = useState(getApiKey());
  const [keySaved, setKeySaved] = useState(false);

  const saveKey = () => {
    setApiKey(key.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  return (
    <div className="settings-form">
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
      <h3>Monitor</h3>
      <label className="inline">
        <input
          type="checkbox"
          checked={crtEffect}
          onChange={(e) => setCrtEffect(e.target.checked)}
        />
        CRT scanline effect
      </label>
      <label className="inline">
        Emulation speed
        <select
          value={emulatorSpeed}
          onChange={(e) => setEmulatorSpeed(Number(e.target.value))}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={8}>8×</option>
        </select>
      </label>
      <h3>AI</h3>
      <p>
        Code generation calls the Claude API directly from your browser. Create
        an API key at{' '}
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
        />
      </label>
      <p className="modal-warning">
        The key is stored only in this browser&apos;s localStorage and sent only
        to api.anthropic.com. Don&apos;t use this on a shared computer.
      </p>
      <div className="modal-actions left">
        <button className="primary" onClick={saveKey}>
          Save API key
        </button>
        {keySaved && <span className="settings-saved">Saved ✓</span>}
      </div>
    </div>
  );
}
