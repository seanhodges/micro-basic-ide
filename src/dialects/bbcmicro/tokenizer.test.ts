import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import * as utils from 'jsbeeb/src/utils.js';
import * as Tokeniser from 'jsbeeb/src/basic-tokenise.js';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { encodeLineNumber, decodeLineNumber } from './lineNumber';
import { bbcSamples } from './samples';

// The genuine BASIC ROM tokeniser, used as the reference oracle.
let oracle: Tokeniser.Tokeniser;
beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  utils.setNodeBasePath(path.dirname(path.dirname(utilsPath)));
  oracle = await Tokeniser.create();
}, 30000);

function romBytes(source: string): number[] {
  return [...oracle.tokenise(source)].map((c) => c.charCodeAt(0));
}

/**
 * The native tokenizer's whole reason to exist is to reproduce the ROM exactly,
 * so the strongest test is a byte-for-byte diff against it across the grammar.
 */
const CORPUS: string[] = [
  '10 PRINT "HELLO, WORLD!"',
  '10 PRINT "HELLO": GOTO 10',
  '10 GOTO 100\n20 GOSUB 9999\n100 END',
  '10 IF X=1 THEN 50 ELSE 60',
  '10 IF A THEN PRINT "Y" ELSE PRINT "N"',
  '10 IF A THEN TIME=0',
  '10 FOR I=1 TO 10 STEP 2\n20 NEXT I',
  '10 REM this comment: has GOTO and PRINT in it',
  '10 DATA 1,2,PRINT,"x":not split',
  '10 RESTORE 70\n20 ON X GOTO 10,20,30',
  '10 LIST 10,20\n20 RENUMBER 100,10\n30 DELETE 5,9\n40 TRACE 100\n50 AUTO 100,5',
  '10 TIME=0\n20 PRINT TIME\n30 HIMEM=PAGE\n40 X=PTR#1\n50 LOMEM=&E00',
  '10 PROCdraw(1,2)\n20 DEF PROCdraw(a,b)\n30 ENDPROC',
  '10 X=FNsquare(5)\n20 DEF FNsquare(n)=n*n',
  '10 PRINT &FF00, &A0, &ABS',
  '10 X=TRUE:Y=FALSE:Z=PI',
  '10 TIMER=1:ENDING=2:FORMAT=3:TOTAL=4',
  '10 PRINT TAB(5);"x";SPC(3);CHR$(65)',
  '10 PRINT INSTR("abc","b"),LEFT$(A$,2),MID$(A$,1,2),RIGHT$(A$,2)',
  '10 X=STRING$(3,"-"):PRINT X',
  '10 *KEY0 OLD|M RUN|M',
  '10 MODE 7:COLOUR 129:CLS',
  '10 VDU 23,1,0;0;0;0;',
  '10 REPEAT:PRINT X:UNTIL X>10',
  '10 A%=5:B$="hi":C=3.14',
  '10 PRINTTIME:ELSEPRINT:GOTOX',
  '10 ON ERROR GOTO 100',
  '1 PRINT 1\n2 PRINT 2\n65279 PRINT "last"',
];

describe('BBC tokenizer vs the genuine BASIC ROM', () => {
  it('produces byte-identical output across the grammar', () => {
    for (const source of CORPUS) {
      const { bytes, errors } = tokenizeProgram(source);
      expect(
        errors,
        `${JSON.stringify(source)}: ${JSON.stringify(errors)}`,
      ).toEqual([]);
      expect(
        Array.from(bytes),
        `mismatch for ${JSON.stringify(source)}`,
      ).toEqual(romBytes(source));
    }
  }, 30000);

  // Known limitation: the ROM expands dot-abbreviations (P. -> PRINT); the
  // native tokenizer does not, treating "P" as a variable. The editor and
  // detokenizer only ever emit full keywords, so this only affects hand-typed
  // abbreviations.
  it('does not expand dot-abbreviations (documented limitation)', () => {
    const { bytes } = tokenizeProgram('10 P."hi"');
    // 'P' '.' kept literally rather than the PRINT token 0xF1.
    expect(Array.from(bytes)).not.toContain(0xf1);
    expect(Array.from(bytes)).toContain('P'.charCodeAt(0));
  });

  it('tokenizes the bundled samples exactly as the ROM does', () => {
    for (const sample of bbcSamples) {
      const { bytes, errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(Array.from(bytes), `${sample.name} bytes`).toEqual(
        romBytes(sample.text),
      );
    }
  }, 30000);
});

describe('BBC detokenizer', () => {
  it('round-trips every corpus program back to its source', () => {
    for (const source of CORPUS) {
      const { bytes } = tokenizeProgram(source);
      const expected = source.endsWith('\n') ? source : source + '\n';
      expect(
        detokenizeProgram(bytes),
        `round-trip ${JSON.stringify(source)}`,
      ).toBe(expected);
    }
  });

  it('decodes a real ROM-tokenized program', () => {
    const source = '10 GOTO 20\n20 PRINT TIME';
    const bytes = Uint8Array.from(romBytes(source));
    expect(detokenizeProgram(bytes)).toBe(source + '\n');
  });
});

describe('BBC line-number codec', () => {
  it('round-trips every line number', () => {
    for (const n of [0, 1, 10, 50, 100, 255, 256, 1000, 32767, 65279]) {
      const [, b1, b2, b3] = encodeLineNumber(n);
      expect(decodeLineNumber(b1, b2, b3)).toBe(n);
    }
  });
});

describe('BBC tokenizer linting', () => {
  it('flags a missing line number', () => {
    const errors = tokenizeProgram('PRINT "no number"\n').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/line number/i);
  });

  it('flags non-ascending line numbers', () => {
    const errors = tokenizeProgram('20 PRINT 1\n10 PRINT 2\n').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(2);
  });

  it('flags an out-of-range line number', () => {
    const errors = tokenizeProgram('70000 PRINT 1\n').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/out of range/);
  });

  it('reports charset errors with line and column', () => {
    const errors = tokenizeProgram('10 PRINT "OK"\n20 PRINT "★"').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(2);
    expect(errors[0]!.column).toBe(10);
  });
});
