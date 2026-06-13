import type { MachineVariable } from '../types';
import {
  readSinclairVariables,
  type SinclairVarsConfig,
} from '../sinclairVars';
import { zx81Charset } from './charset';
import { decodeZxFloat } from './zxfloat';
import { VARS, E_LINE } from './sysvars';

interface MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/**
 * Decode the ZX81 BASIC variables area into a system-agnostic list. Names use
 * the ZX81 charset (letters A–Z are codes 0x26–0x3F, so the low 5 bits of a
 * name byte OR'd with 0x20 give the letter code); numbers are the 5-byte ZX81
 * float; a FOR-NEXT entry is 18 bytes including the name byte.
 */
export function readZx81Variables(mem: MemPort): MachineVariable[] {
  const config: SinclairVarsConfig = {
    read: (addr) => mem.read(addr),
    readWord: (addr) => mem.readWord(addr),
    varsPtr: VARS,
    eLinePtr: E_LINE,
    letter: (low5) => zx81Charset.glyph(0x20 | low5),
    decodeNumber: (bytes) => decodeZxFloat(bytes),
    decodeString: (codes) => zx81Charset.toUnicode(codes),
    forVarBytes: 18,
  };
  return readSinclairVariables(config);
}
