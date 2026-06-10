import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { buildPFile, parsePFile } from './pfile';
import * as sv from './sysvars';

const word = (img: Uint8Array, addr: number) =>
  img[addr - sv.SYSVARS_BASE]! | (img[addr - sv.SYSVARS_BASE + 1]! << 8);

describe('buildPFile', () => {
  const { bytes: program } = tokenizeProgram('10 PRINT "HELLO"\n20 GOTO 10\n');

  it('lays out consistent system variables', () => {
    const img = buildPFile(program);
    const dFile = word(img, sv.D_FILE);
    const vars = word(img, sv.VARS);
    const eLine = word(img, sv.E_LINE);

    expect(dFile).toBe(sv.PROGRAM_BASE + program.length);
    expect(vars).toBe(dFile + 25);
    expect(eLine).toBe(vars + 1);
    // File covers 0x4009 .. E_LINE-1
    expect(img.length).toBe(eLine - sv.SYSVARS_BASE);
    // Display file: 25 NEWLINEs
    for (let i = 0; i < 25; i++) {
      expect(img[dFile - sv.SYSVARS_BASE + i]).toBe(0x76);
    }
    // Variables terminator
    expect(img[vars - sv.SYSVARS_BASE]).toBe(0x80);
    // Auto-run points at the first program line
    expect(word(img, sv.NXTLIN)).toBe(sv.PROGRAM_BASE);
    // SLOW mode flag
    expect(img[sv.CDFLAG - sv.SYSVARS_BASE]).toBe(0x40);
  });

  it('supports no-autorun and FAST options', () => {
    const img = buildPFile(program, { autoRun: false, slow: false });
    expect(word(img, sv.NXTLIN)).toBe(word(img, sv.D_FILE));
    expect(img[sv.CDFLAG - sv.SYSVARS_BASE]).toBe(0x00);
  });

  it('round-trips through parsePFile', () => {
    const img = buildPFile(program);
    const parsed = parsePFile(img);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('rejects garbage', () => {
    expect(() => parsePFile(new Uint8Array(10))).toThrow();
    expect(() => parsePFile(new Uint8Array(300))).toThrow();
  });
});
