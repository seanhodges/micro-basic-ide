import type { MachineVariable } from './types';

/**
 * Decoder for the Sinclair BASIC variables area, shared by the ZX81 and the ZX
 * Spectrum. Both store variables as a list of entries from the address in the
 * VARS system variable up to a 0x80 terminator (also bounded by E_LINE). Each
 * entry begins with a name byte whose top 3 bits tag the type and whose low 5
 * bits hold the letter. The tag→type mapping below was verified against both
 * ROMs; the machines differ only in their letter charset, numeric encoding,
 * string charset, and the byte length of a FOR-NEXT entry.
 */
export interface SinclairVarsConfig {
  read(addr: number): number;
  readWord(addr: number): number;
  /** Address of the VARS system variable (16-bit LE pointer to the area). */
  varsPtr: number;
  /** Address of the E_LINE system variable (16-bit LE upper bound). */
  eLinePtr: number;
  /** Low 5 bits of a name byte → display letter "A".."Z". */
  letter(low5: number): string;
  /** Decode a 5-byte numeric value to a JS number. */
  decodeNumber(bytes: number[]): number;
  /** Decode character codes to a display string. */
  decodeString(codes: number[]): string;
  /** Total bytes of a FOR-NEXT control entry incl. name (ZX81 18, Spectrum 19). */
  forVarBytes: number;
}

/** Guards against runaway parsing of a corrupt or unexpected variables area. */
const MAX_VARS = 1000;
/** Array elements shown inline before truncating with an ellipsis. */
const MAX_ARRAY_PREVIEW = 8;

function fmtNum(n: number): string {
  return Number.parseFloat(n.toPrecision(9)).toString();
}

function readN(
  read: (addr: number) => number,
  start: number,
  count: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(read(start + i));
  return out;
}

export function readSinclairVariables(
  cfg: SinclairVarsConfig,
): MachineVariable[] {
  const { read, readWord } = cfg;
  const eLine = readWord(cfg.eLinePtr);
  const out: MachineVariable[] = [];
  let addr = readWord(cfg.varsPtr);

  for (let guard = 0; guard < MAX_VARS; guard++) {
    if (addr >= eLine) break;
    const first = read(addr);
    if (first === 0x80) break; // end-of-variables terminator
    const name = cfg.letter(first & 0x1f);

    switch (first >> 5) {
      case 0b011: {
        // Number with a one-letter name: name + 5-byte value.
        const v = cfg.decodeNumber(readN(read, addr + 1, 5));
        out.push({
          name,
          kind: 'number',
          value: fmtNum(v),
          ref: { addr: addr + 1, layout: 'number' },
        });
        addr += 6;
        break;
      }
      case 0b010: {
        // String: name$ + 2-byte length + that many character codes.
        const len = readWord(addr + 1);
        const take = Math.max(0, Math.min(len, eLine - (addr + 3)));
        const codes = readN(read, addr + 3, take);
        out.push({
          name: name + '$',
          kind: 'string',
          value: '"' + cfg.decodeString(codes) + '"',
          ref: { addr: addr + 3, layout: 'string', len },
        });
        addr += 3 + len;
        break;
      }
      case 0b111: {
        // FOR-NEXT control variable: name + value(5) + limit/step/line/(stmt).
        // The first 5-byte value is the live loop counter.
        const v = cfg.decodeNumber(readN(read, addr + 1, 5));
        out.push({
          name,
          kind: 'number',
          value: fmtNum(v),
          ref: { addr: addr + 1, layout: 'number' },
        });
        addr += cfg.forVarBytes;
        break;
      }
      case 0b100:
        addr = decodeArray(cfg, addr, eLine, name, 'number-array', out);
        break;
      case 0b110:
        addr = decodeArray(cfg, addr, eLine, name, 'string-array', out);
        break;
      case 0b101: {
        // Number with a multi-letter name. The editor restricts names to a
        // single letter so this should not occur; skip it safely anyway. The
        // name runs until a byte with bit 7 set, then a 5-byte value follows.
        let p = addr + 1;
        while (p < eLine && (read(p) & 0x80) === 0) p++;
        addr = p + 1 + 5;
        break;
      }
      default:
        // 000/001 are not valid entry tags; bail rather than misparse.
        return out;
    }
  }
  return out;
}

function decodeArray(
  cfg: SinclairVarsConfig,
  addr: number,
  eLine: number,
  letter: string,
  kind: 'number-array' | 'string-array',
  out: MachineVariable[],
): number {
  const { read, readWord } = cfg;
  const total = readWord(addr + 1); // bytes following the length field
  const next = addr + 3 + total;
  const dimCount = read(addr + 3);
  const dims: number[] = [];
  let p = addr + 4;
  for (let i = 0; i < dimCount && p + 1 < eLine; i++, p += 2) {
    dims.push(readWord(p));
  }
  const shape = '[' + dims.join(',') + ']';

  if (kind === 'number-array') {
    const count = dims.reduce((a, b) => a * b, 1);
    const preview: string[] = [];
    let ep = p;
    for (
      let i = 0;
      i < count && i < MAX_ARRAY_PREVIEW && ep + 4 < eLine;
      i++, ep += 5
    ) {
      preview.push(fmtNum(cfg.decodeNumber(readN(read, ep, 5))));
    }
    const more = count > MAX_ARRAY_PREVIEW ? ', …' : '';
    out.push({
      name: letter + '()',
      kind,
      value: `${shape} = ${preview.join(', ')}${more}`,
      ref: { addr: p, layout: 'number-array' },
    });
  } else {
    out.push({
      name: letter + '$()',
      kind,
      value: shape,
      ref: { addr: p, layout: 'string-array' },
    });
  }
  return next;
}
