import { describe, it, expect } from 'vitest';
import { Zx81Keyboard } from './keyboard';

/** Read the SHIFT bit (row A8, bit 0): true = pressed (active low). */
function shiftPressed(kb: Zx81Keyboard): boolean {
  return (kb.readPort(0xfe) & 0x01) === 0;
}

/** Read the P bit (row A13, bit 0): true = pressed. */
function pPressed(kb: Zx81Keyboard): boolean {
  return (kb.readPort(0xdf) & 0x01) === 0;
}

function physEvent(code: string): KeyboardEvent {
  return { code } as KeyboardEvent;
}

describe('Zx81Keyboard dual-source press tracking', () => {
  it('keeps a virtually-held key down across a physical press/release', () => {
    const kb = new Zx81Keyboard();
    kb.setKey('Shift', true);
    expect(shiftPressed(kb)).toBe(true);

    kb.handleKey(physEvent('ShiftLeft'), true);
    expect(shiftPressed(kb)).toBe(true);
    kb.handleKey(physEvent('ShiftLeft'), false);
    expect(shiftPressed(kb)).toBe(true); // virtual hold survives physical keyup

    kb.setKey('Shift', false);
    expect(shiftPressed(kb)).toBe(false);
  });

  it('keeps a physically-held key down across a virtual press/release', () => {
    const kb = new Zx81Keyboard();
    kb.handleKey(physEvent('KeyP'), true);
    kb.setKey('KeyP', true);
    kb.setKey('KeyP', false);
    expect(pPressed(kb)).toBe(true);
    kb.handleKey(physEvent('KeyP'), false);
    expect(pPressed(kb)).toBe(false);
  });

  it('is idempotent against physical keydown auto-repeat', () => {
    const kb = new Zx81Keyboard();
    kb.handleKey(physEvent('KeyP'), true);
    kb.handleKey(physEvent('KeyP'), true); // auto-repeat
    kb.handleKey(physEvent('KeyP'), true);
    kb.handleKey(physEvent('KeyP'), false);
    expect(pPressed(kb)).toBe(false);
  });

  it('supports simultaneous multi-key chords from the virtual source', () => {
    const kb = new Zx81Keyboard();
    kb.setKey('Shift', true);
    kb.setKey('KeyP', true);
    expect(shiftPressed(kb)).toBe(true);
    expect(pPressed(kb)).toBe(true);
  });

  it('releaseAll clears both sources', () => {
    const kb = new Zx81Keyboard();
    kb.setKey('Shift', true);
    kb.handleKey(physEvent('KeyP'), true);
    kb.releaseAll();
    expect(shiftPressed(kb)).toBe(false);
    expect(pPressed(kb)).toBe(false);
    // a stale keyup after releaseAll must not corrupt state
    kb.handleKey(physEvent('KeyP'), false);
    expect(pPressed(kb)).toBe(false);
  });
});
