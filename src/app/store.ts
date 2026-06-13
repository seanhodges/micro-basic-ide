import { create } from 'zustand';
import { getDialect, dialects } from '../dialects/registry';
import type { Dialect } from '../dialects/types';
import {
  loadAutosave,
  getDialectId,
  setDialectId as persistDialectId,
  getAutoLineNumbering,
  getLineNumberIncrement,
  getShowLineNumberGutter,
  getCrtEffect,
  getSplitRatio,
  getEmulatorSpeed,
  getVirtualKeyboard,
  getKeyboardSound,
  getKeyboardHaptics,
  setAutoLineNumbering as persistAutoLineNumbering,
  setLineNumberIncrement as persistLineNumberIncrement,
  setShowLineNumberGutter as persistShowLineNumberGutter,
  setCrtEffect as persistCrtEffect,
  setEmulatorSpeed as persistEmulatorSpeed,
  setVirtualKeyboard as persistVirtualKeyboard,
  setKeyboardSound as persistKeyboardSound,
  setKeyboardHaptics as persistKeyboardHaptics,
} from '../storage/settings';
import { MOBILE_QUERY, isMobileViewport } from './useMediaQuery';

export type EmulatorStatus = 'stopped' | 'running';
export type MobileTab = 'editor' | 'preview' | 'settings' | 'ai';

interface IdeState {
  /** Active target machine. Switching it rebuilds the editor, emulator and keyboard. */
  dialect: Dialect;
  fileName: string;
  /** Mirror of the editor document (editor itself is the source of truth). */
  source: string;
  /** Bump seq to push text INTO the editor (file load, AI apply). */
  docOverride: { text: string; seq: number };
  dirty: boolean;
  emulatorStatus: EmulatorStatus;
  /** Bumped to ask the emulator pane to (re)load + run the current source. */
  runRequest: number;
  /** Bumped to ask the emulator pane to stop. */
  stopRequest: number;
  /** Bumped to ask the emulator pane to reset the machine. */
  resetRequest: number;
  /** Emulation speed multiplier (1, 2 or 8). */
  emulatorSpeed: number;
  /** CRT scanline overlay on the monitor. */
  crtEffect: boolean;
  /** On-screen virtual keyboard under the monitor. */
  virtualKeyboard: boolean;
  /**
   * Variable watcher panel under the monitor (shares the slot with the virtual
   * keyboard). Transient: not persisted, always starts closed.
   */
  variableWatcher: boolean;
  /** Audible click on virtual key presses. */
  keyboardSound: boolean;
  /** Haptic buzz on virtual key presses (where supported). */
  keyboardHaptics: boolean;
  /** Whether the code editor currently has focus (drives its keyboard). */
  editorFocused: boolean;
  /** Active tab in the mobile (portrait) layout. */
  mobileTab: MobileTab;
  /** Editor/monitor split position on desktop (fraction of workspace width). */
  splitRatio: number;
  aiPanelOpen: boolean;
  transferOpen: boolean;
  settingsOpen: boolean;
  /** Automatic line-number prefixing on Enter. */
  autoLineNumbering: boolean;
  /** Step between auto-generated line numbers. */
  lineNumberIncrement: number;
  /** Whether the CodeMirror line number gutter is visible. */
  showLineNumberGutter: boolean;
  /** Bumped to ask the editor to renumber the current line. */
  renumberRequest: number;

  setDialect(id: string): void;
  setSource(text: string): void;
  replaceDocument(text: string, fileName?: string): void;
  markSaved(fileName: string): void;
  requestRun(): void;
  requestStop(): void;
  requestReset(): void;
  setEmulatorSpeed(n: number): void;
  setCrtEffect(on: boolean): void;
  setVirtualKeyboard(on: boolean): void;
  setVariableWatcher(on: boolean): void;
  setKeyboardSound(on: boolean): void;
  setKeyboardHaptics(on: boolean): void;
  setEditorFocused(on: boolean): void;
  setMobileTab(tab: MobileTab): void;
  setSplitRatio(n: number): void;
  setEmulatorStatus(status: EmulatorStatus): void;
  toggleAiPanel(): void;
  setTransferOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setAutoLineNumbering(on: boolean): void;
  setLineNumberIncrement(n: number): void;
  setShowLineNumberGutter(on: boolean): void;
  requestRenumber(): void;
}

const autosaved = typeof localStorage !== 'undefined' ? loadAutosave() : null;

/** The persisted dialect if it still exists in the registry, else the first one. */
function initialDialect(): Dialect {
  const savedId = typeof localStorage !== 'undefined' ? getDialectId() : null;
  if (savedId && dialects.some((d) => d.id === savedId)) {
    return getDialect(savedId);
  }
  return dialects[0]!;
}

/** Default the virtual keyboard to shown on touch/small-screen devices. */
function defaultVirtualKeyboard(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.(MOBILE_QUERY).matches || navigator.maxTouchPoints > 0
  );
}

/**
 * True when the document is "untouched" — blank, or exactly one dialect's
 * starter program. Only such a document is swapped for the new starter when
 * the target machine changes; anything the user wrote or loaded is left alone.
 */
