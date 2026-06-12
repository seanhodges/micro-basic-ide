import type { BuildTarget } from '../types';
import { tokenizeProgram } from './tokenizer';
import { buildTap } from './tapfile';

function buildProgramBytes(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  if (errors.length > 0) {
    throw new Error(
      `Program has ${errors.length} error(s) — fix them before building`,
    );
  }
  if (bytes.length === 0) {
    throw new Error('Program is empty');
  }
  return bytes;
}

/** Build the loadable .TAP image (program + auto-run header). */
export function buildTapImage(
  source: string,
  programName = 'program',
): Uint8Array {
  return buildTap(buildProgramBytes(source), { name: programName });
}

export const spectrumBuildTargets: BuildTarget[] = [
  {
    id: 'tap-file',
    label: 'Export .TAP file',
    fileExtension: 'tap',
    build: (source, { programName }) =>
      Promise.resolve(
        new Blob([buildTapImage(source, programName) as BlobPart], {
          type: 'application/octet-stream',
        }),
      ),
  },
];
