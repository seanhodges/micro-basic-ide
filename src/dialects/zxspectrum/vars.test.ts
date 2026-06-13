import { describe, expect, it } from 'vitest';
import { readSpectrumVariables } from './vars';
import { encodeSpectrumNumber } from './numbers';
import { spectrumCharset } from './charset';
import { VARS, E_LINE } from './sysvars';

/** Byte-addressable fake RAM satisfying the decoder's read/readWord port. */
function makeMem(start: number, bytes: number[]) {
  const ram = new Uint8Array(0x10000);
  const writeWord = (addr: number, v: number) => {
    ram[addr] = v & 0xff;
    ram[addr + 1] = (v >> 8) & 0xff;
  };
  for (let i = 0; i < bytes.length; i++) ram[start + i] = bytes[i]! & 0xff;
  writeWord(VARS, start);
  writeWord(E_LINE, start + bytes.length);
  return {
    read: (addr: number) => ram[addr]!,
    readWord: (addr: number) => ram[addr]! | (ram[addr + 1]! << 8),
  };
}

// Spectrum stores names as lowercase ASCII in the low 5 bits (a = 0x01).
const letterByte = (tag: number, letter: string) =>
  (tag << 5) | (letter.toLowerCase().charCodeAt(0) & 0x1f);
const lenLE = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const TERM = 0x80;

describe('readSpectrumVariables', () => {
  it('decodes a number in the small-integer short form', () => {
    const mem = makeMem(0x6000, [
      letterByte(0b011, 'A'),
      ...encodeSpectrumNumber(5),
      TERM,
    ]);
    expect(readSpectrumVariables(mem)).toEqual([
      { name: 'A', kind: 'number', value: '5', ref: expect.anything() },
    ]);
  });

  it('decodes a number in the floating-point form', () => {
    const mem = makeMem(0x6000, [
      letterByte(0b011, 'A'),
      ...encodeSpectrumNumber(1.5),
      TERM,
    ]);
    expect(readSpectrumVariables(mem)[0]).toMatchObject({ value: '1.5' });
  });

  it('decodes a string variable (ASCII)', () => {
    const chars = Array.from(spectrumCharset.toMachine('HI'));
    const mem = makeMem(0x6000, [
      letterByte(0b010, 'B'),
      ...lenLE(chars.length),
      ...chars,
      TERM,
    ]);
    expect(readSpectrumVariables(mem)).toEqual([
      { name: 'B$', kind: 'string', value: '"HI"', ref: expect.anything() },
    ]);
  });

  it('decodes a FOR-NEXT control variable (19-byte entry)', () => {
    const mem = makeMem(0x6000, [
      letterByte(0b111, 'I'),
      ...encodeSpectrumNumber(2), // current value
      ...encodeSpectrumNumber(3), // limit
      ...encodeSpectrumNumber(1), // step
      ...lenLE(10), // loop line
      0x02, // statement number (Spectrum-only)
      TERM,
    ]);
    expect(readSpectrumVariables(mem)).toEqual([
      { name: 'I', kind: 'number', value: '2', ref: expect.anything() },
    ]);
  });

  it('decodes a number array as a compact summary', () => {
    const elems = [
      ...encodeSpectrumNumber(7),
      ...encodeSpectrumNumber(8),
      ...encodeSpectrumNumber(0),
    ];
    const body = [1, ...lenLE(3), ...elems];
    const mem = makeMem(0x6000, [
      letterByte(0b100, 'C'),
      ...lenLE(body.length),
      ...body,
      TERM,
    ]);
    expect(readSpectrumVariables(mem)).toEqual([
      {
        name: 'C()',
        kind: 'number-array',
        value: '[3] = 7, 8, 0',
        ref: expect.anything(),
      },
    ]);
  });
});
