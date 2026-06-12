/**
 * Open/save .bas (and binary) files using the File System Access API when
 * available, falling back to <input type=file> / <a download>.
 */

export interface OpenedFile {
  name: string;
  text: string;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?(options?: unknown): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: unknown): Promise<FileSystemFileHandle>;
}

const w = window as FilePickerWindow;

export async function openTextFile(
  accept = '.bas,.txt',
): Promise<OpenedFile | null> {
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: 'BASIC source',
            accept: { 'text/plain': ['.bas', '.txt'] },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return { name: file.name, text: await file.text() };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  return openViaInput(accept, async (file) => ({
    name: file.name,
    text: await file.text(),
  }));
}

export async function openBinaryFile(
  accept = '.p',
): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: 'ZX81 program',
            accept: { 'application/octet-stream': ['.p'] },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  return openViaInput(accept, async (file) => ({
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  }));
}

function openViaInput<T>(
  accept: string,
  read: (file: File) => Promise<T>,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      read(file).then(resolve, reject);
    };
    // 'cancel' fires on modern browsers when the dialog is dismissed
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export async function saveTextFile(
  name: string,
  text: string,
): Promise<string | null> {
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        types: [
          { description: 'BASIC source', accept: { 'text/plain': ['.bas'] } },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle.name;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  downloadBlob(new Blob([text], { type: 'text/plain' }), name);
  return name;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
