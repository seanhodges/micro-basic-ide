import { describe, it, expect } from 'vitest';
import { spectrumKeyboardLayout } from './keyboardLayout';
import { spectrumCharset } from './charset';
import { resolveEditorAction } from '../../keyboard/editorActions';

const layout = spectrumKeyboardLayout;
const allKeys = layout.rows.flat();

const editorLayerIds = [
  ...(layout.editorModes ?? []).map((m) => m.layer),
  'caps',
  'symbol',
];

describe('zxspectrum keyboard layout', () => {
  it('labels are index-aligned with the layers', () => {
    for (const key of allKeys) {
      expect(key.labels.length, key.id).toBe(layout.layers.length);
    }
  });

  it('every insert in every reachable mode is valid Spectrum charset text', () => {
    for (const key of allKeys) {
      for (const layerId of editorLayerIds) {
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(
            () => spectrumCharset.toMachine(action.insert),
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
        if (!key.labels[layerIdx]) continue;
        const action = resolveEditorAction(layout, key, layerId);
        if (action && 'insert' in action) {
          expect(action.insert.endsWith(' '), `${key.id}/${layerId}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('every referenced modifier exists', () => {
    const modIds = new Set(layout.modifiers.map((m) => m.id));
    for (const key of allKeys) {
      if (key.modifier) expect(modIds.has(key.modifier), key.id).toBe(true);
    }
  });

  it('spot checks the headline keys', () => {
    const byId = new Map(allKeys.map((k) => [k.id, k]));
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
    expect(resolveEditorAction(layout, byId.get('KeyG')!, 'keyword')).toEqual({
      insert: 'GO TO ',
    });
    expect(resolveEditorAction(layout, byId.get('KeyP')!, 'symbol')).toEqual({
      insert: '"',
    });
    expect(resolveEditorAction(layout, byId.get('KeyQ')!, 'function')).toEqual({
      insert: 'SIN ',
    });
    expect(resolveEditorAction(layout, byId.get('Enter')!, 'main')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, byId.get('Space')!, 'main')).toEqual({
      insert: ' ',
    });
    expect(resolveEditorAction(layout, byId.get('Digit0')!, 'caps')).toEqual({
      action: 'backspace',
    });
    // Digits keep working in keyword mode via the base-layer fallback.
    expect(resolveEditorAction(layout, byId.get('Digit3')!, 'keyword')).toEqual(
      {
        insert: '3',
      },
    );
  });
});
