import { describe, expect, it } from 'vitest';
import { readZx81Variables } from './vars';
import { encodeZxFloat } from './zxfloat';
import { zx81Charset } from './charset';
import { VARS, E_LINE } from './sysvars';

/**
 * A byte-addressable fake of the ZX81 RAM that satisfies the `read`/`readWord`
 * port the decoder needs. Variables are laid out from `start`; the VARS and
 * E_LINE system-variable words are filled in to frame the area.
 */
function makeMem(start: number, bytes: number[]) {
  const ram = new Uint8Array(0x10000);
  const write = (addr: number, ...vals: number[]) =>
    vals.forEach((v, i) => (ram[addr + i] = v & 0xff));
  const writeWord = (addr: number, v: number) =>
    write(addr, v & 0xff, (v >> 8) & 0xff);
  for (let i = 0; i < bytes.length; i++) ram[start + i] = bytes[i]! & 0xff;
  const end = start + bytes.length;
  writeWord(VARS, start);
  writeWord(E_LINE, end);
  return {
    read: (addr: number) => ram[addr]!,
    readWord: (addr: number) => ram[addr]! | (ram[addr + 1]! << 8),
  };
}

// The ZX81 stores the letter's own charset code in the low 5 bits (A = 0x26).
const letterByte = (tag: number, letter: string) =>
  (tag << 5) | (zx81Charset.toMachine(letter)[0]! & 0x1f);
const lenLE = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const TERM = 0x80;

describe('readZx81Variables', () => {
  it('decodes a single-letter number', () => {
    const mem = makeMem(0x4100, [
      letterByte(0b011, 'A'),
      ...encodeZxFloat(5),
      TERM,
    ]);
    expect(readZx81Variables(mem)).toEqual([
      { name: 'A', kind: 'number', value: '5', ref: expect.anything() },
    ]);
  });

  it('decodes a fractional number', () => {
    const mem = makeMem(0x4100, [
      letterByte(0b011, 'A'),
      ...encodeZxFloat(1.5),
      TERM,
    ]);
    expect(readZx81Variables(mem)[0]).toMatchObject({ value: '1.5' });
  });

  it('decodes a string variable', () => {
    const chars = Array.from(zx81Charset.toMachine('HI'));
    const mem = makeMem(0x4100, [
      letterByte(0b010, 'B'),
      ...lenLE(chars.length),
      ...chars,
      TERM,
    ]);
    expect(readZx81Variables(mem)).toEqual([
      { name: 'B$', kind: 'string', value: '"HI"', ref: expect.anything() },
    ]);
  });

  it('decodes a FOR-NEXT control variable using its current value', () => {
    const mem = makeMem(0x4100, [
      letterByte(0b111, 'I'),
      ...encodeZxFloat(2), // current value
      ...encodeZxFloat(3), // limit
      ...encodeZxFloat(1), // step
      ...lenLE(10), // loop line
      TERM,
    ]);
    expect(readZx81Variables(mem)).toEqual([
      { name: 'I', kind: 'number', value: '2', ref: expect.anything() },
    ]);
  });

  it('decodes a number array as a compact summary', () => {
    const elems = [
      ...encodeZxFloat(7),
      ...encodeZxFloat(8),
      ...encodeZxFloat(0),
    ];
    const body = [1 /* dims */, ...lenLE(3) /* dim size */, ...elems];
    const mem = makeMem(0x4100, [
      letterByte(0b100, 'C'),
      ...lenLE(body.length),
      ...body,
      TERM,
    ]);
    expect(readZx81Variables(mem)).toEqual([
      {
        name: 'C()',
        kind: 'number-array',
        value: '[3] = 7, 8, 0',
        ref: expect.anything(),
      },
    ]);
  });

  it('reads several variables in sequence and stops at the terminator', () => {
    const chars = Array.from(zx81Charset.toMachine('HI'));
    const mem = makeMem(0x4100, [
      letterByte(0b011, 'A'),
      ...encodeZxFloat(5),
      letterByte(0b010, 'B'),
      ...lenLE(chars.length),
      ...chars,
      TERM,
    ]);
    expect(readZx81Variables(mem).map((v) => v.name)).toEqual(['A', 'B$']);
  });

  it('does not read past E_LINE even without a terminator', () => {
    // Two numbers' worth of bytes, but E_LINE is framed to one entry.
    const ram = new Uint8Array(0x10000);
    const start = 0x4100;
    const bytes = [
      letterByte(0b011, 'A'),
      ...encodeZxFloat(5),
      letterByte(0b011, 'B'),
      ...encodeZxFloat(9),
    ];
    bytes.forEach((b, i) => (ram[start + i] = b));
    ram[VARS] = start & 0xff;
    ram[VARS + 1] = (start >> 8) & 0xff;
    const end = start + 6; // only the first entry is in range
    ram[E_LINE] = end & 0xff;
    ram[E_LINE + 1] = (end >> 8) & 0xff;
    const mem = {
      read: (a: number) => ram[a]!,
      readWord: (a: number) => ram[a]! | (ram[a + 1]! << 8),
    };
    expect(readZx81Variables(mem).map((v) => v.name)).toEqual(['A']);
  });
});
