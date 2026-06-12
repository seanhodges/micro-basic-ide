import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpectrumMachine } from './spectrumMachine';
import { tokenizeProgram } from '../tokenizer';
import { buildTap } from '../tapfile';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/zxspectrum.rom')),
);

/** Map each ROM font glyph (8 bytes) to its character code, for OCR of the screen. */
function fontSignatures(): Map<string, number> {
  const map = new Map<string, number>();
  for (let c = 32; c <= 127; c++) {
    const base = 0x3c00 + c * 8;
    const sig = Array.from({ length: 8 }, (_, i) => rom[base + i]!).join(',');
    if (!map.has(sig)) map.set(sig, c);
  }
  return map;
}
const SIGNATURES = fontSignatures();

function bitmapAddr(y: number, xb: number): number {
  return (
    0x4000 | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((y & 0xc0) << 5) | xb
  );
}

/** Read a run of characters off the screen at char row/col by matching the font. */
function readScreen(
  machine: SpectrumMachine,
  row: number,
  col: number,
  len: number,
): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const xb = col + i;
    const bytes = Array.from({ length: 8 }, (_, r) =>
      machine.mem.read(bitmapAddr(row * 8 + r, xb)),
    );
    const code = SIGNATURES.get(bytes.join(','));
    s += code === undefined ? '?' : String.fromCharCode(code);
  }
  return s;
}

describe('SpectrumMachine', () => {
  it('boots the ROM to the copyright prompt', () => {
    const machine = new SpectrumMachine({ rom });
    machine.reset();
    machine.bootToReady();
    // The bottom line shows "© 1982 Sinclair Research Ltd".
    const line = readScreen(machine, 23, 0, 28);
    expect(line).toContain('1982 Sinclair');
  });

  it('flash-loads and runs 10 PRINT "HELLO"', () => {
    const machine = new SpectrumMachine({ rom });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 50; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 5)).toBe('HELLO');
  });

  it('runs a FOR loop printing multiple rows', () => {
    const machine = new SpectrumMachine({ rom });
    const src = '10 FOR i=1 TO 3\n20 PRINT "ROW";i\n30 NEXT i\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 80; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 4)).toBe('ROW1');
    expect(readScreen(machine, 2, 0, 4)).toBe('ROW3');
  });

  it('responds to emulated keypresses via INKEY$', () => {
    const machine = new SpectrumMachine({ rom });
    const src = '10 IF INKEY$="" THEN GO TO 10\n20 PRINT "KEY ";INKEY$\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 30; i++) machine.runFrame();
    machine.setKey('KeyQ', true);
    for (let i = 0; i < 30; i++) machine.runFrame();
    machine.setKey('KeyQ', false);
    for (let i = 0; i < 30; i++) machine.runFrame();
    expect(readScreen(machine, 0, 0, 5)).toBe('KEY q');
  });
});
