import { describe, expect, it } from 'vitest';
import {
  crc32,
  buildHeader,
  splitBlocks,
  MAGIC,
  CMD_LOAD_P,
  BLOCK_SIZE,
} from './protocol';

describe('crc32', () => {
  it('matches known vectors', () => {
    // Standard CRC-32 of "123456789"
    const data = new TextEncoder().encode('123456789');
    expect(crc32(data)).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('buildHeader', () => {
  it('lays out magic, command and LE length', () => {
    const h = buildHeader(CMD_LOAD_P, 0x12345);
    expect(Array.from(h.slice(0, 4))).toEqual(Array.from(MAGIC));
    expect(h[4]).toBe(CMD_LOAD_P);
    expect(new DataView(h.buffer).getUint32(5, true)).toBe(0x12345);
  });
});

describe('splitBlocks', () => {
  it('splits into 256-byte blocks with trailing CRCs', () => {
    const payload = new Uint8Array(600).map((_, i) => i & 0xff);
    const blocks = splitBlocks(payload);
    expect(blocks.length).toBe(3);
    expect(blocks[0]!.data.length).toBe(BLOCK_SIZE);
    expect(blocks[2]!.data.length).toBe(600 - 2 * BLOCK_SIZE);
    for (const block of blocks) {
      const wire = block.wire;
      expect(wire.length).toBe(block.data.length + 4);
      const crc = new DataView(wire.buffer, wire.byteOffset).getUint32(
        block.data.length,
        true,
      );
      expect(crc).toBe(crc32(block.data));
    }
  });
});
