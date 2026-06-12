import { D_FILE } from '../sysvars';
import { NEWLINE } from '../charset';
import type { Zx81Memory } from './memory';

export const DISPLAY_WIDTH = 256; // 32 columns x 8 px
export const DISPLAY_HEIGHT = 192; // 24 rows x 8 px
const CHARSET_ROM_OFFSET = 0x1e00;

/**
 * Render the display file into an RGBA pixel buffer (256x192).
 * The D_FILE is walked row by row (rows terminated by NEWLINE/0x76);
 * glyph bitmaps come straight from the ROM character table at 0x1E00.
 * This is a frame snapshot — perfectly faithful for BASIC programs without
 * cycle-exact video tricks.
 */
export function renderDisplay(
  memory: Zx81Memory,
  pixels: Uint8ClampedArray,
): void {
  pixels.fill(0xff); // white background (and alpha)

  const dfile = memory.readWord(D_FILE);
  if (dfile < 0x4000 || dfile > 0xffff) return;

  let addr = dfile;
  if (memory.read(addr) === NEWLINE) addr++; // leading NEWLINE

  for (let row = 0; row < 24; row++) {
    let col = 0;
    for (;;) {
      const c = memory.read(addr);
      addr++;
      if (c === NEWLINE) break;
      if (col >= 32) break;
      drawGlyph(memory, pixels, row, col, c);
      col++;
    }
  }
}

function drawGlyph(
  memory: Zx81Memory,
  pixels: Uint8ClampedArray,
  row: number,
  col: number,
  code: number,
): void {
  const glyph = code & 0x3f;
  const inverse = (code & 0x80) !== 0;
  const glyphBase = CHARSET_ROM_OFFSET + glyph * 8;
  const x0 = col * 8;
  const y0 = row * 8;

  for (let y = 0; y < 8; y++) {
    let bits = memory.rom[glyphBase + y]!;
    if (inverse) bits = ~bits & 0xff;
    const rowOffset = ((y0 + y) * DISPLAY_WIDTH + x0) * 4;
    for (let x = 0; x < 8; x++) {
      if (bits & (0x80 >> x)) {
        const p = rowOffset + x * 4;
        pixels[p] = 0x10;
        pixels[p + 1] = 0x10;
        pixels[p + 2] = 0x10;
        // alpha already 0xff
      }
    }
  }
}
