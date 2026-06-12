/**
 * ZX Spectrum 48K memory map:
 *   0x0000-0x3FFF  16K ROM
 *   0x4000-0x57FF  display bitmap (6144 bytes)
 *   0x5800-0x5AFF  attribute map (768 bytes)
 *   0x5B00-0xFFFF  general RAM (system variables, program, stacks…)
 *
 * Contended-memory timing is not modelled — it does not affect BASIC results.
 */
export class SpectrumMemory {
  readonly rom: Uint8Array;
  readonly ram = new Uint8Array(0xc000); // 48K, addressed from 0x4000

  constructor(rom: Uint8Array) {
    if (rom.length !== 16384)
      throw new Error(`ZX Spectrum ROM must be 16384 bytes, got ${rom.length}`);
    this.rom = rom;
  }

  read = (address: number): number => {
    const addr = address & 0xffff;
    if (addr < 0x4000) return this.rom[addr]!;
    return this.ram[addr - 0x4000]!;
  };

  write = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (addr < 0x4000) return; // ROM is read-only
    this.ram[addr - 0x4000] = value & 0xff;
  };

  readWord(addr: number): number {
    return this.read(addr) | (this.read(addr + 1) << 8);
  }

  writeWord(addr: number, value: number): void {
    this.write(addr, value & 0xff);
    this.write(addr + 1, (value >> 8) & 0xff);
  }

  /** Clear RAM (full machine reset). */
  clearRam(): void {
    this.ram.fill(0);
  }
}
