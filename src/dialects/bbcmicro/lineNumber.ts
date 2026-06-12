/**
 * BBC BASIC stores line-number constants that follow GOTO/GOSUB/THEN/… not as
 * digits but in a three-byte scrambled form introduced by the 0x8D token, so
 * that RENUMBER can rewrite them in place. The top two bits of each of the low
 * and high bytes are packed into the first payload byte (EOR'd with 0x54); the
 * remaining six bits of each byte are stored with bit 6 set.
 */

/** The token that introduces an encoded line-number constant. */
export const LINE_NUMBER_TOKEN = 0x8d;

/** Encode a 0–65279 line number to its 4-byte 0x8D form. */
export function encodeLineNumber(
  line: number,
): [number, number, number, number] {
  const lo = line & 0xff;
  const hi = (line >> 8) & 0xff;
  const top = (((lo & 0xc0) >> 2) | ((hi & 0xc0) >> 4)) ^ 0x54;
  return [LINE_NUMBER_TOKEN, top, (lo & 0x3f) | 0x40, (hi & 0x3f) | 0x40];
}

/** Decode the three payload bytes (after the 0x8D token) back to a line number. */
export function decodeLineNumber(b1: number, b2: number, b3: number): number {
  const top = b1 ^ 0x54;
  const lo = (b2 & 0x3f) | ((top & 0x30) << 2);
  const hi = (b3 & 0x3f) | ((top & 0x0c) << 4);
  return lo | (hi << 8);
}
