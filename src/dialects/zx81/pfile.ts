import * as sv from './sysvars';
import { NEWLINE } from './charset';

export interface PFileOptions {
  /** Start the program automatically on load (NXTLIN -> first line). Default true. */
  autoRun?: boolean;
  /** Boot into SLOW (compute-and-display) mode. Default true. */
  slow?: boolean;
}

export interface ParsedPFile {
  program: Uint8Array;
  dFile: number;
  vars: number;
  eLine: number;
}

const DISPLAY_FILE_COLLAPSED = 25; // leading NEWLINE + 24 empty rows

/**
 * Wrap a tokenized program area into a complete .P image: the memory dump
 * from 0x4009 (VERSN) up to E_LINE-1, exactly as the ROM's SAVE writes it.
 * Layout: sysvars | program | collapsed display file | variables terminator.
 */
export function buildPFile(
  programBytes: Uint8Array,
  opts: PFileOptions = {},
): Uint8Array {
  const autoRun = opts.autoRun ?? true;
  const slow = opts.slow ?? true;

  const progLen = programBytes.length;
  const dFile = sv.PROGRAM_BASE + progLen;
  const vars = dFile + DISPLAY_FILE_COLLAPSED;
  const eLine = vars + 1; // VARS holds only the 0x80 terminator

  const total = eLine - sv.SYSVARS_BASE;
  const image = new Uint8Array(total);

  const poke = (addr: number, value: number) => {
    image[addr - sv.SYSVARS_BASE] = value & 0xff;
  };
  const pokeWord = (addr: number, value: number) => {
    poke(addr, value & 0xff);
    poke(addr + 1, (value >> 8) & 0xff);
  };

  const firstLine =
    progLen >= 2 ? (programBytes[0]! << 8) | programBytes[1]! : 0;

  poke(sv.VERSN, 0);
  pokeWord(sv.E_PPC, firstLine);
  pokeWord(sv.D_FILE, dFile);
  pokeWord(sv.DF_CC, dFile + 1);
  pokeWord(sv.VARS, vars);
  pokeWord(sv.DEST, 0);
  pokeWord(sv.E_LINE, eLine);
  pokeWord(sv.CH_ADD, eLine + 4);
  pokeWord(sv.X_PTR, 0);
  pokeWord(sv.STKBOT, eLine + 5);
  pokeWord(sv.STKEND, eLine + 5);
  poke(sv.BERG, 0);
  pokeWord(sv.MEM, sv.MEMBOT);
  poke(sv.DF_SZ, 2);
  pokeWord(sv.S_TOP, firstLine);
  pokeWord(sv.LAST_K, 0xffff);
  poke(sv.DEBOUNCE, 0xff);
  poke(sv.MARGIN, 55); // PAL
  pokeWord(sv.NXTLIN, autoRun && progLen > 0 ? sv.PROGRAM_BASE : dFile);
  pokeWord(sv.OLDPPC, 0);
  poke(sv.FLAGX, 0);
  pokeWord(sv.STRLEN, 0);
  pokeWord(sv.T_ADDR, 0x0c8d); // ROM syntax table pointer, post-NEW value
  pokeWord(sv.SEED, 0);
  pokeWord(sv.FRAMES, 0xffff);
  pokeWord(sv.COORDS, 0);
  poke(sv.PR_CC, 0xbc);
  poke(sv.S_POSN, 0x21);
  poke(sv.S_POSN + 1, 0x18);
  poke(sv.CDFLAG, slow ? 0x40 : 0x00);

  image.set(programBytes, sv.PROGRAM_BASE - sv.SYSVARS_BASE);

  // Collapsed display file: NEWLINE then 24 empty rows (each just a NEWLINE)
  for (let i = 0; i < DISPLAY_FILE_COLLAPSED; i++) {
    image[dFile - sv.SYSVARS_BASE + i] = NEWLINE;
  }

  // Variables area: end marker only
  image[vars - sv.SYSVARS_BASE] = 0x80;

  return image;
}

/** Extract the tokenized program area (and key pointers) from a .P image. */
export function parsePFile(image: Uint8Array): ParsedPFile {
  if (image.length < sv.SYSVARS_SAVED_LENGTH + 1) {
    throw new Error('Not a .P file: too short');
  }
  const word = (addr: number) =>
    image[addr - sv.SYSVARS_BASE]! | (image[addr - sv.SYSVARS_BASE + 1]! << 8);

  const dFile = word(sv.D_FILE);
  const vars = word(sv.VARS);
  const eLine = word(sv.E_LINE);
  if (
    dFile < sv.PROGRAM_BASE ||
    vars < dFile ||
    eLine < vars ||
    eLine - sv.SYSVARS_BASE > image.length
  ) {
    throw new Error('Not a valid .P file: inconsistent system variables');
  }
  return {
    program: image.slice(
      sv.PROGRAM_BASE - sv.SYSVARS_BASE,
      dFile - sv.SYSVARS_BASE,
    ),
    dFile,
    vars,
    eLine,
  };
}
