import { describe, it, expect } from 'vitest';
import {
  parseLines,
  computeNewLineNumber,
  makeSpace,
  rewriteReferences,
  renumberLine,
  applyRenumberMap,
  insertNumberedLineBelow,
} from './lineNumbering';

describe('parseLines', () => {
  it('parses numbered lines and skips blanks and unnumbered lines', () => {
    const lines = parseLines('10 PRINT\n\n  20 GOTO 10\nHELLO\n30');
    expect(lines).toEqual([
      { lineNo: 10, body: 'PRINT', raw: '10 PRINT' },
      { lineNo: 20, body: 'GOTO 10', raw: '20 GOTO 10' },
      { lineNo: 30, body: '', raw: '30' },
    ]);
  });
});

describe('computeNewLineNumber', () => {
  it('starts an empty file at the increment', () => {
    expect(computeNewLineNumber(null, null, 10)).toEqual({ lineNo: 10, makeSpace: false });
    expect(computeNewLineNumber(null, null, 100)).toEqual({ lineNo: 100, makeSpace: false });
  });

  it('appends at the end of file', () => {
    expect(computeNewLineNumber(20, null, 10)).toEqual({ lineNo: 30, makeSpace: false });
  });

  it('uses the rounded-down midpoint between two lines', () => {
    expect(computeNewLineNumber(10, 15, 10)).toEqual({ lineNo: 12, makeSpace: false });
  });

  it('signals makeSpace when adjacent lines leave no gap', () => {
    expect(computeNewLineNumber(12, 13, 10)).toEqual({ lineNo: 13, makeSpace: true });
  });

  it('handles inserting at the top of the file', () => {
    expect(computeNewLineNumber(null, 20, 10)).toEqual({ lineNo: 10, makeSpace: false });
    expect(computeNewLineNumber(null, 1, 10)).toEqual({ lineNo: 1, makeSpace: true });
  });
});

describe('makeSpace', () => {
  it('cascades a run of adjacent lines until a gap', () => {
    const lines = parseLines('10 A\n11 B\n12 C\n20 D');
    expect(makeSpace(lines, 10, 10)).toEqual(new Map([[11, 12], [12, 13]]));
  });

  it('shifts only the single colliding line', () => {
    const lines = parseLines('10 A\n11 B\n30 C');
    expect(makeSpace(lines, 10, 10)).toEqual(new Map([[11, 12]]));
  });

  it('returns an empty map when the cascade would overflow 9999', () => {
    const lines = parseLines('9997 A\n9998 B\n9999 C');
    expect(makeSpace(lines, 9997, 10)).toEqual(new Map());
  });
});

describe('rewriteReferences', () => {
  it('rewrites GOTO and GOSUB targets', () => {
    expect(rewriteReferences('20 GOTO 10', new Map([[10, 15]]))).toBe('20 GOTO 15');
    expect(rewriteReferences('20 GOSUB 10', new Map([[10, 15]]))).toBe('20 GOSUB 15');
  });

  it('rewrites THEN GOTO / THEN GOSUB', () => {
    expect(rewriteReferences('20 IF A=1 THEN GOTO 10', new Map([[10, 15]]))).toBe(
      '20 IF A=1 THEN GOTO 15',
    );
  });

  it('rewrites RUN / LIST / LLIST targets', () => {
    expect(rewriteReferences('20 RUN 10', new Map([[10, 15]]))).toBe('20 RUN 15');
    expect(rewriteReferences('20 LIST 10', new Map([[10, 15]]))).toBe('20 LIST 15');
    expect(rewriteReferences('20 LLIST 10', new Map([[10, 15]]))).toBe('20 LLIST 15');
  });

  it('leaves numbers inside strings untouched', () => {
    expect(rewriteReferences('30 PRINT "GOTO 10"', new Map([[10, 15]]))).toBe(
      '30 PRINT "GOTO 10"',
    );
  });

  it('leaves REM comments untouched', () => {
    expect(rewriteReferences('40 REM GOTO 10', new Map([[10, 15]]))).toBe('40 REM GOTO 10');
  });

  it('leaves computed targets untouched', () => {
    expect(rewriteReferences('50 GOTO X+1', new Map([[10, 15]]))).toBe('50 GOTO X+1');
  });
});

describe('applyRenumberMap', () => {
  it('applies a cascade without double-applying', () => {
    const src = '10 A\n12 GOTO 13\n13 GOTO 12';
    const result = applyRenumberMap(src, new Map([[12, 13], [13, 14]]));
    expect(result).toBe('10 A\n13 GOTO 14\n14 GOTO 13');
  });
});

describe('renumberLine', () => {
  it('renames a line and rewrites references, re-sorting ascending', () => {
    const src = '10 PRINT\n20 GOTO 10\n30 GOSUB 10';
    expect(renumberLine(src, 10, 25)).toBe('20 GOTO 25\n25 PRINT\n30 GOSUB 25');
  });

  it('is a no-op when the target equals the source', () => {
    expect(renumberLine('10 PRINT', 10, 10)).toBe('10 PRINT');
  });
});

describe('insertNumberedLineBelow', () => {
  it('numbers the first line of an empty file and adds the next line', () => {
    const r = insertNumberedLineBelow(['PRINT "HI"'], 0, 10)!;
    expect(r.lines).toEqual(['10 PRINT "HI"', '20 ']);
    expect(r.cursorLine).toBe(1);
  });

  it('appends with the increment at the end of file', () => {
    const r = insertNumberedLineBelow(['10 PRINT', '20 PRINT'], 1, 10)!;
    expect(r.lines).toEqual(['10 PRINT', '20 PRINT', '30 ']);
  });

  it('uses a midpoint between interior lines', () => {
    const r = insertNumberedLineBelow(['10 PRINT', '15 PRINT'], 0, 10)!;
    expect(r.lines).toEqual(['10 PRINT', '12 ', '15 PRINT']);
    expect(r.cursorLine).toBe(1);
  });

  it('cascades adjacent lines and fixes references when there is no gap', () => {
    const r = insertNumberedLineBelow(['12 PRINT', '13 GOTO 12'], 0, 10)!;
    expect(r.lines).toEqual(['12 PRINT', '13 ', '14 GOTO 12']);
  });

  it('respects a custom increment', () => {
    const r = insertNumberedLineBelow(['100 PRINT'], 0, 100)!;
    expect(r.lines).toEqual(['100 PRINT', '200 ']);
  });

  it('skips a blank current line', () => {
    expect(insertNumberedLineBelow([''], 0, 10)).toBeNull();
  });
});
