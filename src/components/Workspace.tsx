import { useEffect, useMemo, useRef, useState } from 'react';
import { useIdeStore, type MobileTab } from '../app/store';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';
import { useProgramStats } from '../app/useProgramStats';
import {
  setSplitRatio as persistSplitRatio,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
} from '../storage/settings';
import type { EditorKeyAction } from '../keyboard/layoutSchema';
import {
  VirtualKeyboard,
  type KeyboardTarget,
} from '../keyboard/VirtualKeyboard';
import { CodeMirrorHost } from './CodeMirrorHost';
import { EmulatorPane } from './EmulatorPane';
import { AiPanel } from './AiPanel';
import { SettingsForm } from './SettingsForm';
import { MobileTabBar } from './MobileTabBar';

const AI_PANEL_WIDTH = 340;
const DIVIDER_WIDTH = 6;

/** How long the editor keyboard lingers after the editor loses focus —
    avoids flicker when focus briefly moves (toolbar taps, prompts). */
const EDITOR_KB_HIDE_DELAY_MS = 250;

/** True immediately when `value` is true; false only after a short delay. */
function useDebouncedFalse(value: boolean, delayMs: number): boolean {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (value) {
      setDebounced(true);
      return;
    }
    const timer = setTimeout(() => setDebounced(false), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function ProgramStats() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const dirty = useIdeStore((s) => s.dirty);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const stats = useProgramStats();

  const ramBudget = 16 * 1024 - 4 * 1024; // rough usable space in 16K
  const pct = Math.min(100, Math.round((stats.bytes / ramBudget) * 100));

  return (
    <div className="program-stats">
      <h3>Program</h3>
      <p>
        {fileName}
        {dirty ? ' •' : ''} — {dialect.name}
      </p>
      <p title="Tokenized program size">
        {stats.bytes.toLocaleString()} bytes ({pct}% of 16K budget)
      </p>
      <p className={stats.errors > 0 ? 'status-errors' : ''}>
        {stats.errors === 0
          ? 'no errors'
          : `${stats.errors} error${stats.errors > 1 ? 's' : ''}`}
      </p>
      <p className={`status-emu ${emulatorStatus}`}>
        emulator: {emulatorStatus}
      </p>
    </div>
  );
}

export function Workspace() {
  const dialect = useIdeStore((s) => s.dialect);
  const docOverride = useIdeStore((s) => s.docOverride);
  const setSource = useIdeStore((s) => s.setSource);
  const aiPanelOpen = useIdeStore((s) => s.aiPanelOpen);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const splitRatio = useIdeStore((s) => s.splitRatio);
  const setSplitRatio = useIdeStore((s) => s.setSplitRatio);
  const requestRun = useIdeStore((s) => s.requestRun);

  const virtualKeyboard = useIdeStore((s) => s.virtualKeyboard);
  const editorFocused = useIdeStore((s) => s.editorFocused);
  const keyboardSound = useIdeStore((s) => s.keyboardSound);
  const keyboardHaptics = useIdeStore((s) => s.keyboardHaptics);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // The virtual keyboard types into the editor through this handle; presses
  // preventDefault so the editor never loses focus while typing.
  const editorInputRef = useRef<((action: EditorKeyAction) => void) | null>(
    null,
  );
  const editorTarget = useMemo<KeyboardTarget>(
    () => ({
      kind: 'editor',
      apply: (action) => editorInputRef.current?.(action),
    }),
    [],
  );
  const showEditorKeyboard = useDebouncedFalse(
    editorFocused,
    EDITOR_KB_HIDE_DELAY_MS,
  );

  const hidden = (tab: MobileTab) =>
    isMobile && mobileTab !== tab ? 'tab-hidden' : '';

  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDividerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const width = rect.width - (aiPanelOpen ? AI_PANEL_WIDTH : 0);
    if (width <= 0) return;
    const ratio = (e.clientX - rect.left) / width;
    setSplitRatio(Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio)));
  };

  const onDividerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    persistSplitRatio(useIdeStore.getState().splitRatio);
  };

  const cols = isMobile
    ? undefined
    : `${(splitRatio * 100).toFixed(2)}% ${DIVIDER_WIDTH}px 1fr${
        aiPanelOpen ? ` ${AI_PANEL_WIDTH}px` : ''
      }`;

  return (
    <div
      className={`workspace ${isMobile ? 'mobile' : ''} ${dragging ? 'dragging' : ''}`}
      ref={workspaceRef}
      style={cols ? { gridTemplateColumns: cols } : undefined}
    >
      <div className={`editor-pane ${hidden('editor')}`}>
        {/* The FAB anchors to this box so the docked keyboard below never
            sits underneath it. */}
        <div className="editor-main">
          <CodeMirrorHost
            dialect={dialect}
            override={docOverride}
            onChange={setSource}
            inputRef={editorInputRef}
          />
          {isMobile && mobileTab === 'editor' && (
            <button
              className="fab-run"
              onClick={requestRun}
              title="Build and run in the emulator"
            >
              ▶
            </button>
          )}
        </div>
        {virtualKeyboard && showEditorKeyboard && (
          <div className="editor-vk-host">
            <VirtualKeyboard
              layout={dialect.keyboardLayout}
              target={editorTarget}
              enabled
              sound={keyboardSound}
              haptics={keyboardHaptics}
            />
          </div>
        )}
      </div>
      <div
        className="divider"
        onPointerDown={onDividerDown}
        onPointerMove={onDividerMove}
        onPointerUp={onDividerUp}
      />
      <div className={`monitor-pane ${hidden('preview')}`}>
        <EmulatorPane />
      </div>
      {isMobile && (
        <div className={`settings-pane ${hidden('settings')}`}>
          <SettingsForm />
          <ProgramStats />
        </div>
      )}
      {(aiPanelOpen || isMobile) && (
        <div className={`ai-host ${isMobile ? hidden('ai') : ''}`}>
          <AiPanel />
        </div>
      )}
      {isMobile && <MobileTabBar />}
    </div>
  );
}
