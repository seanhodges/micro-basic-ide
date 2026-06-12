const KEYS = {
  apiKey: 'mbide.anthropicApiKey',
  autosaveDoc: 'mbide.autosave.doc',
  autosaveName: 'mbide.autosave.name',
  autoLineNumbering: 'mbide.autoLineNumbering',
  lineNumberIncrement: 'mbide.lineNumberIncrement',
  crtEffect: 'mbide.crtEffect',
  splitRatio: 'mbide.splitRatio',
  emulatorSpeed: 'mbide.emulatorSpeed',
  virtualKeyboard: 'mbide.virtualKeyboard',
  keyboardSound: 'mbide.keyboardSound',
  keyboardHaptics: 'mbide.keyboardHaptics',
} as const;

export const DEFAULT_LINE_INCREMENT = 10;
export const DEFAULT_SPLIT_RATIO = 0.5;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

const EMULATOR_SPEEDS = [1, 2, 8];

export function getApiKey(): string {
  return localStorage.getItem(KEYS.apiKey) ?? '';
}

export function setApiKey(key: string): void {
  if (key === '') localStorage.removeItem(KEYS.apiKey);
  else localStorage.setItem(KEYS.apiKey, key);
}

export function getAutoLineNumbering(): boolean {
  return localStorage.getItem(KEYS.autoLineNumbering) !== 'false'; // default on
}

export function setAutoLineNumbering(on: boolean): void {
  localStorage.setItem(KEYS.autoLineNumbering, on ? 'true' : 'false');
}

export function getLineNumberIncrement(): number {
  const raw = localStorage.getItem(KEYS.lineNumberIncrement);
  const n = raw === null ? DEFAULT_LINE_INCREMENT : parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_LINE_INCREMENT;
}

export function setLineNumberIncrement(n: number): void {
  localStorage.setItem(KEYS.lineNumberIncrement, String(n));
}

export function getCrtEffect(): boolean {
  return localStorage.getItem(KEYS.crtEffect) !== 'false'; // default on
}

export function setCrtEffect(on: boolean): void {
  localStorage.setItem(KEYS.crtEffect, on ? 'true' : 'false');
}

/** null = never set; the store falls back to a touch-device default. */
export function getVirtualKeyboard(): boolean | null {
  const raw = localStorage.getItem(KEYS.virtualKeyboard);
  return raw === null ? null : raw === 'true';
}

export function setVirtualKeyboard(on: boolean): void {
  localStorage.setItem(KEYS.virtualKeyboard, on ? 'true' : 'false');
}

export function getKeyboardSound(): boolean {
  return localStorage.getItem(KEYS.keyboardSound) === 'true'; // default off
}

export function setKeyboardSound(on: boolean): void {
  localStorage.setItem(KEYS.keyboardSound, on ? 'true' : 'false');
}

export function getKeyboardHaptics(): boolean {
  return localStorage.getItem(KEYS.keyboardHaptics) !== 'false'; // default on
}

export function setKeyboardHaptics(on: boolean): void {
  localStorage.setItem(KEYS.keyboardHaptics, on ? 'true' : 'false');
}

export function getSplitRatio(): number {
  const raw = localStorage.getItem(KEYS.splitRatio);
  const n = raw === null ? DEFAULT_SPLIT_RATIO : parseFloat(raw);
  if (!Number.isFinite(n)) return DEFAULT_SPLIT_RATIO;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, n));
}

export function setSplitRatio(n: number): void {
  localStorage.setItem(KEYS.splitRatio, String(n));
}

export function getEmulatorSpeed(): number {
  const raw = localStorage.getItem(KEYS.emulatorSpeed);
  const n = raw === null ? 1 : parseInt(raw, 10);
  return EMULATOR_SPEEDS.includes(n) ? n : 1;
}

export function setEmulatorSpeed(n: number): void {
  localStorage.setItem(KEYS.emulatorSpeed, String(n));
}

export function loadAutosave(): { name: string; text: string } | null {
  const text = localStorage.getItem(KEYS.autosaveDoc);
  if (text === null) return null;
  return {
    name: localStorage.getItem(KEYS.autosaveName) ?? 'untitled.bas',
    text,
  };
}

export function saveAutosave(name: string, text: string): void {
  try {
    localStorage.setItem(KEYS.autosaveDoc, text);
    localStorage.setItem(KEYS.autosaveName, name);
  } catch {
    // quota exceeded — autosave is best-effort
  }
}
