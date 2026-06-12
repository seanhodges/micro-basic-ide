import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { CharsetError } from '../types';
import { bbcCharset } from './charset';
import { bbcKeywords } from './keywords';
import { bbcLanguageSupport, bbcCompletionSource } from './language';
import { bbcAiProfile } from './aiProfile';
import { bbcKeyboardLayout } from './keyboardLayout';
import { bbcSamples } from './samples';
import {
  BbcMachine,
  BBC_DISPLAY_WIDTH,
  BBC_DISPLAY_HEIGHT,
} from '../../emulator/bbc/bbcMachine';

/** Map a CharsetError's string index to a 1-based line / 0-based column. */
function charsetErrors(source: string): TokenizeError[] {
  try {
    bbcCharset.toMachine(source);
    return [];
  } catch (e) {
    if (!(e instanceof CharsetError)) throw e;
    const before = source.slice(0, e.index);
    const line = before.split('\n').length;
    const column = e.index - (before.lastIndexOf('\n') + 1);
    return [{ line, column, message: e.message }];
  }
}

/**
 * BBC Micro preview dialect.
 *
 * Unlike the Sinclair dialects there is no TypeScript tokenizer (yet): the
 * "image" is the program source in the machine charset, and the emulator
 * tokenizes it with the genuine BASIC ROM routine before poking it at PAGE
 * (see src/emulator/bbc/bbcMachine.ts). Consequences, until a native
 * tokenizer lands: byteSize approximates the tokenized size with the source
 * length, lint only reports charset problems (the ROM reports real syntax
 * errors on screen at RUN), and buildTargets/audio are absent.
 */
export const bbcmicro: Dialect = {
  id: 'bbcmicro',
  name: 'BBC BASIC (preview)',
  fileExtensions: ['.bas'],
  keywords: bbcKeywords,
  charset: bbcCharset,
  languageSupport: bbcLanguageSupport,
  completionSource: bbcCompletionSource,

  tokenize(source: string): TokenizeResult {
    const errors = charsetErrors(source);
    const image =
      errors.length === 0 && source.trim().length > 0
        ? bbcCharset.toMachine(source)
        : new Uint8Array(0);
    return { programBytes: image, image, errors, byteSize: image.length };
  },

  detokenize(image: Uint8Array): string {
    return bbcCharset.toUnicode(image);
  },

  lint(source: string) {
    return charsetErrors(source);
  },

  // Prefetched by the app for cache warming; the jsbeeb adapter loads the
  // full ROM set (OS + BASIC + DFS) itself through the same base URL.
  romUrl: `${import.meta.env.BASE_URL}roms/BASIC.ROM`,

  displaySize: { width: BBC_DISPLAY_WIDTH, height: BBC_DISPLAY_HEIGHT },

  // opts.rom/ramKb are ignored: jsbeeb manages its own ROMs and memory map.
  createEmulator() {
    return new BbcMachine();
  },

  keyboardLayout: bbcKeyboardLayout,

  samples: bbcSamples,

  buildTargets: [],

  aiProfile: bbcAiProfile,
};
