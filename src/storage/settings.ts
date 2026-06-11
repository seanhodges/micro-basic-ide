const KEYS = {
  apiKey: 'mbide.anthropicApiKey',
  autosaveDoc: 'mbide.autosave.doc',
  autosaveName: 'mbide.autosave.name',
  autoLineNumbering: 'mbide.autoLineNumbering',
  lineNumberIncrement: 'mbide.lineNumberIncrement',
} as const;

export const DEFAULT_LINE_INCREMENT = 10;

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

export function loadAutosave(): { name: string; text: string } | null {
  const text = localStorage.getItem(KEYS.autosaveDoc);
  if (text === null) return null;
  return { name: localStorage.getItem(KEYS.autosaveName) ?? 'untitled.bas', text };
}

export function saveAutosave(name: string, text: string): void {
  try {
    localStorage.setItem(KEYS.autosaveDoc, text);
    localStorage.setItem(KEYS.autosaveName, name);
  } catch {
    // quota exceeded — autosave is best-effort
  }
}
