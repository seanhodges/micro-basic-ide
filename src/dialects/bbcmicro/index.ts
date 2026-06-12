import type { Dialect, TokenizeResult } from '../types';
import { bbcCharset } from './charset';
import { bbcKeywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { bbcBuildTargets } from './targets';
import { bbcLanguageSupport, bbcCompletionSource } from './language';
import { bbcAiProfile } from './aiProfile';
import { bbcKeyboardLayout } from './keyboardLayout';
import { bbcSamples } from './samples';
import {
  BbcMachine,
  BBC_DISPLAY_WIDTH,
  BBC_DISPLAY_HEIGHT,
} from '../../emulator/bbc/bbcMachine';

/**
 * BBC Micro Model B dialect.
 *
 * BBC BASIC is tokenized natively in TypeScript (see tokenizer.ts) into the
 * genuine BASIC II byte layout — the same bytes the BASIC ROM keeps from PAGE
 * and that SAVE writes to disc. That tokenized program is the dialect's
 * "image": the emulator pokes it straight in at PAGE, and it is also the
 * import/export file format (.bbc). Hardware emulation is delegated to jsbeeb
 * (see src/emulator/bbc/bbcMachine.ts).
 */
export const bbcmicro: Dialect = {
  id: 'bbcmicro',
  name: 'BBC Micro',
  fileExtensions: ['.bas'],
  keywords: bbcKeywords,
  charset: bbcCharset,
  languageSupport: bbcLanguageSupport,
  completionSource: bbcCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    // A non-empty image is the program plus its 0x0D 0xFF end marker.
    const image =
      errors.length === 0 && bytes.length > 2 ? bytes : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(image);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
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

  buildTargets: bbcBuildTargets,

  binaryImport: { extension: '.bbc', label: 'Import .BBC…' },

  aiProfile: bbcAiProfile,
};
