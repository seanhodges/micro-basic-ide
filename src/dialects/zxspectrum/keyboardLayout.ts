import type {
  EditorKeyAction,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The ZX Spectrum 48K membrane keyboard as virtual-keyboard layout data.
 *
 * Each key carries up to five legends, matching the real machine:
 *  - main:     the big white letter / digit
 *  - caps:     CAPS SHIFT (uppercase; on digits the edit/cursor functions)
 *  - symbol:   SYMBOL SHIFT — the red symbol
 *  - keyword:  the white K-mode BASIC keyword printed on the key
 *  - function: the green extended-mode function above the key
 *
 * The keyboard is entirely data-driven; the generic VirtualKeyboard renders it
 * and drives the emulator's setKey() with each key's matrix tokens.
 */

type Legend = string | { text: string; editor: EditorKeyAction | null } | null;
type Legends = [Legend, Legend, Legend, Legend, Legend];

/** Legend that inserts the keyword plus a trailing space. */
const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
/** Legend bound to an editing action. */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
/** Legend that inserts different text than it shows. */
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});
/** Legend that does nothing in the editor (machine-only modes). */
const noop = (text: string): Legend => ({ text, editor: null });

const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : { text: legend.text, editor: legend.editor };

function key(token: string, legends: Legends): KeyDef {
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: legends.map(lbl),
  };
}

/** A letter key: caps inserts the uppercase form. */
function letter(
  token: string,
  ch: string,
  symbol: Legend,
  keyword: string,
  fn: Legend,
): KeyDef {
  return key(token, [
    ch,
    ins(ch.toUpperCase(), ch.toUpperCase()),
    symbol,
    word(keyword),
    fn,
  ]);
}

