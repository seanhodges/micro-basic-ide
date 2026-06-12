/**
 * Serial transfer protocol for microcontroller bridges
 * (see docs/serial-protocol.md for the full spec).
 *
 * Stream layout: magic "Z81!", command byte, u32-LE payload length, then the
 * payload in 256-byte blocks, each followed by its CRC32 (LE). The receiver
 * answers each block with ACK (0x06) or NAK (0x15, resend). After the final
 * block the sender transmits EOT (0x04).
 */
export const MAGIC = Uint8Array.from([0x5a, 0x38, 0x31, 0x21]); // "Z81!"
export const CMD_LOAD_P = 0x01;
export const ACK = 0x06;
export const NAK = 0x15;
export const EOT = 0x04;
export const BLOCK_SIZE = 256;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildHeader(cmd: number, payloadLength: number): Uint8Array {
  const header = new Uint8Array(MAGIC.length + 1 + 4);
  header.set(MAGIC, 0);
  header[4] = cmd;
  new DataView(header.buffer).setUint32(5, payloadLength, true);
  return header;
}

export interface Block {
  data: Uint8Array;
  /** Block payload followed by its CRC32 (little-endian). */
  wire: Uint8Array;
}

export function splitBlocks(payload: Uint8Array): Block[] {
  const blocks: Block[] = [];
  for (let off = 0; off < payload.length; off += BLOCK_SIZE) {
    const data = payload.subarray(
      off,
      Math.min(off + BLOCK_SIZE, payload.length),
    );
    const wire = new Uint8Array(data.length + 4);
    wire.set(data, 0);
    new DataView(wire.buffer).setUint32(data.length, crc32(data), true);
    blocks.push({ data, wire });
  }
  return blocks;
}
