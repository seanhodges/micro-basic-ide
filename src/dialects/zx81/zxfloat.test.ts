import { describe, expect, it } from 'vitest';
import { decodeZxFloat, encodeZxFloat } from './zxfloat';

const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

describe('encodeZxFloat', () => {
  it('encodes known vectors', () => {
    expect(hex(encodeZxFloat(0))).toBe('00 00 00 00 00');
    expect(hex(encodeZxFloat(1))).toBe('81 00 00 00 00');
    expect(hex(encodeZxFloat(0.5))).toBe('80 00 00 00 00');
    expect(hex(encodeZxFloat(2))).toBe('82 00 00 00 00');
    expect(hex(encodeZxFloat(10))).toBe('84 20 00 00 00');
    expect(hex(encodeZxFloat(-1))).toBe('81 80 00 00 00');
    expect(hex(encodeZxFloat(3))).toBe('82 40 00 00 00');
    expect(hex(encodeZxFloat(100))).toBe('87 48 00 00 00');
  });

  it('round-trips assorted values', () => {
    for (const n of [
      1, -1, 0.1, 3.14159265, 9999, 16514, 0.001, 1e10, -42.5, 65535,
    ]) {
      const decoded = decodeZxFloat(encodeZxFloat(n));
      expect(Math.abs(decoded - n)).toBeLessThanOrEqual(Math.abs(n) * 2 ** -31);
    }
  });

  it('rejects out-of-range values', () => {
    expect(() => encodeZxFloat(Infinity)).toThrow();
    expect(() => encodeZxFloat(1e40)).toThrow();
  });
});
