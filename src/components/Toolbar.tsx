import { useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { openTextFile, openBinaryFile, saveTextFile } from '../storage/files';
import { dialects } from '../dialects/registry';
import { sampleFiles } from '../samples';

export function Toolbar() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const source = useIdeStore((s) => s.source);
  const dirty = useIdeStore((s) => s.dirty);
  const replaceDocument = useIdeStore((s) => s.replaceDocument);
  const markSaved = useIdeStore((s) => s.markSaved);
  const requestRun = useIdeStore((s) => s.requestRun);
  const requestStop = useIdeStore((s) => s.requestStop);
  const requestReset = useIdeStore((s) => s.requestReset);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const toggleAiPanel = useIdeStore((s) => s.toggleAiPanel);
  const aiPanelOpen = useIdeStore((s) => s.aiPanelOpen);
  const setTransferOpen = useIdeStore((s) => s.setTransferOpen);
  const setSettingsOpen = useIdeStore((s) => s.setSettingsOpen);
  const requestRenumber = useIdeStore((s) => s.requestRenumber);

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const guard = (fn: () => Promise<void> | void) => () => {
    setFileMenuOpen(false);
    setError('');
    Promise.resolve(fn()).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  const confirmDiscard = () =>
    !dirty || window.confirm('Discard unsaved changes?');

  const newFile = guard(() => {
    if (!confirmDiscard()) return;
    replaceDocument('', 'untitled.bas');
  });

  const openFile = guard(async () => {
    if (!confirmDiscard()) return;
    const opened = await openTextFile();
    if (opened) replaceDocument(opened.text, opened.name);
  });

  const importP = guard(async () => {
    if (!confirmDiscard()) return;
    const opened = await openBinaryFile('.p');
    if (!opened) return;
    const text = dialect.detokenize(opened.bytes);
    replaceDocument(text, opened.name.replace(/\.p$/i, '.bas'));
  });

  const saveFile = guard(async () => {
    const saved = await saveTextFile(fileName, source);
    if (saved !== null) markSaved(saved);
  });

  const loadSample = (name: string, text: string) =>
    guard(() => {
      if (!confirmDiscard()) return;
      replaceDocument(text, name);
    })();

  const openShare = guard(() => setTransferOpen(true));

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="menu" ref={menuRef}>
          <button onClick={() => setFileMenuOpen((o) => !o)}>File ▾</button>
          {fileMenuOpen && (
            <div
              className="menu-items"
              onMouseLeave={() => setFileMenuOpen(false)}
            >
              <button onClick={newFile}>New</button>
              <button onClick={openFile}>Open .bas…</button>
              <button onClick={importP}>Import .P…</button>
              <button onClick={saveFile}>Save .bas</button>
              <button onClick={openShare}>Share / Export…</button>
              <div className="menu-separator" />
              <button
                onClick={guard(requestRenumber)}
                title="Renumber the current line and update GOTO/GOSUB references (Ctrl/Cmd+Alt+R)"
              >
                # Renumber line
              </button>
              <div className="menu-separator" />
              <div className="menu-label">Samples</div>
              {sampleFiles.map((s) => (
                <button key={s.name} onClick={() => loadSample(s.name, s.text)}>
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="desktop-only" onClick={newFile} title="New program">
          New
        </button>
        <button
          className="desktop-only"
          onClick={openFile}
          title="Open a .bas file"
        >
          Load
        </button>
        <button
          className="desktop-only"
          onClick={saveFile}
          title="Save as .bas"
        >
          Save
        </button>
        <button
          className="desktop-only"
          onClick={openShare}
          title="Export or send to real hardware"
        >
          Share
        </button>
      </div>

      <div className="toolbar-center">
        <select
          className="dialect-select"
          value={dialect.id}
          onChange={() => {
            /* single dialect for now */
          }}
          title="Target machine"
        >
          {dialects.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-right">
        {error && <span className="toolbar-error">{error}</span>}
        <button
          className="run"
          onClick={requestRun}
          title="Build and run in the emulator (Ctrl+Enter)"
        >
          ▶ Run
        </button>
        <button
          onClick={requestStop}
          disabled={emulatorStatus === 'stopped'}
          title="Stop / break the running program"
        >
          ■ Stop
        </button>
        <button onClick={requestReset} title="Reset the machine">
          ↺ Reset
        </button>
        <button
          className={`icon-btn ${aiPanelOpen ? 'active' : ''}`}
          onClick={toggleAiPanel}
          title="AI code generation"
        >
          ✦
        </button>
        <button
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
