import { describe, it, expect } from 'vitest';
import { SpectrumKeyboard } from './keyboard';

/** Read CAPS SHIFT (row A8, bit 0): true = pressed (active low). */
function capsPressed(kb: SpectrumKeyboard): boolean {
  return (kb.readPort(0xfe) & 0x01) === 0;
}
/** Read P (row A13/0xDF, bit 0): true = pressed. */
function pPressed(kb: SpectrumKeyboard): boolean {
  return (kb.readPort(0xdf) & 0x01) === 0;
}
/** Read SYMBOL SHIFT (row A15/0x7F, bit 1): true = pressed. */
function symPressed(kb: SpectrumKeyboard): boolean {
  return (kb.readPort(0x7f) & 0x02) === 0;
}

function physEvent(code: string): KeyboardEvent {
  return { code } as KeyboardEvent;
}

describe('SpectrumKeyboard', () => {
  it('maps CAPS SHIFT and SYMBOL SHIFT to the right matrix bits', () => {
    const kb = new SpectrumKeyboard();
    kb.setKey('CapsShift', true);
    kb.setKey('SymShift', true);
    expect(capsPressed(kb)).toBe(true);
    expect(symPressed(kb)).toBe(true);
  });

  it('translates a physical "." to SYMBOL SHIFT + M', () => {
    const kb = new SpectrumKeyboard();
    kb.handleKey(physEvent('Period'), true);
    expect(symPressed(kb)).toBe(true);
    // M is row A15/0x7F bit 2
    expect((kb.readPort(0x7f) & 0x04) === 0).toBe(true);
  });

  it('keeps a virtually-held key down across a physical press/release', () => {
    const kb = new SpectrumKeyboard();
    kb.setKey('KeyP', true);
    kb.handleKey(physEvent('KeyP'), true);
    kb.handleKey(physEvent('KeyP'), false);
    expect(pPressed(kb)).toBe(true); // virtual hold survives physical keyup
    kb.setKey('KeyP', false);
    expect(pPressed(kb)).toBe(false);
  });

  it('releaseAll clears both sources and ignores a stale keyup', () => {
    const kb = new SpectrumKeyboard();
    kb.setKey('CapsShift', true);
    kb.handleKey(physEvent('KeyP'), true);
    kb.releaseAll();
    expect(capsPressed(kb)).toBe(false);
    expect(pPressed(kb)).toBe(false);
    kb.handleKey(physEvent('KeyP'), false);
    expect(pPressed(kb)).toBe(false);
  });
});
