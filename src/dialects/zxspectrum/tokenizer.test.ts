import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { decodeSpectrumNumber } from './numbers';

function bytes(src: string): number[] {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return Array.from(bytes);
}

describe('zxspectrum tokenizer', () => {
  it('emits line number (BE), length (LE), body and ENTER', () => {
    // 10 PRINT "HI" -> 00 0A | 06 00 | F5 22 48 49 22 | 0D
    expect(bytes('10 PRINT "HI"\n')).toEqual([
      0x00, 0x0a, 0x06, 0x00, 0xf5, 0x22, 0x48, 0x49, 0x22, 0x0d,
    ]);
  });

  it('stores numeric literals as digits + 0x0E + 5-byte form', () => {
    const b = bytes('10 LET x=42\n');
    const marker = b.indexOf(0x0e);
    expect(marker).toBeGreaterThan(0);
    // The printable digits "42" precede the marker.
    expect(b[marker - 2]).toBe('4'.charCodeAt(0));
    expect(b[marker - 1]).toBe('2'.charCodeAt(0));
    expect(decodeSpectrumNumber(b.slice(marker + 1, marker + 6))).toBe(42);
  });

  it('tokenizes both GO TO and the glued GOTO to the same token', () => {
    const a = bytes('10 GO TO 20\n');
    const c = bytes('10 GOTO 20\n');
    expect(a).toEqual(c);
    expect(a[4]).toBe(0xec); // GO TO token
  });

  it('keeps lowercase and rejects line-leading non-commands', () => {
    expect(bytes('10 PRINT "abc"\n').slice(4)).toEqual([
      0xf5, 0x22, 0x61, 0x62, 0x63, 0x22, 0x0d,
    ]);
    const { errors } = tokenizeProgram('10 x=5\n');
    expect(errors.length).toBe(1);
  });

  it('handles multi-statement lines with colons', () => {
    const b = bytes('10 LET a=1: PRINT a\n');
    expect(b).toContain(0x3a); // the ':' separator
    expect(b).toContain(0xf1); // LET
    expect(b).toContain(0xf5); // PRINT
  });

  it('round-trips through the detokenizer', () => {
    const src =
      '10 REM demo\n20 FOR i=1 TO 10 STEP 2\n30 PRINT AT 0,0;"x=";i\n40 IF i>5 THEN GO TO 60\n50 NEXT i\n60 STOP\n';
    const first = tokenizeProgram(src);
    expect(first.errors).toEqual([]);
    const round = tokenizeProgram(detokenizeProgram(first.bytes));
    expect(Array.from(round.bytes)).toEqual(Array.from(first.bytes));
  });

  it('flags non-ascending and out-of-range line numbers', () => {
    expect(tokenizeProgram('20 PRINT 1\n10 PRINT 2\n').errors.length).toBe(1);
    expect(tokenizeProgram('99999 PRINT 1\n').errors.length).toBe(1);
  });
});
