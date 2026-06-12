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

  it('tokenize passes source through as the image', () => {
    const result = bbcmicro.tokenize('10 PRINT "HI"\n');
    expect(result.errors).toEqual([]);
    expect(result.image.length).toBeGreaterThan(0);
    expect(bbcmicro.detokenize(result.image)).toBe('10 PRINT "HI"\n');
  });

  it('lint reports charset errors with line and column', () => {
    const errors = bbcmicro.lint('10 PRINT "OK"\n20 PRINT "★"');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(2);
    expect(errors[0]!.column).toBe(10);
  });

  it('bundled samples lint clean', () => {
    for (const sample of bbcmicro.samples) {
      expect(bbcmicro.lint(sample.text)).toEqual([]);
    }
  });
});
