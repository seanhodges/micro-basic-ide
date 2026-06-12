import type { SpectrumMemory } from './memory';

export const DISPLAY_WIDTH = 256; // 32 cells x 8 px
export const DISPLAY_HEIGHT = 192; // 24 cells x 8 px

const SCREEN_BASE = 0x4000;
const ATTR_BASE = 0x5800;

/**
 * The Spectrum palette: a colour component is 0xD7 normally and 0xFF when
 * BRIGHT. Colour bit 0 = blue, bit 1 = red, bit 2 = green. Indexed
 * [bright][colour] -> [r, g, b].
 */
const PALETTE: [number, number, number][][] = [0, 1].map((bright) => {
  const level = bright ? 0xff : 0xd7;
  return Array.from({ length: 8 }, (_, c) => {
    const b = c & 1 ? level : 0;
    const r = c & 2 ? level : 0;
    const g = c & 4 ? level : 0;
    return [r, g, b] as [number, number, number];
  });
});

/** Bitmap byte address for pixel row y (0-191) and byte column xb (0-31). */
function bitmapAddr(y: number, xb: number): number {
  return (
    SCREEN_BASE | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((y & 0xc0) << 5) | xb
  );
}

/**
 * Render the Spectrum screen into an RGBA buffer (256x192). `flashPhase`
 * toggles every ~16 frames; when set, FLASH cells swap ink and paper.
 */
export function renderDisplay(
  memory: SpectrumMemory,
  pixels: Uint8ClampedArray,
  flashPhase: boolean,
): void {
  for (let y = 0; y < DISPLAY_HEIGHT; y++) {
    const charRow = y >> 3;
    const attrRow = ATTR_BASE + charRow * 32;
    for (let xb = 0; xb < 32; xb++) {
      const bits = memory.read(bitmapAddr(y, xb));
      const attr = memory.read(attrRow + xb);
      const bright = (attr >> 6) & 1;
      let ink = attr & 0x07;
      let paper = (attr >> 3) & 0x07;
      if (flashPhase && attr & 0x80) {
        const t = ink;
        ink = paper;
        paper = t;
      }
      const inkRGB = PALETTE[bright]![ink]!;
      const paperRGB = PALETTE[bright]![paper]!;

      let p = (y * DISPLAY_WIDTH + xb * 8) * 4;
      for (let bit = 0; bit < 8; bit++) {
        const on = (bits & (0x80 >> bit)) !== 0;
        const rgb = on ? inkRGB : paperRGB;
        pixels[p] = rgb[0];
        pixels[p + 1] = rgb[1];
        pixels[p + 2] = rgb[2];
        pixels[p + 3] = 0xff;
        p += 4;
      }
    }
  }
}
