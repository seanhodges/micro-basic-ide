import { describe, expect, it } from 'vitest';
import { buildTap, parseTap } from './tapfile';
import { tokenizeProgram } from './tokenizer';

const program = tokenizeProgram('10 PRINT "HI"\n20 GO TO 10\n').bytes;

describe('zxspectrum .TAP', () => {
  it('builds a header block and a data block with valid parity', () => {
    const tap = buildTap(program);
    // header block: u16 length=19, then 17 header bytes + parity
    expect(tap[0]! | (tap[1]! << 8)).toBe(19);
    let parity = 0;
    for (let i = 2; i < 2 + 18; i++) parity ^= tap[i]!;
    expect(parity).toBe(tap[2 + 18]!); // flag..last XOR == parity byte
  });

  it('records program length and auto-start line in the header', () => {
    const { header, autoStart } = parseTap(buildTap(program));
    expect(header[0]).toBe(0x00); // program type
    expect(header[15]! | (header[16]! << 8)).toBe(program.length);
    expect(autoStart).toBe(10); // first line
  });

  it('round-trips the program area and appends the variables marker', () => {
    const parsed = parseTap(buildTap(program));
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
    expect(parsed.data[parsed.data.length - 1]).toBe(0x80); // empty vars
  });

  it('honours autoStart: null (load-only)', () => {
    expect(
      parseTap(buildTap(program, { autoStart: null })).autoStart,
    ).toBeNull();
  });

  it('rejects non-program images', () => {
    expect(() => parseTap(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
