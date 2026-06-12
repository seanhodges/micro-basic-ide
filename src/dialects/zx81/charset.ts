import { CharsetError, type CharsetMapping } from '../types';

/**
 * ZX81 character set <-> editor text.
 *
 * Source conventions (zxtext2p-compatible where practical):
 *  - Letters, digits and ZX81 punctuation map directly (lowercase accepted,
 *    folded to upper — the ZX81 has no lowercase).
 *  - Block graphics may be written as unicode block elements (▘▝▀▖▌▞▛ etc.)
 *    or as backslash escapes describing the left/right half of the cell:
 *    ' = top, . = bottom, : = full, space = empty.  E.g. \' . = 0x01, \:: = █.
 *    Grey blocks: \!! (full), \!' (top), \!. (bottom); inverse grey \|| \|' \|.
 *  - %c makes the next character inverse video, e.g. %A → inverse A.
 */

const BASE_PUNCT: Record<number, string> = {
  0x00: ' ',
  0x0b: '"',
  0x0c: '£',
  0x0d: '$',
  0x0e: ':',
  0x0f: '?',
  0x10: '(',
  0x11: ')',
  0x12: '>',
  0x13: '<',
  0x14: '=',
  0x15: '+',
  0x16: '-',
  0x17: '*',
  0x18: '/',
  0x19: ';',
  0x1a: ',',
  0x1b: '.',
};

/** Unicode forms for the block-graphics codes that have exact equivalents. */
const GRAPHIC_UNICODE: Record<number, string> = {
  0x01: '▘',
  0x02: '▝',
  0x03: '▀',
  0x04: '▖',
  0x05: '▌',
  0x06: '▞',
  0x07: '▛',
  0x08: '▒',
  0x80: '█',
  0x81: '▟',
  0x82: '▙',
  0x83: '▄',
  0x84: '▜',
  0x85: '▐',
  0x86: '▚',
  0x87: '▗',
};

/** Backslash escapes (two chars following the backslash) -> code. */
const ESCAPES: Record<string, number> = {
  "' ": 0x01,
  " '": 0x02,
  "''": 0x03,
  '. ': 0x04,
  ': ': 0x05,
  ".'": 0x06,
  ":'": 0x07,
  '!!': 0x08,
  "!'": 0x09,
  '!.': 0x0a,
  '::': 0x80,
  '.:': 0x81,
  ':.': 0x82,
  '..': 0x83,
  "':": 0x84,
  ' :': 0x85,
  "'.": 0x86,
  ' .': 0x87,
  '||': 0x88,
  "|'": 0x89,
  '|.': 0x8a,
};

const charToCode = new Map<string, number>();
const codeToChar = new Map<number, string>();

for (const [code, ch] of Object.entries(BASE_PUNCT)) {
  charToCode.set(ch, Number(code));
  codeToChar.set(Number(code), ch);
}
for (let d = 0; d <= 9; d++) {
  charToCode.set(String(d), 0x1c + d);
  codeToChar.set(0x1c + d, String(d));
}
for (let i = 0; i < 26; i++) {
  const ch = String.fromCharCode(65 + i);
  charToCode.set(ch, 0x26 + i);
  codeToChar.set(0x26 + i, ch);
}
for (const [code, ch] of Object.entries(GRAPHIC_UNICODE)) {
  charToCode.set(ch, Number(code));
}

const escapeForCode = new Map<number, string>();
for (const [esc, code] of Object.entries(ESCAPES)) {
  if (!escapeForCode.has(code)) escapeForCode.set(code, '\\' + esc);
}

export const NEWLINE = 0x76;
export const NUMBER_MARKER = 0x7e;
export const QUOTE = 0x0b;
export const QUOTE_IMAGE = 0xc0;
export const INVERSE = 0x80;

/**
 * Parse one editor character (possibly an escape/% sequence) starting at
 * index i. Returns the machine code and the number of source chars consumed.
 */
export function parseChar(
  text: string,
  i: number,
): { code: number; length: number } {
  const ch = text[i]!;
  if (ch === '\\') {
    const esc = text.slice(i + 1, i + 3);
    if (esc.length === 2 && esc in ESCAPES) {
      return { code: ESCAPES[esc]!, length: 3 };
    }
    throw new CharsetError(`Unknown graphics escape "\\${esc}"`, i);
  }
  if (ch === '%') {
    const next = text[i + 1];
    if (next === undefined)
      throw new CharsetError(
        '% at end of input (expected a character to invert)',
        i,
      );
    const upper = next.toUpperCase();
    const base = charToCode.get(upper);
    if (base === undefined || base > 0x3f) {
      throw new CharsetError(`Cannot invert "${next}"`, i);
    }
    return { code: base | INVERSE, length: 2 };
  }
  const upper = ch.toUpperCase();
  const code = charToCode.get(upper);
  if (code === undefined) {
    throw new CharsetError(`Character "${ch}" does not exist on the ZX81`, i);
  }
  return { code, length: 1 };
}

function codeToText(code: number): string {
  if (code === NEWLINE) return '\n';
  const direct = codeToChar.get(code);
  if (direct !== undefined) return direct;
  const uni = GRAPHIC_UNICODE[code];
  if (uni !== undefined) return uni;
  const esc = escapeForCode.get(code);
  if (esc !== undefined) return esc;
  if (code >= 0x80 && code <= 0xbf) {
    const base = codeToChar.get(code & 0x7f);
    if (base !== undefined) return '%' + base;
  }
  return '?';
}

export const zx81Charset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    let i = 0;
    while (i < text.length) {
      const { code, length } = parseChar(text, i);
      out.push(code);
      i += length;
    }
    return Uint8Array.from(out);
  },

  toUnicode(codes: ArrayLike<number>): string {
    let s = '';
    for (let i = 0; i < codes.length; i++) s += codeToText(codes[i]!);
    return s;
  },

  glyph(code: number): string {
    return codeToText(code);
  },
};
