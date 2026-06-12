/**
 * ZX81 keyboard: an 8x5 matrix. Each half-row is selected by pulling one of
 * the address lines A8-A15 low during IN (0xFE); pressed keys read as 0 in
 * bits 0-4.
 */
const ROWS: string[][] = [
  // A8                     bit0        bit1    bit2    bit3    bit4
  ['Shift', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'],
  // A9
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'],
  // A10
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT'],
  // A11
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'],
  // A12
  ['Digit0', 'Digit9', 'Digit8', 'Digit7', 'Digit6'],
  // A13
  ['KeyP', 'KeyO', 'KeyI', 'KeyU', 'KeyY'],
  // A14
  ['Enter', 'KeyL', 'KeyK', 'KeyJ', 'KeyH'],
  // A15
  ['Space', 'Period', 'KeyM', 'KeyN', 'KeyB'],
];

/** Host keys translated to ZX81 shift combinations: code -> [code...] */
const COMBOS: Record<string, string[]> = {
  Backspace: ['Shift', 'Digit0'], // RUBOUT
  ArrowLeft: ['Shift', 'Digit5'],
  ArrowDown: ['Shift', 'Digit6'],
  ArrowUp: ['Shift', 'Digit7'],
  ArrowRight: ['Shift', 'Digit8'],
  Comma: ['Shift', 'Period'], // , is shift-. on the ZX81
};

const keyPosition = new Map<string, { row: number; bit: number }>();
ROWS.forEach((keys, row) =>
  keys.forEach((code, bit) => keyPosition.set(code, { row, bit })),
);

export class Zx81Keyboard {
  /** Bit set = key currently pressed; matrix[row] bits 0-4. */
  private readonly matrix = new Uint8Array(8);
  /** Keys held via the physical keyboard (handleKey). */
  private readonly physicalDown = new Set<string>();
  /** Keys held via the virtual keyboard or scripted input (setKey). */
  private readonly virtualDown = new Set<string>();

  /** Translate a host key event into matrix state. Returns true if consumed. */
  handleKey(e: KeyboardEvent, down: boolean): boolean {
    const codes = this.translate(e);
    if (codes.length === 0) return false;
    for (const code of codes) {
      if (down) this.physicalDown.add(code);
      else this.physicalDown.delete(code);
      this.applyKey(code);
    }
    return true;
  }

  releaseAll(): void {
    this.physicalDown.clear();
    this.virtualDown.clear();
    this.matrix.fill(0);
  }

  /** Press/release a matrix key directly by its code (virtual/scripted input). */
  setKey(code: string, down: boolean): void {
    if (!keyPosition.has(code)) return;
    if (down) this.virtualDown.add(code);
    else this.virtualDown.delete(code);
    this.applyKey(code);
  }

  /**
   * Sync one matrix cell with the union of both press sources, so a physical
   * keyup can't release a key the virtual keyboard still holds (and vice
   * versa).
   */
  private applyKey(code: string): void {
    const pos = keyPosition.get(code);
    if (!pos) return;
    const down = this.physicalDown.has(code) || this.virtualDown.has(code);
    if (down) this.matrix[pos.row] = this.matrix[pos.row]! | (1 << pos.bit);
    else this.matrix[pos.row] = this.matrix[pos.row]! & ~(1 << pos.bit);
  }

  private translate(e: KeyboardEvent): string[] {
    const code = e.code;
    if (code === 'ShiftLeft' || code === 'ShiftRight') return ['Shift'];
    if (code in COMBOS) return COMBOS[code]!;
    if (keyPosition.has(code)) return [code];
    return [];
  }

  /**
   * Compose the value returned by IN (0xFE) for the given high address byte.
   * Bits 0-4: keys (active low) for every half-row whose select line is low.
   * Bit 5: unused (1). Bit 6: 50Hz display (1 = PAL). Bit 7: unused (1).
   */
  readPort(highByte: number): number {
    let keys = 0x1f;
    for (let row = 0; row < 8; row++) {
      if ((highByte & (1 << row)) === 0) {
        keys &= ~this.matrix[row]! & 0x1f;
      }
    }
    return 0xe0 | keys;
  }
}
