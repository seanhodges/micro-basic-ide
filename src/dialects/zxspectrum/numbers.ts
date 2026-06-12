/**
 * ZX Spectrum numeric literal encoding.
 *
 * A numeric constant in a tokenized line is its printable digits followed by
 * the number marker 0x0E and a 5-byte form. The Spectrum supports two layouts,
 * distinguished by the first byte:
 *
 *  - Small integer (exponent byte 0): [0x00, sign, low, high, 0x00] for values
 *    in -65535..65535. sign is 0x00 (positive) or 0xFF (negative); low/high are
 *    the magnitude, little-endian.
 *  - Floating point (exponent byte != 0): exponent e+0x80 then a 4-byte
 *    mantissa, MSB first, whose top bit carries the sign (0 = +, 1 = -). The
 *    mantissa is normalized to [0.5, 1).
 *
 * The interpreter reads whichever form is present, so either is valid for a
 * given value; we emit the compact integer form when we can and fall back to
 * the float form otherwise. Zero is the all-zero integer form.
 */

export function encodeSpectrumNumber(n: number): Uint8Array {
  if (!Number.isFinite(n))
    throw new RangeError(`Cannot encode ${n} as a Spectrum number`);

  const out = new Uint8Array(5);
  if (n === 0) return out;

  // Small-integer short form.
  if (Number.isInteger(n) && Math.abs(n) <= 0xffff) {
    const magnitude = Math.abs(n);
    out[0] = 0x00;
    out[1] = n < 0 ? 0xff : 0x00;
    out[2] = magnitude & 0xff;
    out[3] = (magnitude >> 8) & 0xff;
    out[4] = 0x00;
    return out;
  }

  // Floating-point form.
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
    mant = 2 ** 31;
    e += 1;
  }
  if (e < -127 || e > 127)
    throw new RangeError(`Number out of Spectrum float range: ${n}`);

  out[0] = (e + 0x80) & 0xff;
  out[1] = (mant >>> 24) & 0xff;
  out[2] = (mant >>> 16) & 0xff;
  out[3] = (mant >>> 8) & 0xff;
  out[4] = mant & 0xff;
  out[1] = (out[1]! & 0x7f) | (negative ? 0x80 : 0x00);
  return out;
}

export function decodeSpectrumNumber(
  bytes: ArrayLike<number>,
  offset = 0,
): number {
  const exp = bytes[offset]!;
  if (exp === 0) {
    const sign = bytes[offset + 1]! === 0xff ? -1 : 1;
    const value = bytes[offset + 2]! | (bytes[offset + 3]! << 8);
    return sign * value;
  }
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
