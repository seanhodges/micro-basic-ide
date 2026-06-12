import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { KeyboardLayout } from '../keyboard/layoutSchema';

/** One keyword of a BASIC dialect, driving tokenizing, highlighting and autocomplete. */
export interface KeywordInfo {
  /** Canonical spelling, upper case, e.g. "PRINT" or "**". */
  word: string;
  /** Token byte emitted by the tokenizer. */
  token: number;
  kind: 'command' | 'function' | 'operator';
  /** Short usage signature shown in autocomplete, e.g. "PRINT [expr][;|,]". */
  signature?: string;
  /** One-line documentation shown in the autocomplete info popup. */
  doc?: string;
}

export class CharsetError extends Error {
  constructor(
    message: string,
    /** Index into the source string where the unmappable character sits. */
    public readonly index: number,
  ) {
    super(message);
    this.name = 'CharsetError';
  }
}

export interface CharsetMapping {
  /** Editor text -> machine character codes. Throws CharsetError on unmappable input. */
  toMachine(text: string): Uint8Array;
  /** Machine character codes -> editor text (unicode forms preferred over escapes). */
  toUnicode(codes: ArrayLike<number>): string;
  /** Printable representation of a single machine code (for displays/debug). */
  glyph(code: number): string;
}

export interface TokenizeError {
  /** 1-based editor line. */
  line: number;
  /** 0-based column, when known. */
  column?: number;
  message: string;
}

export interface TokenizeResult {
  /** Tokenized BASIC program area only (no system variables). */
  programBytes: Uint8Array;
  /** Full loadable machine image (for the ZX81: the .P file payload). */
  image: Uint8Array;
  errors: TokenizeError[];
  /** Size of the program area in bytes (for RAM-budget display). */
  byteSize: number;
}

export interface BuildTarget {
  id: string;
  label: string;
  /** Extension without dot, e.g. "p" or "wav". Absent for non-file targets. */
  fileExtension?: string;
  build(source: string, opts: { programName: string }): Promise<Blob>;
}

export interface MachineEmulator {
  reset(): void;
  /** Inject a built image (post-boot) and arrange for it to run. */
  loadProgram(image: Uint8Array): void;
  /** Advance emulation by one display frame (50Hz) worth of CPU time. */
  runFrame(): void;
  renderTo(ctx: CanvasRenderingContext2D): void;
  /** Returns true when the key event was consumed. */
  keyEvent(e: KeyboardEvent, down: boolean): boolean;
  /**
   * Press/release an opaque machine-defined key token (for the ZX81 these are
   * DOM-code-style strings: 'KeyJ', 'Shift', 'Enter'…). Used by the virtual
   * keyboard to drive the key matrix directly, bypassing DOM key events.
   */
  setKey(token: string, down: boolean): void;
  /** Release every key held by any source (stop, blur, unmount…). */
  releaseAllKeys(): void;
  /** Emulation speed multiplier (1 = real time). */
  setSpeed(multiplier: number): void;
  readonly displayWidth: number;
  readonly displayHeight: number;
  dispose(): void;
}

export interface AiProfile {
  model: string;
  systemPrompt: string;
  maxTokens: number;
}

/**
 * Everything the IDE needs to support one BASIC dialect / machine.
 * The app only ever talks to this interface; machine specifics stay inside
 * the dialect's own folder.
 */
export interface Dialect {
  id: string;
  name: string;
  fileExtensions: string[];
  keywords: KeywordInfo[];
  charset: CharsetMapping;
  /** CodeMirror language support: highlighting + languageData (incl. autocomplete). */
  languageSupport(): Extension;
  completionSource: CompletionSource;
  tokenize(source: string, opts?: { programName?: string }): TokenizeResult;
  detokenize(image: Uint8Array): string;
  /** Tokenizer dry-run for editor linting. */
  lint(source: string): TokenizeError[];
  /** URL of the machine ROM (resolved against the deployed base path). */
  romUrl: string;
  createEmulator(opts: {
    rom: Uint8Array;
    ramKb: 16 | 32 | 64;
  }): MachineEmulator;
  /** On-screen keyboard: authentic layout, labels and theme as pure data. */
  keyboardLayout: KeyboardLayout;
  buildTargets: BuildTarget[];
  /** Cassette-audio loading support, when the machine loads from tape. */
  audio?: {
    sampleRate: number;
    /** Throws when the source has tokenizer errors. */
    buildSamples(
      source: string,
      programName: string,
      robust: boolean,
    ): Float32Array;
    /** Loading instructions shown to the user, e.g. how to type LOAD "". */
    loadInstructions: string;
  };
  aiProfile: AiProfile;
}
