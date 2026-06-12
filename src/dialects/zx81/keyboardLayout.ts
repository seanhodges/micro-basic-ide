import type {
  EditorKeyAction,
  GlyphRegistry,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The authentic ZX81 membrane keyboard as virtual-keyboard layout data.
 *
 * Each key carries up to five legends, matching the real machine:
 *  - main:     the big white character
 *  - shift:    the red symbol in the top-right corner (SHIFT held)
 *  - keyword:  the white K-mode keyword printed on the lower part of the key
 *  - function: the red FUNCTION-mode name printed below the key
 *  - graphic:  the block-graphics glyph in the bottom-right corner
 *
 * Which legend the ROM acts on is mode-driven (K/L/F/G cursor), so all
 * legends render permanently like the real keyboard; only the shift layer is
 * modifier-driven.
 */

// ---------------------------------------------------------------------------
// Block-graphics glyphs. 16×16 viewBox, 2×2 quadrants of 8px; grey areas are
// a 2px chequerboard. Rendered with fill: currentColor.

const QUAD = {
  tl: 'M0 0H8V8H0Z',
  tr: 'M8 0H16V8H8Z',
  bl: 'M0 8H8V16H0Z',
  br: 'M8 8H16V16H8Z',
};

/** 2px chequerboard covering the given area; phase flips which cells fill. */
function chequer(
  x0: number,
  y0: number,
  w: number,
  h: number,
  phase = 0,
): string {
  const cells: string[] = [];
  for (let y = 0; y < h / 2; y++) {
    for (let x = 0; x < w / 2; x++) {
      if ((x + y + phase) % 2 === 0)
        cells.push(`M${x0 + x * 2} ${y0 + y * 2}h2v2h-2Z`);
    }
  }
  return cells.join('');
}

function glyph(...ds: string[]): { viewBox: string; paths: { d: string }[] } {
  return { viewBox: '0 0 16 16', paths: ds.map((d) => ({ d })) };
}

const zx81Glyphs: GlyphRegistry = {
  quadTL: glyph(QUAD.tl),
  quadTR: glyph(QUAD.tr),
  quadBL: glyph(QUAD.bl),
  quadBR: glyph(QUAD.br),
  halfT: glyph('M0 0H16V8H0Z'),
  halfB: glyph('M0 8H16V16H0Z'),
  halfL: glyph('M0 0H8V16H0Z'),
  halfR: glyph('M8 0H16V16H8Z'),
  solid: glyph('M0 0H16V16H0Z'),
  q3NoTL: glyph(QUAD.tr + QUAD.bl + QUAD.br),
  q3NoTR: glyph(QUAD.tl + QUAD.bl + QUAD.br),
  q3NoBL: glyph(QUAD.tl + QUAD.tr + QUAD.br),
  q3NoBR: glyph(QUAD.tl + QUAD.tr + QUAD.bl),
  diagTLBR: glyph(QUAD.tl + QUAD.br),
  diagTRBL: glyph(QUAD.tr + QUAD.bl),
  grey: glyph(chequer(0, 0, 16, 16)),
  greyInv: glyph(chequer(0, 0, 16, 16, 1)),
  greyT: glyph(chequer(0, 0, 16, 8)),
  greyB: glyph(chequer(0, 8, 16, 8)),
  greyTSolidB: glyph(chequer(0, 0, 16, 8) + 'M0 8H16V16H0Z'),
  solidTGreyB: glyph('M0 0H16V8H0Z' + chequer(0, 8, 16, 8)),
};

// ---------------------------------------------------------------------------
// What each block-graphics glyph inserts as editor text: the charset's
// unicode block elements, or backslash escapes for the chequered greys
// (see charset.ts GRAPHIC_UNICODE / ESCAPES).

const GRAPHIC_INSERT: Record<string, string> = {
  quadTL: '▘',
  quadTR: '▝',
  quadBL: '▖',
  quadBR: '▗',
  halfT: '▀',
  halfB: '▄',
  halfL: '▌',
  halfR: '▐',
  solid: '█',
  q3NoTL: '▟',
  q3NoTR: '▙',
  q3NoBL: '▜',
  q3NoBR: '▛',
  diagTLBR: '▚',
  diagTRBL: '▞',
  grey: '▒',
  greyInv: '\\||',
  greyT: "\\!'",
  greyB: '\\!.',
  greyTSolidB: "\\|'",
  solidTGreyB: '\\|.',
};

// ---------------------------------------------------------------------------
// Key data. Label tuple order matches `layers` below:
// [main, shift, keyword, function, graphic]
//
// A text legend is a plain string (editor action derived from the layer's
// editorInsertStyle) or an object overriding what it does in the editor.

type Legend = string | { text: string; editor: EditorKeyAction | null } | null;

/** Legend that inserts the keyword plus a trailing space. */
const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});
/** Legend bound to an editing action (backspace, cursor moves, newline). */
const act = (
  text: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
): Legend => ({ text, editor: { action } });
/** Legend that inserts different text than it shows. */
const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});
/** Legend that does nothing in the editor (machine-only commands). */
const noop = (text: string): Legend => ({ text, editor: null });

