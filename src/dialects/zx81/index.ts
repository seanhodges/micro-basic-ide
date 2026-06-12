import type { Dialect, TokenizeError, TokenizeResult } from '../types';
import { zx81Charset } from './charset';
import { zx81Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildPFile, parsePFile } from './pfile';
import { zx81LanguageSupport, zx81CompletionSource } from './language';
import { zx81AiProfile } from './aiProfile';
import {
  zx81BuildTargets,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './targets';
import { Zx81Machine } from './emulator/zx81Machine';
import { zx81KeyboardLayout } from './keyboardLayout';

export const zx81: Dialect = {
  id: 'zx81',
  name: 'ZX81 BASIC',
  fileExtensions: ['.bas'],
  keywords: zx81Keywords,
  charset: zx81Charset,
  languageSupport: zx81LanguageSupport,
  completionSource: zx81CompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      errors.length === 0 && bytes.length > 0
        ? buildPFile(bytes)
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parsePFile(image).program);
  },

  lint(source: string): TokenizeError[] {
    return tokenizeProgram(source).errors;
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zx81.rom`,

  createEmulator(opts) {
    return new Zx81Machine(opts);
  },

  keyboardLayout: zx81KeyboardLayout,

  buildTargets: zx81BuildTargets,

  audio: {
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, programName, robust) =>
      buildCassetteSamples(source, programName, robust),
    loadInstructions:
      'On the ZX81 type LOAD "" — press J for LOAD, then shift-P twice for the quotes — and press NEW LINE before starting playback.',
  },

  aiProfile: zx81AiProfile,
};
