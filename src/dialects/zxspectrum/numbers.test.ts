import { describe, expect, it } from 'vitest';
import { encodeSpectrumNumber, decodeSpectrumNumber } from './numbers';

describe('zxspectrum numbers', () => {
  it('uses the small-integer short form for whole numbers', () => {
    expect(Array.from(encodeSpectrumNumber(0))).toEqual([0, 0, 0, 0, 0]);
    expect(Array.from(encodeSpectrumNumber(1))).toEqual([0, 0, 1, 0, 0]);
    expect(Array.from(encodeSpectrumNumber(258))).toEqual([0, 0, 2, 1, 0]);
    expect(Array.from(encodeSpectrumNumber(-1))).toEqual([0, 0xff, 1, 0, 0]);
  });

  it('uses the floating-point form for non-integers and large values', () => {
    expect(encodeSpectrumNumber(3.5)[0]).not.toBe(0); // exponent byte set
    expect(encodeSpectrumNumber(100000)[0]).not.toBe(0);
  });

  it('round-trips a spread of values', () => {
    for (const n of [0, 1, -1, 42, 65535, -65535, 0.5, 3.14159, -2.5, 1e6]) {
      expect(decodeSpectrumNumber(encodeSpectrumNumber(n))).toBeCloseTo(n, 4);
    }
  });
});
