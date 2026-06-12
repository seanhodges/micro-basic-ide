import type {
  KeyDef,
  KeyLabel,
  KeyboardLayout,
} from '../../keyboard/layoutSchema';

/**
 * The BBC Micro Model B keyboard as virtual-keyboard layout data.
 *
 * Two layers: the base legend and the shifted legend (top-left, like the
 * shifted symbols printed on the real keycaps). The red f0–f9 strip and
 * BREAK live on the top row. Matrix tokens are resolved by the BBC adapter
 * (src/emulator/bbc/keyboard.ts); 'Break' is the reset line, not a matrix
 * key.
 */

type Legend = string | null;

const lbl = (text: Legend): KeyLabel | null =>
  text === null ? null : { text };

/** A key with a base legend and an optional shifted legend. */
function key(
  token: string,
  base: Legend,
  shifted: Legend = null,
  spanX = 4,
  opts: Partial<KeyDef> = {},
): KeyDef {
  return {
    id: token,
    spanX,
    emits: [token],
    labels: [lbl(base), lbl(shifted)],
    ...opts,
  };
}

/** A key bound to an editor action instead of the layer default. */
function actKey(
  token: string,
  base: string,
  action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down',
  spanX = 4,
): KeyDef {
  return {
    id: token,
    spanX,
    emits: [token],
    labels: [{ text: base, editor: { action } }, null],
  };
}

/** A machine-only key that does nothing when targeting the editor. */
function machKey(
  token: string,
  base: string,
  spanX = 4,
  style?: string,
): KeyDef {
  return {
    id: token,
    spanX,
    emits: [token],
    labels: [{ text: base, editor: null }, null],
    style,
  };
}

const fnRow: KeyDef[] = [
  machKey('Escape', 'ESC', 6),
  ...Array.from({ length: 10 }, (_, i) => machKey(`F${i}`, `f${i}`, 5, 'fn')),
  machKey('Break', 'BRK', 10, 'fn'),
];

const digitRow: KeyDef[] = [
  key('Digit1', '1', '!'),
  key('Digit2', '2', '"'),
  key('Digit3', '3', '#'),
  key('Digit4', '4', '$'),
  key('Digit5', '5', '%'),
  key('Digit6', '6', '&'),
  key('Digit7', '7', "'"),
  key('Digit8', '8', '('),
  key('Digit9', '9', ')'),
  key('Digit0', '0'),
  key('Minus', '-', '='),
  key('Caret', '^', '~'),
  key('Backslash', '\\', '|'),
  actKey('ArrowLeft', '←', 'left', 7),
  actKey('ArrowRight', '→', 'right', 7),
];

const qwertyRow: KeyDef[] = [
  machKey('Tab', 'TAB', 6),
  key('KeyQ', 'Q'),
  key('KeyW', 'W'),
  key('KeyE', 'E'),
  key('KeyR', 'R'),
  key('KeyT', 'T'),
  key('KeyY', 'Y'),
  key('KeyU', 'U'),
  key('KeyI', 'I'),
  key('KeyO', 'O'),
  key('KeyP', 'P'),
  key('At', '@'),
  key('BracketLeft', '[', '{'),
  key('Underscore', '_', '£'),
  actKey('ArrowUp', '↑', 'up', 4),
  actKey('ArrowDown', '↓', 'down', 4),
];

const homeRow: KeyDef[] = [
  machKey('CapsLock', 'CAPS', 5),
  machKey('Ctrl', 'CTRL', 5, undefined),
  key('KeyA', 'A'),
  key('KeyS', 'S'),
  key('KeyD', 'D'),
  key('KeyF', 'F'),
  key('KeyG', 'G'),
  key('KeyH', 'H'),
  key('KeyJ', 'J'),
  key('KeyK', 'K'),
  key('KeyL', 'L'),
  key('Semicolon', ';', '+'),
  key('Colon', ':', '*'),
  key('BracketRight', ']', '}'),
  actKey('Enter', 'RETURN', 'newline', 8),
];

const bottomRow: KeyDef[] = [
  machKey('ShiftLock', 'SH LK', 5),
  {
    id: 'ShiftL',
    spanX: 6,
    emits: ['Shift'],
    labels: [{ text: 'SHIFT', editor: null }, null],
    modifier: 'shift',
  },
  key('KeyZ', 'Z'),
  key('KeyX', 'X'),
  key('KeyC', 'C'),
  key('KeyV', 'V'),
  key('KeyB', 'B'),
  key('KeyN', 'N'),
  key('KeyM', 'M'),
  key('Comma', ',', '<'),
  key('Period', '.', '>'),
  key('Slash', '/', '?'),
  {
    id: 'ShiftR',
    spanX: 6,
    emits: ['Shift'],
    labels: [{ text: 'SHIFT', editor: null }, null],
    modifier: 'shift',
  },
  actKey('Delete', 'DEL', 'backspace', 5),
  machKey('Copy', 'COPY', 4),
];

const spaceRow: KeyDef[] = [
  {
    id: 'Space',
    spanX: 66,
    emits: ['Space'],
    labels: [{ text: ' ', editor: { insert: ' ' } }, null],
  },
];

export const bbcKeyboardLayout: KeyboardLayout = {
  id: 'bbcmicro',
  name: 'BBC Micro',
  theme: 'vk-theme-bbc',
  gridColumns: 66,
  layers: [
    {
      id: 'base',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shifted',
      position: 'tl',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
  ],
  modifiers: [{ id: 'shift', emits: ['Shift'], sticky: true, lockable: true }],
  rows: [fnRow, digitRow, qwertyRow, homeRow, bottomRow, spaceRow],
  glyphs: {},
  options: { minHoldFrames: 4 },
};
