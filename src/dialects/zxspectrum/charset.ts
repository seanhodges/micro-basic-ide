import { CharsetError, type CharsetMapping } from '../types';

/**
 * ZX Spectrum character set <-> editor text.
 *
 * The Spectrum is largely ASCII for codes 0x20–0x7F, including lowercase, with
 * three substitutions: 0x5E is ↑ (used for the power operator), 0x60 is £ and
 * 0x7F is ©. Codes 0x80–0x8F are the 2×2 block-graphics characters, written
 * here as Unicode block elements. Keyword tokens (0xA5–0xFF) are handled by the
 * tokenizer, not the charset.
 */

/** Codes 0x80–0x8F: block graphics, by quadrant bits TL=1 TR=2 BL=4 BR=8. */
const GRAPHIC_UNICODE: Record<number, string> = {
  0x80: ' ', // blank graphic (renders as a space)
  0x81: '▘',
  0x82: '▝',
  0x83: '▀',
  0x84: '▖',
  0x85: '▌',
  0x86: '▞',
  0x87: '▛',
  0x88: '▗',
  0x89: '▚',
  0x8a: '▐',
  0x8b: '▜',
  0x8c: '▄',
  0x8d: '▙',
  0x8e: '▟',
  0x8f: '█',
};

const charToCode = new Map<string, number>();
const codeToChar = new Map<number, string>();

// Standard ASCII range, then the Spectrum-specific overrides.
for (let c = 0x20; c <= 0x7e; c++) {
  const ch = String.fromCharCode(c);
  charToCode.set(ch, c);
  codeToChar.set(c, ch);
}
const OVERRIDES: Record<number, string> = {
  0x5e: '↑',
  0x60: '£',
  0x7f: '©',
};
for (const [code, ch] of Object.entries(OVERRIDES)) {
  charToCode.set(ch, Number(code));
  codeToChar.set(Number(code), ch);
}
// Accept '^' and '`' as convenient aliases for ↑ and £.
charToCode.set('^', 0x5e);
charToCode.set('`', 0x60);

for (const [code, ch] of Object.entries(GRAPHIC_UNICODE)) {
  codeToChar.set(Number(code), ch);
  if (ch !== ' ') charToCode.set(ch, Number(code));
}

export const ENTER = 0x0d;
export const NUMBER_MARKER = 0x0e;
export const QUOTE = 0x22;

function codeToText(code: number): string {
  if (code === ENTER) return '\n';
  const direct = codeToChar.get(code);
  if (direct !== undefined) return direct;
  return '?';
}

export const spectrumCharset: CharsetMapping = {
  toMachine(text: string): Uint8Array {
    const out: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      const code = charToCode.get(ch);
      if (code === undefined) {
        throw new CharsetError(
          `Character "${ch}" does not exist on the ZX Spectrum`,
          i,
        );
      }
      out.push(code);
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