const rows: KeyDef[][] = [
  [
    key('Digit1', ['1', noop('EDIT'), '!', null, null]),
    key('Digit2', ['2', noop('CAPS'), '@', null, null]),
    key('Digit3', ['3', noop('T.VID'), '#', null, null]),
    key('Digit4', ['4', noop('I.VID'), '$', null, null]),
    key('Digit5', ['5', act('←', 'left'), '%', null, null]),
    key('Digit6', ['6', act('↓', 'down'), '&', null, null]),
    key('Digit7', ['7', act('↑', 'up'), ins("'", "'"), null, null]),
    key('Digit8', ['8', act('→', 'right'), '(', null, null]),
    key('Digit9', ['9', noop('GRAPH'), ')', null, null]),
    key('Digit0', ['0', act('DELETE', 'backspace'), '_', null, null]),
  ],
  [
    letter('KeyQ', 'q', '<=', 'PLOT', word('SIN')),
    letter('KeyW', 'w', '<>', 'DRAW', word('COS')),
    letter('KeyE', 'e', '>=', 'REM', word('TAN')),
    letter('KeyR', 'r', '<', 'RUN', word('INT')),
    letter('KeyT', 't', '>', 'RANDOMIZE', word('RND')),
    letter('KeyY', 'y', word('AND'), 'RETURN', word('STR$')),
    letter('KeyU', 'u', word('OR'), 'IF', word('CHR$')),
    letter('KeyI', 'i', word('AT'), 'INPUT', word('CODE')),
    letter('KeyO', 'o', ';', 'POKE', word('PEEK')),
    letter('KeyP', 'p', '"', 'PRINT', word('TAB')),
  ],
  [
    letter('KeyA', 'a', '~', 'NEW', word('READ')),
    letter('KeyS', 's', '|', 'SAVE', word('RESTORE')),
    letter('KeyD', 'd', '\\', 'DIM', word('DATA')),
    letter('KeyF', 'f', '{', 'FOR', word('SGN')),
    letter('KeyG', 'g', '}', 'GO TO', word('ABS')),
    letter('KeyH', 'h', ins('↑', '↑'), 'GO SUB', word('SQR')),
    letter('KeyJ', 'j', '-', 'LOAD', word('VAL')),
    letter('KeyK', 'k', '+', 'LIST', word('LEN')),
    letter('KeyL', 'l', '=', 'LET', word('USR')),
    {
      ...key('Enter', [act('ENTER', 'newline'), null, null, null, null]),
      style: 'small-main',
    },
  ],
  [
    {
      id: 'CapsShift',
      spanX: 4,
      emits: ['CapsShift'],
      modifier: 'caps',
      style: 'shift',
      labels: [{ text: 'CAPS SHIFT' }, null, null, null, null],
    },
    letter('KeyZ', 'z', ':', 'COPY', word('LN')),
    letter('KeyX', 'x', ins('£', '£'), 'CLEAR', word('EXP')),
    letter('KeyC', 'c', '?', 'CONTINUE', word('INKEY$')),
    letter('KeyV', 'v', '/', 'CLS', word('VAL$')),
    letter('KeyB', 'b', '*', 'BORDER', word('BIN')),
    letter('KeyN', 'n', ',', 'NEXT', word('INKEY$')),
    letter('KeyM', 'm', '.', 'PAUSE', word('PI')),
    {
      id: 'SymShift',
      spanX: 4,
      emits: ['SymShift'],
      modifier: 'symbol',
      style: 'symshift',
      labels: [{ text: 'SYMBOL SHIFT' }, null, null, null, null],
    },
    {
      ...key('Space', [ins('SPACE', ' '), noop('BREAK'), null, null, null]),
      style: 'small-main',
    },
  ],
  // Convenience extras (not on the real machine): handy on touch screens.
  [
    {
      id: 'x-left',
      spanX: 8,
      emits: ['CapsShift', 'Digit5'],
      style: 'extra',
      labels: [act('←', 'left') as KeyLabel, null, null, null, null],
    },
    {
      id: 'x-down',
      spanX: 8,
      emits: ['CapsShift', 'Digit6'],
      style: 'extra',
      labels: [act('↓', 'down') as KeyLabel, null, null, null, null],
    },
    {
      id: 'x-up',
      spanX: 8,
      emits: ['CapsShift', 'Digit7'],
      style: 'extra',
      labels: [act('↑', 'up') as KeyLabel, null, null, null, null],
    },
    {
      id: 'x-right',
      spanX: 8,
      emits: ['CapsShift', 'Digit8'],
      style: 'extra',
      labels: [act('→', 'right') as KeyLabel, null, null, null, null],
    },
    {
      id: 'x-delete',
      spanX: 8,
      emits: ['CapsShift', 'Digit0'],
      style: 'extra',
      labels: [act('DELETE', 'backspace') as KeyLabel, null, null, null, null],
    },
  ],
];

export const spectrumKeyboardLayout: KeyboardLayout = {
  id: 'zxspectrum',
  name: 'ZX Spectrum',
  theme: 'vk-theme-zxspectrum',
  gridColumns: 40,
  layers: [
    {
      id: 'main',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'caps',
      name: 'CAPS',
      position: 'tl',
      activeWhen: ['caps'],
      editorInsertStyle: 'char',
    },
    {
      id: 'symbol',
      name: 'SYMBOL',
      position: 'tr',
      activeWhen: ['symbol'],
      editorInsertStyle: 'char',
    },
    {
      id: 'keyword',
      name: 'KEYWORD',
      position: 'bl',
      activeWhen: [],
      editorInsertStyle: 'word',
    },
    {
      id: 'function',
      name: 'FUNCTION',
      position: 'below',
      activeWhen: [],
      editorInsertStyle: 'word',
    },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
    { id: 'function', name: 'FUNCTION', layer: 'function' },
  ],
  modifiers: [
    { id: 'caps', emits: ['CapsShift'], sticky: true, lockable: true },
    { id: 'symbol', emits: ['SymShift'], sticky: true, lockable: true },
  ],
  rows,
  glyphs: {},
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
};
