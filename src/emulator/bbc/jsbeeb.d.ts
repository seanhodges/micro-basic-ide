/**
 * Hand-written typings for the small surface of jsbeeb (GPL-3.0-or-later,
 * © Matt Godbolt and contributors) that the BBC adapter uses, mirroring the
 * z80core.d.ts precedent for the vendored Z80 core.
 *
 * jsbeeb exposes `jsbeeb/src/*` in its exports map but ships no .d.ts; these
 * declarations cover only what bbcMachine.ts and keyboard.ts touch, verified
 * against jsbeeb 1.13.1 (pinned exactly in package.json).
 */

declare module 'jsbeeb/src/models.js' {
  export interface Model {
    name: string;
    isMaster: boolean;
    isAtom: boolean;
  }
  /** Resolve a model by name/synonym, e.g. 'B' = "BBC B with 8271 (DFS 0.9)". */
  export function findModel(name: string): Model;
  /** Hidden Master used by the in-ROM BASIC tokenizer (loads master/mos3.20). */
  export const basicOnly: Model;
}

declare module 'jsbeeb/src/video.js' {
  export class Video {
    constructor(
      isMaster: boolean,
      fb32: Uint32Array,
      paint: (minx: number, miny: number, maxx: number, maxy: number) => void,
    );
    /** True while the ULA is in teletext (mode 7) operation. */
    teletextMode: boolean;
  }
}

declare module 'jsbeeb/src/soundchip.js' {
  export class FakeSoundChip {
    constructor();
  }
}

declare module 'jsbeeb/src/fake6502.js' {
  import type { Model } from 'jsbeeb/src/models.js';
  import type { Video } from 'jsbeeb/src/video.js';
  import type { FakeSoundChip } from 'jsbeeb/src/soundchip.js';

  export interface SysVia {
    keyDown(jsKeyCode: number, shiftDown: boolean): void;
    keyUp(jsKeyCode: number): void;
    keyDownRaw(colRow: readonly [number, number]): void;
    keyUpRaw(colRow: readonly [number, number]): void;
    clearKeys(): void;
    setKeyLayout(layout: 'physical' | 'natural' | 'gaming'): void;
  }

  /**
   * The real Cpu6502 (the "fake" in the name refers to the peripherals it
   * wires up by default). Only the members the adapter uses are declared.
   */
  export interface Cpu6502 {
    /** Loads the model's OS/BASIC/DFS ROMs (via utils.loadData) and resets. */
    initialise(): Promise<void>;
    /** Run for n 2MHz cycles; false when stopped by a debug hook. */
    execute(cycles: number): boolean;
    reset(hard: boolean): void;
    /** Hold/release the reset line (BREAK key). */
    setReset(resetOn: boolean): void;
    readmem(addr: number): number;
    writemem(addr: number, value: number): void;
    readonly sysvia: SysVia;
  }

  export function fake6502(
    model: Model,
    opts?: { video?: Video; soundChip?: FakeSoundChip },
  ): Cpu6502;
}

declare module 'jsbeeb/src/basic-tokenise.js' {
  export interface Tokeniser {
    /**
     * Tokenize BBC BASIC source using the genuine ROM routine. Lines without
     * numbers are auto-numbered 10, 20… Returns the program as a binary
     * string (one charCode per byte). Throws when a tokenized line exceeds
     * 251 bytes.
     */
    tokenise(text: string): string;
  }
  /** Boots a hidden 65C12 with the Master BASIC ROM to do the tokenizing. */
  export function create(): Promise<Tokeniser>;
}

declare module 'jsbeeb/src/utils.js' {
  /** Base URL prepended to 'roms/…' requests in the browser. */
  export function setBaseUrl(url: string): void;
  /** jsbeeb package root for ROM loading when running under node (tests). */
  export function setNodeBasePath(basePath: string): void;
  /** Legacy JS keyCode constants, plus jsbeeb's left/right modifier hacks. */
  export const keyCodes: Record<string, number>;
  /** BBC keyboard matrix positions by key name: [column, row]. */
  export const BBC: Record<string, [number, number]>;
}
