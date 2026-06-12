import { describe, it, expect } from 'vitest';
import { zx81KeyboardLayout } from './keyboardLayout';
import { zx81Charset } from './charset';
import { resolveEditorAction } from '../../keyboard/editorActions';

const layout = zx81KeyboardLayout;
const allKeys = layout.rows.flat();

/** Every layer a key press can resolve against in the editor: each mode's
    layer, plus the shift layer (reachable via the modifier in ABC mode). */
const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'shift',
];

describe('zx81 keyboard layout editor mapping', () => {
  it('every insert in every mode is valid ZX81 charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => zx81Charset.toMachine(action.insert),
            `${key.id} on layer ${layerId}: ${JSON.stringify(action.insert)}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('keyword and function inserts end in a space', () => {
    for (const key of allKeys) {
      for (const layerId of ['keyword', 'function']) {
        const layerIdx = layout.layers.findIndex((l) => l.id === layerId);
        if (!key.labels[layerIdx]) continue; // falls back to main — not a word
        const action = resolveEditorAction(layout, key, layerId);
        expect(action, `${key.id} on layer ${layerId}`).not.toBeNull();
        if (action && 'insert' in action) {
          expect(action.insert.endsWith(' '), `${key.id}/${layerId}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('every graphics-layer glyph has an explicit insert', () => {
    const graphicIdx = layout.layers.findIndex((l) => l.id === 'graphic');
    for (const key of allKeys) {
      const label = key.labels[graphicIdx];
      if (!label?.glyph) continue;
      const action = resolveEditorAction(layout, key, 'graphic');
      expect(action, key.id).not.toBeNull();
      expect(action && 'insert' in action, key.id).toBe(true);
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('KeyQ')!, 'function')).toEqual({
      insert: 'SIN ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit1')!, 'graphic')).toEqual(
      { insert: '▘' },
    );
    expect(resolveEditorAction(layout, byId.get('KeyA')!, 'graphic')).toEqual({
      insert: '▒',
    });
    // '−' on the key legend is U+2212 — the editor must get an ASCII hyphen.
    expect(resolveEditorAction(layout, byId.get('KeyJ')!, 'shift')).toEqual({
      insert: '-',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'main')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'main')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit0')!, 'shift')).toEqual({
      action: 'backspace',
    });
    expect(resolveEditorAction(layout, byId.get('Digit5')!, 'shift')).toEqual({
      action: 'left',
    });
    // Machine-only commands do nothing in the editor.
    expect(
      resolveEditorAction(layout, byId.get('Digit9')!, 'shift'),
    ).toBeNull();
    expect(resolveEditorAction(layout, byId.get('x-edit')!, 'main')).toBeNull();
    // Digits keep working in keyword mode via the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'keyword')).toEqual(
      { insert: '3' },
    );
  });

  it('grey-block escapes round-trip through the charset', () => {
    const greys = ['\\||', "\\!'", '\\!.', "\\|'", '\\|.'];
    for (const esc of greys) {
      const codes = zx81Charset.toMachine(esc);
      expect(codes.length, esc).toBe(1);
      expect(zx81Charset.toUnicode(codes), esc).toBe(esc);
    }
  });
});
