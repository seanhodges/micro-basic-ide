import type { BuildTarget } from '../types';
import { tokenizeProgram } from './tokenizer';

/**
 * Build the loadable tokenized program image. This is exactly the byte layout
 * BBC BASIC keeps from PAGE and that SAVE writes to disc, so it doubles as the
 * export file and as the payload the emulator pokes in at PAGE.
 */
export function buildBbcImage(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  // A bare end marker (0x0D 0xFF) means the program is empty.
  if (bytes.length <= 2) {
    throw new Error('Program is empty');
  }
  return bytes;
}

export const bbcBuildTargets: BuildTarget[] = [
  {
    id: 'bbc-file',
    label: 'Export tokenized BASIC',
    fileExtension: 'bbc',
    build: (source) =>
      Promise.resolve(
        new Blob([buildBbcImage(source) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
];
