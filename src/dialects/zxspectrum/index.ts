import type { Dialect, TokenizeResult } from '../types';
import { spectrumCharset } from './charset';
import { spectrumKeywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { buildTap, parseTap } from './tapfile';
import { spectrumLanguageSupport, spectrumCompletionSource } from './language';
import { spectrumAiProfile } from './aiProfile';
import { spectrumBuildTargets } from './targets';
import { SpectrumMachine } from './emulator/spectrumMachine';
import { spectrumKeyboardLayout } from './keyboardLayout';
import { spectrumSamples } from './samples';

export const zxspectrum: Dialect = {
  id: 'zxspectrum',
  name: 'ZX Spectrum BASIC',
  fileExtensions: ['.bas'],
  keywords: spectrumKeywords,
  charset: spectrumCharset,
  languageSupport: spectrumLanguageSupport,
  completionSource: spectrumCompletionSource,

  tokenize(source: string): TokenizeResult {
    const { bytes, errors } = tokenizeProgram(source);
    const image =
      errors.length === 0 && bytes.length > 0
        ? buildTap(bytes)
        : new Uint8Array(0);
    return { programBytes: bytes, image, errors, byteSize: bytes.length };
  },

  detokenize(image: Uint8Array): string {
    return detokenizeProgram(parseTap(image).program);
  },

  lint(source: string) {
    return tokenizeProgram(source).errors;
  },

  romUrl: `${import.meta.env.BASE_URL}roms/zxspectrum.rom`,

  createEmulator(opts) {
    return new SpectrumMachine({ rom: opts.rom });
  },

  keyboardLayout: spectrumKeyboardLayout,

  samples: spectrumSamples,

  buildTargets: spectrumBuildTargets,

  aiProfile: spectrumAiProfile,
};
