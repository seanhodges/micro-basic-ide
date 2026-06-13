import type { MachineVariable } from '../types';
import {
  readSinclairVariables,
  type SinclairVarsConfig,
} from '../sinclairVars';
import { spectrumCharset } from './charset';
import { decodeSpectrumNumber } from './numbers';
import { VARS, E_LINE } from './sysvars';

interface MemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

/**
 * Decode the ZX Spectrum BASIC variables area into a system-agnostic list. It
 * shares the Sinclair layout with the ZX81; the differences are: names are
 * stored as lowercase ASCII (low 5 bits OR'd with 0x60), numbers use the
 * Spectrum encoding (small-integer short form or 5-byte float), characters are
 * ASCII, and a FOR-NEXT entry is 19 bytes (it carries an extra statement byte).
 */
export function readSpectrumVariables(mem: MemPort): MachineVariable[] {
  const config: SinclairVarsConfig = {
    read: (addr) => mem.read(addr),
    readWord: (addr) => mem.readWord(addr),
    varsPtr: VARS,
    eLinePtr: E_LINE,
    letter: (low5) => String.fromCharCode(0x60 | low5).toUpperCase(),
    decodeNumber: (bytes) => decodeSpectrumNumber(bytes),
    decodeString: (codes) => spectrumCharset.toUnicode(codes),
    forVarBytes: 19,
  };
  return readSinclairVariables(config);
}
