/**
 * ZX Spectrum keyboard: an 8x5 matrix, electrically identical to the ZX81's.
 * Each half-row is selected by pulling one of the address lines A8-A15 low
 * during IN (0xFE); pressed keys read as 0 in bits 0-4. CAPS SHIFT sits where
 * the ZX81's SHIFT was; SYMBOL SHIFT replaces the ZX81's '.' key.
 */
const ROWS: string[][] = [
  // A8                          bit0      bit1     bit2    bit3    bit4
  ['CapsShift', 'KeyZ', 'KeyX', 'KeyC', 'KeyV'],
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
  ['Space', 'SymShift', 'KeyM', 'KeyN', 'KeyB'],
];

/** Host keys translated to Spectrum key combinations: code -> [token…] */
const COMBOS: Record<string, string[]> = {
  Backspace: ['CapsShift', 'Digit0'], // DELETE
  ArrowLeft: ['CapsShift', 'Digit5'],
  ArrowDown: ['CapsShift', 'Digit6'],
  ArrowUp: ['CapsShift', 'Digit7'],
  ArrowRight: ['CapsShift', 'Digit8'],
  Comma: ['SymShift', 'KeyN'],
  Period: ['SymShift', 'KeyM'],
  Semicolon: ['SymShift', 'KeyO'],
  Quote: ['SymShift', 'KeyP'],
  Minus: ['SymShift', 'KeyJ'],
  Equal: ['SymShift', 'KeyL'],
  Slash: ['SymShift', 'KeyV'],
};

const keyPosition = new Map<string, { row: number; bit: number }>();
ROWS.forEach((keys, row) =>
  keys.forEach((code, bit) => keyPosition.set(code, { row, bit })),
);

export class SpectrumKeyboard {
  /** Bit set = key currently pressed; matrix[row] bits 0-4. */
  private readonly matrix = new Uint8Array(8);
  private readonly physicalDown = new Set<string>();
  private readonly virtualDown = new Set<string>();

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

  setKey(code: string, down: boolean): void {
    if (!keyPosition.has(code)) return;
    if (down) this.virtualDown.add(code);
    else this.virtualDown.delete(code);
    this.applyKey(code);
  }

  /** Sync one matrix cell with the union of both press sources. */
  private applyKey(code: string): void {
    const pos = keyPosition.get(code);
    if (!pos) return;
    const down = this.physicalDown.has(code) || this.virtualDown.has(code);
    if (down) this.matrix[pos.row] = this.matrix[pos.row]! | (1 << pos.bit);
    else this.matrix[pos.row] = this.matrix[pos.row]! & ~(1 << pos.bit);
  }

  private translate(e: KeyboardEvent): string[] {
    const code = e.code;
    if (code === 'ShiftLeft' || code === 'ShiftRight') return ['CapsShift'];
    if (code === 'ControlLeft' || code === 'ControlRight') return ['SymShift'];
    if (code in COMBOS) return COMBOS[code]!;
    if (keyPosition.has(code)) return [code];
    return [];
  }

  /**
   * Compose the value returned by IN (0xFE) for the given high address byte:
   * bits 0-4 are the keys (active low) for every selected half-row; bits 5-7
   * read high.
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
