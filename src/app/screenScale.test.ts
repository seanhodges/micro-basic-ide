import { describe, expect, it } from 'vitest';
import { computeIntegerScale } from './screenScale';

describe('computeIntegerScale', () => {
  it('scales a phone portrait viewport to 1×', () => {
    expect(computeIntegerScale(390, 600)).toBe(1);
  });

  it('floors to the largest multiple that fits both dimensions', () => {
    expect(computeIntegerScale(540, 500)).toBe(2);
    expect(computeIntegerScale(1100, 900)).toBe(4);
  });

  it('uses the constraining dimension', () => {
    expect(computeIntegerScale(2000, 200)).toBe(1);
    expect(computeIntegerScale(300, 2000)).toBe(1);
  });

  it('is exact at integer multiples', () => {
    expect(computeIntegerScale(512, 384)).toBe(2);
    expect(computeIntegerScale(511, 384)).toBe(1);
  });

  it('never drops below 1 on tiny viewports', () => {
    expect(computeIntegerScale(100, 80)).toBe(1);
    expect(computeIntegerScale(0, 0)).toBe(1);
  });
});
