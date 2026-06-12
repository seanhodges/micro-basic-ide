import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

describe('tokenizeProgram', () => {
  it('produces the exact bytes for 10 PRINT "HELLO"', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual([
      0x00,
      0x0a, // line 10, big-endian
      0x09,
      0x00, // length 9, little-endian (body 8 + NEWLINE)
      0xf5, // PRINT
      0x0b, // "
      0x2d,
      0x2a,
      0x31,
      0x31,
      0x34, // H E L L O
      0x0b, // "
      0x76, // NEWLINE
    ]);
  });

  it('encodes numeric literals with the 0x7E float marker', () => {
    const { bytes, errors } = tokenizeProgram('10 GOTO 10\n');
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual([
      0x00,
      0x0a,
      0x0a,
      0x00, // GOTO + "10" + 0x7E + 5 float bytes + NEWLINE = 10
      0xec, // GOTO
      0x1d,
      0x1c, // "1" "0"
      0x7e,
      0x84,
      0x20,
      0x00,
      0x00,
      0x00, // marker + float 10
      0x76,
    ]);
  });

  it('does not tokenize keywords inside strings or REM', () => {
    const { bytes, errors } = tokenizeProgram(
      '10 PRINT "STOP"\n20 REM RUN FOR FUN\n',
    );
    expect(errors).toEqual([]);
    const arr = Array.from(bytes);
    expect(arr).not.toContain(0xe3); // STOP token
    expect(arr.filter((b) => b === 0xf7)).toEqual([]); // RUN token
  });

  it('does not match keywords glued to identifiers', () => {
    // ATOL: AT and TO must not fire inside it
    const { errors } = tokenizeProgram('10 LET ATOL=1\n');
    expect(errors).toEqual([]);
    const { bytes } = tokenizeProgram('10 LET ATOL=1\n');
    const arr = Array.from(bytes);
    expect(arr).not.toContain(0xc1); // AT
    expect(arr).not.toContain(0xdf); // TO
  });

  it('treats digits in identifiers as characters, not literals', () => {
    const { bytes, errors } = tokenizeProgram('10 LET A1=2\n');
    expect(errors).toEqual([]);
    const arr = Array.from(bytes);
    // exactly one float marker (for the 2)
    expect(arr.filter((b) => b === 0x7e).length).toBe(1);
  });

  it('handles "" as the quote-image inside strings', () => {
    const { bytes } = tokenizeProgram('10 PRINT "A""B"\n');
    expect(Array.from(bytes)).toContain(0xc0);
  });

  it('rejects lines that do not start with a statement keyword', () => {
    const { errors } = tokenizeProgram('10 A=5\n');
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/statement keyword/);
  });

  it('rejects out-of-order and out-of-range line numbers', () => {
    expect(tokenizeProgram('20 CLS\n10 CLS\n').errors.length).toBe(1);
    expect(tokenizeProgram('0 CLS\n').errors.length).toBe(1);
    expect(tokenizeProgram('10000 CLS\n').errors.length).toBe(1);
  });

  it('reports unterminated strings', () => {
    const { errors } = tokenizeProgram('10 PRINT "OOPS\n');
    expect(errors[0]!.message).toMatch(/Unterminated/);
  });

  it('round-trips a representative program', () => {
    const src = [
      '10 REM SIMPLE GAME',
      '20 LET S=0',
      '30 LET X=15',
      '40 PRINT AT 10,X;"*"',
      '50 IF INKEY$="8" THEN LET X=X+1',
      '60 IF INKEY$="5" THEN LET X=X-1',
      '70 IF X<0 OR X>31 THEN GOTO 100',
      '80 LET S=S+1',
      '90 GOTO 40',
      '100 PRINT AT 0,0;"SCORE ";S',
      '110 PAUSE 100',
      '120 RUN',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(normalize(detokenizeProgram(bytes))).toBe(normalize(src));
  });

  it('round-trips graphics and inverse video', () => {
    const src = '10 PRINT "▌▀█ %A%B \\!. OK"';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(normalize(detokenizeProgram(bytes))).toBe(normalize(src));
  });
});
