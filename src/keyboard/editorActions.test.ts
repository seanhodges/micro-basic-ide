import { describe, it, expect } from 'vitest';
import { isRepeatable, resolveEditorAction } from './editorActions';
import type { KeyDef, KeyboardLayout } from './layoutSchema';

const layout: KeyboardLayout = {
  id: 'test',
  name: 'Test',
  theme: 'vk-theme-test',
  gridColumns: 4,
  layers: [
    {
      id: 'main',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shift',
      position: 'tr',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
    {
      id: 'keyword',
      position: 'bl',
      activeWhen: [],
      editorInsertStyle: 'word',
    },
    { id: 'graphic', position: 'br', activeWhen: [] },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows: [[]],
  glyphs: {},
};

const keyP: KeyDef = {
  id: 'KeyP',
  spanX: 1,
  emits: ['KeyP'],
  labels: [
    { text: 'P' },
    { text: '"' },
    { text: 'PRINT' },
    { glyph: 'someGlyph', editor: { insert: '▘' } },
  ],
};

const period: KeyDef = {
  id: 'Period',
  spanX: 1,
  emits: ['Period'],
  labels: [{ text: '.' }, { text: ',' }, null, null],
};

const enter: KeyDef = {
  id: 'Enter',
  spanX: 1,
  emits: ['Enter'],
  labels: [
    { text: 'NEW LINE', editor: { action: 'newline' } },
    { text: 'FUNCTION', editor: null },
    null,
    null,
  ],
};

const glyphOnly: KeyDef = {
  id: 'KeyG',
  spanX: 1,
  emits: ['KeyG'],
  labels: [{ text: 'G' }, null, null, { glyph: 'unmapped' }],
};

const shiftKey: KeyDef = {
  id: 'Shift',
  spanX: 1,
  emits: ['Shift'],
  modifier: 'shift',
  labels: [{ text: 'SHIFT' }, null, null, null],
};

describe('resolveEditorAction', () => {
  it('derives char inserts from the layer style', () => {
    expect(resolveEditorAction(layout, keyP, 'main')).toEqual({ insert: 'P' });
    expect(resolveEditorAction(layout, keyP, 'shift')).toEqual({ insert: '"' });
  });

  it('derives word inserts with a trailing space', () => {
    expect(resolveEditorAction(layout, keyP, 'keyword')).toEqual({
      insert: 'PRINT ',
    });
  });

  it('uses explicit overrides, including forced no-ops', () => {
    expect(resolveEditorAction(layout, enter, 'main')).toEqual({
      action: 'newline',
    });
    expect(resolveEditorAction(layout, enter, 'shift')).toBeNull();
    expect(resolveEditorAction(layout, keyP, 'graphic')).toEqual({
      insert: '▘',
    });
  });

  it('requires explicit data for glyph labels (no derived default)', () => {
    expect(resolveEditorAction(layout, glyphOnly, 'graphic')).toEqual({
      insert: 'G', // falls through to the base layer
    });
  });

  it('falls back to the base layer when a mode layer has no label', () => {
    expect(resolveEditorAction(layout, period, 'keyword')).toEqual({
      insert: '.',
    });
    expect(resolveEditorAction(layout, enter, 'keyword')).toEqual({
      action: 'newline',
    });
  });

  it('never produces actions for modifier keys', () => {
    expect(resolveEditorAction(layout, shiftKey, 'main')).toBeNull();
    expect(resolveEditorAction(layout, shiftKey, 'keyword')).toBeNull();
  });

  it('falls back to the base layer for unknown layers', () => {
    expect(resolveEditorAction(layout, keyP, 'nope')).toEqual({ insert: 'P' });
  });
});

describe('isRepeatable', () => {
  it('repeats editing motions but not inserts or newline', () => {
    expect(isRepeatable({ action: 'backspace' })).toBe(true);
    expect(isRepeatable({ action: 'left' })).toBe(true);
    expect(isRepeatable({ action: 'newline' })).toBe(false);
    expect(isRepeatable({ insert: 'A' })).toBe(false);
  });
});
