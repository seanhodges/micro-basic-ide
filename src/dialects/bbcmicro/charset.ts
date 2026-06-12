import { CharsetError, type CharsetMapping } from '../types';

/**
 * BBC Micro character mapping: 7-bit ASCII with one quirk — code 0x60 (ASCII
 * backquote) displays as £ on the Beeb. The editor accepts both '£' and '`'
 * for it and always shows '£'.
 */
const POUND = 0x60;

export const bbcCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (ch === '\n') {
        out[i] = 0x0a;
        continue;
      }
      if (ch === '£' || ch === '`') {
        out[i] = POUND;
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) {
        throw new CharsetError(
          `Character ${JSON.stringify(ch)} has no BBC Micro equivalent`,
          i,
        );
      }
      out[i] = code;
    }
    return out;
  },

  toUnicode(codes: ArrayLike<number>): string {
    let text = '';
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!;
      if (code === 0x0a || code === 0x0d) text += '\n';
      else if (code === POUND) text += '£';
      else if (code >= 0x20 && code <= 0x7e) text += String.fromCharCode(code);
      else text += '?';
    }
    return text;
  },

  glyph(code: number): string {
    if (code === POUND) return '£';
    if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
    return '?';
  },
};