type Legends = [Legend, Legend, Legend, Legend, string | null];

function key(
  token: string,
  [main, shift, keyword, fn, graphic]: Legends,
): KeyDef {
  const lbl = (legend: Legend): KeyLabel | null =>
    legend === null
      ? null
      : typeof legend === 'string'
        ? { text: legend }
        : { text: legend.text, editor: legend.editor };
  const glyphInsert = graphic === null ? undefined : GRAPHIC_INSERT[graphic];
  return {
    id: token,
    spanX: 4,
    emits: [token],
    labels: [
      lbl(main),
      lbl(shift),
      lbl(keyword),
      lbl(fn),
      graphic === null
        ? null
        : {
            glyph: graphic,
            editor: glyphInsert === undefined ? null : { insert: glyphInsert },
          },
    ],
  };
}

const rows: KeyDef[][] = [
  [
    key('Digit1', ['1', noop('EDIT'), null, null, 'quadTL']),
    key('Digit2', ['2', word('AND'), null, null, 'quadTR']),
    key('Digit3', ['3', word('THEN'), null, null, 'quadBR']),
    key('Digit4', ['4', word('TO'), null, null, 'quadBL']),
    key('Digit5', ['5', act('←', 'left'), null, null, 'halfL']),
    key('Digit6', ['6', act('↓', 'down'), null, null, 'halfB']),
    key('Digit7', ['7', act('↑', 'up'), null, null, 'halfT']),
    key('Digit8', ['8', act('→', 'right'), null, null, 'halfR']),
    key('Digit9', ['9', noop('GRAPHICS'), null, null, null]),
    key('Digit0', ['0', act('RUBOUT', 'backspace'), null, null, null]),
  ],
  [
    key('KeyQ', ['Q', '""', 'PLOT', 'SIN', 'q3NoTL']),
    key('KeyW', ['W', word('OR'), 'UNPLOT', 'COS', 'q3NoTR']),
    key('KeyE', ['E', word('STEP'), 'REM', 'TAN', 'q3NoBR']),
    key('KeyR', ['R', '<=', 'RUN', 'INT', 'q3NoBL']),
    key('KeyT', ['T', '<>', 'RAND', 'RND', 'diagTRBL']),
    key('KeyY', ['Y', '>=', 'RETURN', 'STR$', 'diagTLBR']),
    key('KeyU', ['U', '$', 'IF', 'CHR$', null]),
    key('KeyI', ['I', '(', 'INPUT', 'CODE', null]),
    key('KeyO', ['O', ')', 'POKE', 'PEEK', null]),
    key('KeyP', ['P', '"', 'PRINT', 'TAB', null]),
  ],
  [
    key('KeyA', ['A', word('STOP'), 'NEW', 'ARCSIN', 'grey']),
    key('KeyS', ['S', word('LPRINT'), 'SAVE', 'ARCCOS', 'greyT']),
    key('KeyD', ['D', word('SLOW'), 'DIM', 'ARCTAN', 'greyB']),
    key('KeyF', ['F', word('FAST'), 'FOR', 'SGN', 'greyTSolidB']),
    key('KeyG', ['G', word('LLIST'), 'GOTO', 'ABS', 'solidTGreyB']),
    key('KeyH', ['H', '**', 'GOSUB', 'SQR', 'greyInv']),
    // '−' is U+2212 (not in the ZX81 charset); insert the ASCII hyphen.
    key('KeyJ', ['J', ins('−', '-'), 'LOAD', 'VAL', null]),
    key('KeyK', ['K', '+', 'LIST', 'LEN', null]),
    key('KeyL', ['L', '=', 'LET', 'USR', null]),
    {
      ...key('Enter', [
        act('NEW LINE', 'newline'),
        noop('FUNCTION'),
        null,
        null,
        null,
      ]),
      style: 'small-main',
    },
  ],
  [
    {
      id: 'Shift',
      spanX: 4,
      emits: ['Shift'],
      modifier: 'shift',
      style: 'shift',
      labels: [{ text: 'SHIFT' }, null, null, null, null],
    },
    key('KeyZ', ['Z', ':', 'COPY', 'LN', null]),
    key('KeyX', ['X', ';', 'CLEAR', 'EXP', null]),
    key('KeyC', ['C', '?', 'CONT', 'AT', null]),
    key('KeyV', ['V', '/', 'CLS', null, null]),
    key('KeyB', ['B', '*', 'SCROLL', 'INKEY$', null]),
    key('KeyN', ['N', '<', 'NEXT', 'NOT', null]),
    key('KeyM', ['M', '>', 'PAUSE', 'PI', null]),
    key('Period', ['.', ',', null, null, null]),
    {
      ...key('Space', [ins('SPACE', ' '), '£', null, null, 'solid']),
      style: 'small-main',
    },
  ],
  // Convenience extras (not on the real machine): common shift chords as
  // single keys, handy on touch screens.
  [
    {
      id: 'x-edit',
      spanX: 8,
      emits: ['Shift', 'Digit1'],
      style: 'extra',
      labels: [{ text: 'EDIT', editor: null }, null, null, null, null],
    },
    {
      id: 'x-left',
      spanX: 4,
      emits: ['Shift', 'Digit5'],
      style: 'extra',
      labels: [
        { text: '←', editor: { action: 'left' } },
        null,
        null,
        null,
        null,
      ],
    },
    {
      id: 'x-down',
      spanX: 4,
      emits: ['Shift', 'Digit6'],
      style: 'extra',
      labels: [
        { text: '↓', editor: { action: 'down' } },
        null,
        null,
        null,
        null,
      ],
    },
    {
      id: 'x-up',
      spanX: 4,
      emits: ['Shift', 'Digit7'],
      style: 'extra',
      labels: [{ text: '↑', editor: { action: 'up' } }, null, null, null, null],
    },
    {
      id: 'x-right',
      spanX: 4,
      emits: ['Shift', 'Digit8'],
      style: 'extra',
      labels: [
        { text: '→', editor: { action: 'right' } },
        null,
        null,
        null,
        null,
      ],
    },
    {
      id: 'x-quote',
      spanX: 8,
      emits: ['Shift', 'KeyP'],
      style: 'extra',
      labels: [{ text: '"' }, null, null, null, null],
    },
    {
      id: 'x-rubout',
      spanX: 8,
      emits: ['Shift', 'Digit0'],
      style: 'extra',
      labels: [
        { text: 'RUBOUT', editor: { action: 'backspace' } },
        null,
        null,
        null,
        null,
      ],
    },
  ],
];

export const zx81KeyboardLayout: KeyboardLayout = {
  id: 'zx81',
  name: 'ZX81',
  theme: 'vk-theme-zx81',
  gridColumns: 40,
  layers: [
    {
      id: 'main',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shift',
      name: 'SHIFT',
      position: 'tr',
      activeWhen: ['shift'],
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
    { id: 'graphic', name: 'GRAPHICS', position: 'br', activeWhen: [] },
  ],
  editorModes: [
    { id: 'abc', name: 'ABC', layer: 'main' },
    { id: 'keyword', name: 'KEYWORD', layer: 'keyword' },
    { id: 'function', name: 'FUNCTION', layer: 'function' },
    { id: 'graphic', name: 'GRAPHICS', layer: 'graphic' },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows,
  glyphs: zx81Glyphs,
  options: { minHoldFrames: 3, compactDefaultLayer: 'keyword' },
};
