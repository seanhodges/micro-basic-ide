/**
 * ZX81 memory map:
 *   0x0000-0x1FFF  8K ROM
 *   0x2000-0x3FFF  ROM mirror
 *   0x4000-...     RAM (16/32/64K pack; base machine logic assumes >= 16K here)
 *   0x8000-0xFFFF  echo of 0x0000-0x7FFF (the region the display routine
 *                  "executes"; see the opcode-fetch hook in zx81Machine)
 */
export class Zx81Memory {
  readonly rom: Uint8Array;
  readonly ram: Uint8Array;
  private readonly ramMask: number;

  constructor(rom: Uint8Array, ramKb: 16 | 32 | 64) {
    if (rom.length !== 8192)
      throw new Error(`ZX81 ROM must be 8192 bytes, got ${rom.length}`);
    this.rom = rom;
    this.ram = new Uint8Array(ramKb * 1024);
    this.ramMask = ramKb * 1024 - 1;
  }

  read = (address: number): number => {
    const addr = address & 0x7fff; // echo region mirrors the lower 32K
    if (addr < 0x4000) return this.rom[addr & 0x1fff]!;
    return this.ram[(addr - 0x4000) & this.ramMask]!;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0x7fff;
    if (addr < 0x4000) return; // ROM
    this.ram[(addr - 0x4000) & this.ramMask] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }
}