function isStarterOrEmpty(source: string): boolean {
  return (
    source.trim() === '' || dialects.some((d) => d.samples[0]?.text === source)
  );
}

const startupDialect = initialDialect();
const startupText = autosaved?.text ?? startupDialect.samples[0]?.text ?? '';

export const useIdeStore = create<IdeState>((set) => ({
  dialect: startupDialect,
  fileName: autosaved?.name ?? 'untitled.bas',
  source: startupText,
  docOverride: { text: startupText, seq: 0 },
  dirty: false,
  emulatorStatus: 'stopped',
  runRequest: 0,
  stopRequest: 0,
  resetRequest: 0,
  emulatorSpeed: typeof localStorage !== 'undefined' ? getEmulatorSpeed() : 1,
  crtEffect: typeof localStorage !== 'undefined' ? getCrtEffect() : true,
  virtualKeyboard:
    typeof localStorage !== 'undefined'
      ? (getVirtualKeyboard() ?? defaultVirtualKeyboard())
      : false,
  variableWatcher: false,
  keyboardSound:
    typeof localStorage !== 'undefined' ? getKeyboardSound() : false,
  keyboardHaptics:
    typeof localStorage !== 'undefined' ? getKeyboardHaptics() : true,
  editorFocused: false,
  mobileTab: 'editor',
  splitRatio: typeof localStorage !== 'undefined' ? getSplitRatio() : 0.5,
  aiPanelOpen: false,
  transferOpen: false,
  settingsOpen: false,
  autoLineNumbering:
    typeof localStorage !== 'undefined' ? getAutoLineNumbering() : true,
  lineNumberIncrement:
    typeof localStorage !== 'undefined' ? getLineNumberIncrement() : 10,
  showLineNumberGutter:
    typeof localStorage !== 'undefined' ? getShowLineNumberGutter() : false,
  renumberRequest: 0,

  setDialect: (id) =>
    set((s) => {
      if (id === s.dialect.id) return {};
      persistDialectId(id);
      const next = getDialect(id);
      // Swap in the new machine's starter only when the document is untouched;
      // never clobber the user's own code. Either way refresh docOverride so the
      // editor (rebuilt on dialect change) shows the right text, not stale
      // content.
      const swap = isStarterOrEmpty(s.source);
      const text = swap ? (next.samples[0]?.text ?? '') : s.source;
      return {
        dialect: next,
        source: text,
        docOverride: { text, seq: s.docOverride.seq + 1 },
        dirty: swap ? false : s.dirty,
        fileName: swap ? 'untitled.bas' : s.fileName,
        // The emulator pane tears down the old machine when `dialect` changes;
        // mark it stopped so the UI reflects the switch immediately. Also bump
        // stopRequest so any in-flight run loop is explicitly halted.
        emulatorStatus: 'stopped',
        stopRequest: s.stopRequest + 1,
        // On mobile, surface the change in the editor the user is now editing.
        ...(isMobileViewport() ? { mobileTab: 'editor' as MobileTab } : {}),
      };
    }),
  setSource: (text) => set({ source: text, dirty: true }),
  replaceDocument: (text, fileName) =>
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      ...(fileName !== undefined ? { fileName } : {}),
      dirty: fileName === undefined,
      // On mobile, loading new content stops any running program and brings the
      // user back to the editor showing what was just loaded.
      ...(isMobileViewport()
        ? { stopRequest: s.stopRequest + 1, mobileTab: 'editor' as MobileTab }
        : {}),
    })),
  markSaved: (fileName) => set({ fileName, dirty: false }),
  requestRun: () => set((s) => ({ runRequest: s.runRequest + 1 })),
  requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
  requestReset: () => set((s) => ({ resetRequest: s.resetRequest + 1 })),
  setEmulatorSpeed: (n) => {
    persistEmulatorSpeed(n);
    set({ emulatorSpeed: n });
  },
  setCrtEffect: (on) => {
    persistCrtEffect(on);
    set({ crtEffect: on });
  },
  setVirtualKeyboard: (on) => {
    persistVirtualKeyboard(on);
    set({ virtualKeyboard: on });
  },
  setVariableWatcher: (on) => set({ variableWatcher: on }),
  setKeyboardSound: (on) => {
    persistKeyboardSound(on);
    set({ keyboardSound: on });
  },
  setKeyboardHaptics: (on) => {
    persistKeyboardHaptics(on);
    set({ keyboardHaptics: on });
  },
  setEditorFocused: (on) => set({ editorFocused: on }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setSplitRatio: (n) => set({ splitRatio: n }),
  setEmulatorStatus: (status) => set({ emulatorStatus: status }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setTransferOpen: (open) => set({ transferOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setAutoLineNumbering: (on) => {
    persistAutoLineNumbering(on);
    set({ autoLineNumbering: on });
  },
  setLineNumberIncrement: (n) => {
    persistLineNumberIncrement(n);
    set({ lineNumberIncrement: n });
  },
  setShowLineNumberGutter: (on) => {
    persistShowLineNumberGutter(on);
    set({ showLineNumberGutter: on });
  },
  requestRenumber: () =>
    set((s) => ({ renumberRequest: s.renumberRequest + 1 })),
}));
