import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Zx81Machine } from './zx81Machine';
import { tokenizeProgram } from '../tokenizer';
import { buildPFile } from '../pfile';
import { D_FILE } from '../sysvars';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../../public/roms/zx81.rom')),
);

function displayBytes(machine: Zx81Machine): number[] {
  const dfile = machine.mem.readWord(D_FILE);
  const out: number[] = [];
  let addr = dfile;
  for (let i = 0; i < 24 * 33 + 1 && addr < 0x10000; i++, addr++) {
    out.push(machine.mem.read(addr));
  }
  return out;
}

function displayContains(machine: Zx81Machine, needle: number[]): boolean {
  const d = displayBytes(machine);
  outer: for (let i = 0; i + needle.length <= d.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (d[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

describe('Zx81Machine', () => {
  it('boots the ROM to the K cursor', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.reset();
    machine.bootToBasic();
    // The boot screen shows the inverse-K cursor (code 0xB0) in the display file
    expect(displayContains(machine, [0xb0])).toBe(true);
  });

  it('flash-loads and runs 10 PRINT "HELLO"', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    // H E L L O in ZX81 codes
    expect(displayContains(machine, [0x2d, 0x2a, 0x31, 0x31, 0x34])).toBe(true);
  });

  it('runs a FOR loop producing multiple lines', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src = '10 FOR I=1 TO 3\n20 PRINT "ROW";I\n30 NEXT I\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 400; i++) machine.runFrame();
    // "ROW3" = R O W 3
    expect(displayContains(machine, [0x37, 0x34, 0x3c, 0x1f])).toBe(true);
  });

  it('responds to emulated keypresses', () => {
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    const src = '10 IF INKEY$="" THEN GOTO 10\n20 PRINT "KEY ";INKEY$\n';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 100; i++) machine.runFrame();
    machine.keyEvent({ code: 'KeyQ' } as KeyboardEvent, true);
    for (let i = 0; i < 100; i++) machine.runFrame();
    machine.keyEvent({ code: 'KeyQ' } as KeyboardEvent, false);
    // "KEY Q"
    expect(displayContains(machine, [0x30, 0x2a, 0x3e, 0x00, 0x36])).toBe(true);
  });
});
