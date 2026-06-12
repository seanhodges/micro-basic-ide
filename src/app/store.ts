import { create } from 'zustand';
import { getDialect } from '../dialects/registry';
import type { Dialect } from '../dialects/types';
import {
  loadAutosave,
  getAutoLineNumbering,
  getLineNumberIncrement,
  getCrtEffect,
  getSplitRatio,
  getEmulatorSpeed,
  getVirtualKeyboard,
  getKeyboardSound,
  getKeyboardHaptics,
  setAutoLineNumbering as persistAutoLineNumbering,
  setLineNumberIncrement as persistLineNumberIncrement,
  setCrtEffect as persistCrtEffect,
  setEmulatorSpeed as persistEmulatorSpeed,
  setVirtualKeyboard as persistVirtualKeyboard,
  setKeyboardSound as persistKeyboardSound,
  setKeyboardHaptics as persistKeyboardHaptics,
} from '../storage/settings';
import { MOBILE_QUERY } from './useMediaQuery';

export type EmulatorStatus = 'stopped' | 'running';
export type MobileTab = 'editor' | 'preview' | 'settings' | 'ai';

interface IdeState {
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
  /** Bumped to ask the editor to renumber the current line. */
  renumberRequest: number;

  setSource(text: string): void;
  replaceDocument(text: string, fileName?: string): void;
  markSaved(fileName: string): void;
  requestRun(): void;
  requestStop(): void;
  requestReset(): void;
  setEmulatorSpeed(n: number): void;
  setCrtEffect(on: boolean): void;
  setVirtualKeyboard(on: boolean): void;
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
  requestRenumber(): void;
}

const autosaved = typeof localStorage !== 'undefined' ? loadAutosave() : null;

/** Default the virtual keyboard to shown on touch/small-screen devices. */
function defaultVirtualKeyboard(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.(MOBILE_QUERY).matches || navigator.maxTouchPoints > 0
  );
}

export const useIdeStore = create<IdeState>((set) => ({
  dialect: getDialect('zx81'),
  fileName: autosaved?.name ?? 'untitled.bas',
  source: autosaved?.text ?? '',
  docOverride: { text: autosaved?.text ?? '', seq: 0 },
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
  renumberRequest: 0,

  setSource: (text) => set({ source: text, dirty: true }),
  replaceDocument: (text, fileName) =>
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      ...(fileName !== undefined ? { fileName } : {}),
      dirty: fileName === undefined,
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
  requestRenumber: () =>
    set((s) => ({ renumberRequest: s.renumberRequest + 1 })),
}));
