import { describe, expect, it } from 'vitest';
import { spectrumCharset } from './charset';
import { CharsetError } from '../types';

describe('zxspectrum charset', () => {
  it('maps ASCII printable characters directly', () => {
    expect(Array.from(spectrumCharset.toMachine('Ab9 !'))).toEqual([
      0x41, 0x62, 0x39, 0x20, 0x21,
    ]);
  });

  it('substitutes ↑, £ and © for their Spectrum codes', () => {
    expect(Array.from(spectrumCharset.toMachine('↑£©'))).toEqual([
      0x5e, 0x60, 0x7f,
    ]);
    expect(spectrumCharset.toUnicode([0x5e, 0x60, 0x7f])).toBe('↑£©');
  });

  it('accepts ^ and ` as aliases for ↑ and £', () => {
    expect(Array.from(spectrumCharset.toMachine('^`'))).toEqual([0x5e, 0x60]);
  });

  it('maps block-graphics unicode to codes 0x80-0x8F', () => {
    expect(Array.from(spectrumCharset.toMachine('█▌▀'))).toEqual([
      0x8f, 0x85, 0x83,
    ]);
    expect(spectrumCharset.toUnicode([0x8f, 0x85, 0x83])).toBe('█▌▀');
  });

  it('throws CharsetError on characters outside the set', () => {
    expect(() => spectrumCharset.toMachine('€')).toThrow(CharsetError);
  });
});
