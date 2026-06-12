import { describe, expect, it } from 'vitest';
import { encodeCassette, encodeName } from './cassetteEncoder';

const RATE = 44100;

/** Count zero-crossing pulse groups in a sample window. */
function countPulses(samples: Float32Array, from: number, to: number): number {
  let pulses = 0;
  let inHigh = false;
  for (let i = from; i < to; i++) {
    const high = samples[i]! > 0.1;
    if (high && !inHigh) pulses++;
    inHigh = high;
  }
  return pulses;
}

describe('encodeName', () => {
  it('marks the last character with bit 7', () => {
    const name = encodeName('AB');
    expect(Array.from(name)).toEqual([0x26, 0x27 | 0x80]);
  });

  it('falls back to PROGRAM for empty names', () => {
    const name = encodeName('');
    expect(name.length).toBe(7);
    expect(name[6]! & 0x80).toBe(0x80);
  });
});

describe('encodeCassette', () => {
  it('encodes 0-bits as 4 pulses and 1-bits as 9 pulses', () => {
    // Name "A" (0xA6 = 10100110), then one data byte 0x00
    const samples = encodeCassette('A', Uint8Array.from([0x00]), {
      sampleRate: RATE,
      leaderSeconds: 0.1,
      trailerSeconds: 0,
    });
    // Skip leader; first bit of 0xA6 is 1 -> 9 pulses over 9*300us + 1300us gap
    const leader = Math.round(0.1 * RATE);
    const oneBit = Math.round(0.004 * RATE); // 4000us
    const zeroBit = Math.round(0.0025 * RATE); // 4*300us + 1300us = 2500us
    expect(countPulses(samples, leader, leader + oneBit)).toBe(9);
    // Second bit of 0xA6 is 0 -> 4 pulses
    expect(
      countPulses(samples, leader + oneBit, leader + oneBit + zeroBit),
    ).toBe(4);
  });

  it('produces ~300us pulses', () => {
    const samples = encodeCassette('A', Uint8Array.from([0xff]), {
      sampleRate: RATE,
      leaderSeconds: 0.05,
      trailerSeconds: 0,
    });
    // Measure the first high period after the leader
    let i = Math.round(0.05 * RATE);
    while (samples[i]! <= 0.1) i++;
    let highLen = 0;
    while (samples[i + highLen]! > 0.1) highLen++;
    const micros = (highLen / RATE) * 1e6;
    expect(micros).toBeGreaterThan(100);
    expect(micros).toBeLessThan(200);
  });

  it('scales with the robust bit gap', () => {
    const data = Uint8Array.from([0x55, 0xaa, 0x00]);
    const normal = encodeCassette('A', data, {
      sampleRate: RATE,
      leaderSeconds: 0,
      trailerSeconds: 0,
    });
    const robust = encodeCassette('A', data, {
      sampleRate: RATE,
      leaderSeconds: 0,
      trailerSeconds: 0,
      bitGapMicros: 2600,
    });
    expect(robust.length).toBeGreaterThan(normal.length);
  });
});
