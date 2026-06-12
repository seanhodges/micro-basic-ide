import { describe, expect, it } from 'vitest';
import { bbcCharset } from './charset';
import { bbcmicro } from './index';
import { getDialect } from '../registry';

describe('BBC charset', () => {
  it('round-trips printable ASCII', () => {
    const text = '10 PRINT "HELLO, WORLD!"; 2*3\n20 END';
    expect(bbcCharset.toUnicode(bbcCharset.toMachine(text))).toBe(text);
  });

  it('maps £ (and backquote) to 0x60 and back', () => {
    expect(Array.from(bbcCharset.toMachine('£'))).toEqual([0x60]);
    expect(Array.from(bbcCharset.toMachine('`'))).toEqual([0x60]);
    expect(bbcCharset.toUnicode([0x60])).toBe('£');
  });

  it('rejects characters with no BBC equivalent', () => {
    expect(() => bbcCharset.toMachine('10 PRINT "█"')).toThrow();
  });
});

describe('BBC dialect', () => {
  it('is registered', () => {
    expect(getDialect('bbcmicro')).toBe(bbcmicro);
  });

  it('tokenizes to the BASIC II layout and round-trips', () => {
    const result = bbcmicro.tokenize('10 PRINT "HI"\n');
    expect(result.errors).toEqual([]);
    // 0x0D, line 0x000A, len, body…, 0x0D 0xFF end marker.
    expect(Array.from(result.image.slice(0, 3))).toEqual([0x0d, 0x00, 0x0a]);
    expect(Array.from(result.image.slice(-2))).toEqual([0x0d, 0xff]);
    expect(result.image).toContain(0xf1); // PRINT token
    expect(bbcmicro.detokenize(result.image)).toBe('10 PRINT "HI"\n');
  });

  it('reports an empty image (but no error) for a blank program', () => {
    expect(bbcmicro.tokenize('').image.length).toBe(0);
  });

  it('lint reports charset errors with line and column', () => {
    const errors = bbcmicro.lint('10 PRINT "OK"\n20 PRINT "★"');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(2);
    expect(errors[0]!.column).toBe(10);
  });

  it('declares a .bbc binary import/export format', () => {
    expect(bbcmicro.binaryImport?.extension).toBe('.bbc');
    expect(bbcmicro.buildTargets.map((t) => t.fileExtension)).toContain('bbc');
  });

  it('bundled samples lint clean', () => {
    for (const sample of bbcmicro.samples) {
      expect(bbcmicro.lint(sample.text)).toEqual([]);
    }
  });
});
