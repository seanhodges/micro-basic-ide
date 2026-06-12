/**
 * ZX Spectrum `.TAP` images.
 *
 * A `.TAP` is a sequence of blocks, each `u16 LE length` followed by `length`
 * bytes: a flag byte (0x00 header / 0xFF data), the payload, and a parity byte
 * (XOR of flag + payload). A saved BASIC program is two blocks — a 17-byte
 * header describing it, then the program area immediately followed by the
 * variables area (a lone 0x80 end-marker when there are no variables).
 *
 * The header's parameters drive a faithful LOAD: param2 is the program length
 * without variables, and param1 is the auto-run line (>= 0x8000 means "don't
 * auto-run"). The IDE uses this same image both as the export file and as the
 * payload the emulator injects through the ROM's tape-loading routine.
 */

export interface TapOptions {
  /** Program name (≤ 10 chars). Defaults to "program". */
  name?: string;
  /** Auto-run line, or null for "load only". Defaults to the first line. */
  autoStart?: number | null;
}

export interface ParsedTap {
  /** The 17 header bytes (type, name, length, param1, param2). */
  header: Uint8Array;
  /** The data payload: program area followed by the variables area. */
  data: Uint8Array;
  /** Tokenized program area (no variables). */
  program: Uint8Array;
  /** Auto-run line, or null when the header says "load only". */
  autoStart: number | null;
}

const VARS_END = 0x80;
const PROGRAM_TYPE = 0x00;

function blockWithParity(flag: number, payload: Uint8Array): Uint8Array {
  const block = new Uint8Array(payload.length + 2);
  block[0] = flag;
  block.set(payload, 1);
  let parity = flag;
  for (const b of payload) parity ^= b;
  block[block.length - 1] = parity;
  return block;
}

function encodeBlock(flag: number, payload: Uint8Array): Uint8Array {
  const block = blockWithParity(flag, payload);
  const out = new Uint8Array(block.length + 2);
  out[0] = block.length & 0xff;
  out[1] = (block.length >> 8) & 0xff;
  out.set(block, 2);
  return out;
}

function programName(name: string): Uint8Array {
  const bytes = new Uint8Array(10).fill(0x20);
  for (let i = 0; i < Math.min(name.length, 10); i++) {
    bytes[i] = name.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function buildTap(
  programBytes: Uint8Array,
  opts: TapOptions = {},
): Uint8Array {
  const firstLine =
    programBytes.length >= 2 ? (programBytes[0]! << 8) | programBytes[1]! : 0;
  const autoStart = opts.autoStart === undefined ? firstLine : opts.autoStart;
  const autoStartParam = autoStart === null ? 0x8000 : autoStart;

  const data = new Uint8Array(programBytes.length + 1);
  data.set(programBytes, 0);
  data[data.length - 1] = VARS_END; // empty variables area

  const header = new Uint8Array(17);
  header[0] = PROGRAM_TYPE;
  header.set(programName(opts.name ?? 'program'), 1);
  header[11] = data.length & 0xff;
  header[12] = (data.length >> 8) & 0xff;
  header[13] = autoStartParam & 0xff;
  header[14] = (autoStartParam >> 8) & 0xff;
  header[15] = programBytes.length & 0xff;
  header[16] = (programBytes.length >> 8) & 0xff;

  const headerBlock = encodeBlock(0x00, header);
  const dataBlock = encodeBlock(0xff, data);
  const out = new Uint8Array(headerBlock.length + dataBlock.length);
  out.set(headerBlock, 0);
  out.set(dataBlock, headerBlock.length);
  return out;
}

export function parseTap(image: Uint8Array): ParsedTap {
  const blocks: { flag: number; payload: Uint8Array }[] = [];
  let p = 0;
  while (p + 2 <= image.length) {
    const len = image[p]! | (image[p + 1]! << 8);
    p += 2;
    if (len < 2 || p + len > image.length) break;
    const flag = image[p]!;
    const payload = image.slice(p + 1, p + len - 1); // drop flag + parity
    blocks.push({ flag, payload });
    p += len;
  }

  const headerBlock = blocks.find(
    (b) => b.flag === 0x00 && b.payload.length === 17,
  );
  const dataBlock = blocks.find((b) => b.flag === 0xff);
  if (!headerBlock || !dataBlock) {
    throw new Error('Not a valid .TAP program image');
  }
  const header = headerBlock.payload;
  if (header[0] !== PROGRAM_TYPE) {
    throw new Error('.TAP does not contain a BASIC program');
  }
  const progLen = header[15]! | (header[16]! << 8);
  const param1 = header[13]! | (header[14]! << 8);
  return {
    header,
    data: dataBlock.payload,
    program: dataBlock.payload.slice(0, progLen),
    autoStart: param1 >= 0x8000 ? null : param1,
  };
}
