import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spectrumSamples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildTap } from './tapfile';
import { SpectrumMachine } from './emulator/spectrumMachine';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/zxspectrum.rom')),
);

describe('zxspectrum sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of spectrumSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('the starter runs and paints a coloured screen', () => {
    const starter = spectrumSamples[0]!;
    const { bytes } = tokenizeProgram(starter.text);
    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 80; i++) machine.runFrame();
    // The starter sets PAPER 1 (blue); attribute memory should hold paper-1 cells.
    let blueCells = 0;
    for (let a = 0x5800; a < 0x5b00; a++) {
      if ((machine.mem.read(a) & 0x38) === 0x08) blueCells++; // paper bits = 1
    }
    expect(blueCells).toBeGreaterThan(100);
  });
});
