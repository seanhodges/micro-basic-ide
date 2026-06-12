/**
 * ZX81 5-byte floating point format (shared with the ZX Spectrum, but the
 * ZX81 has no small-integer shortcut):
 *
 *   byte 0:      exponent e+0x80, where value = mantissa * 2^e and
 *                mantissa ∈ [0.5, 1). A zero exponent byte means value 0.
 *   bytes 1..4:  mantissa, MSB first. The top bit of byte 1 — which is
 *                always 1 for a normalized mantissa — is replaced by the
 *                sign bit (0 = positive, 1 = negative).
 */

export function encodeZxFloat(n: number): Uint8Array {
  const out = new Uint8Array(5);
  if (n === 0) return out;
  if (!Number.isFinite(n))
    throw new RangeError(`Cannot encode ${n} as ZX81 float`);

  const negative = n < 0;
  const m = Math.abs(n);

  let e = Math.floor(Math.log2(m)) + 1;
  let frac = m / 2 ** e; // in [0.5, 1) up to fp error
  if (frac >= 1) {
    e += 1;
    frac /= 2;
  } else if (frac < 0.5) {
    e -= 1;
    frac *= 2;
  }

  let mant = Math.round(frac * 2 ** 32);
  if (mant >= 2 ** 32) {
    // Rounding overflowed the mantissa: 0.111...1 -> 1.0
    mant = 2 ** 31;
    e += 1;
  }

  if (e < -127 || e > 127)
    throw new RangeError(`Number out of ZX81 float range: ${n}`);

  out[0] = (e + 0x80) & 0xff;
  out[1] = (mant >>> 24) & 0xff;
  out[2] = (mant >>> 16) & 0xff;
  out[3] = (mant >>> 8) & 0xff;
  out[4] = mant & 0xff;

  const sign = negative ? 0x80 : 0x00;
  out[1] = (out[1]! & 0x7f) | sign;
  return out;
}

export function decodeZxFloat(bytes: ArrayLike<number>, offset = 0): number {
  const exp = bytes[offset]!;
  if (exp === 0) return 0;
  const b1 = bytes[offset + 1]!;
  const negative = (b1 & 0x80) !== 0;
  const mant =
    ((b1 | 0x80) >>> 0) * 2 ** 24 +
    bytes[offset + 2]! * 2 ** 16 +
    bytes[offset + 3]! * 2 ** 8 +
    bytes[offset + 4]!;
  const value = (mant / 2 ** 32) * 2 ** (exp - 0x80);
  return negative ? -value : value;
}
