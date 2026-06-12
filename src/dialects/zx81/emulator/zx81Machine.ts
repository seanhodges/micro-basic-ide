import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import type { MachineEmulator } from '../../types';
import { Zx81Memory } from './memory';
import { Zx81Keyboard } from './keyboard';
import { renderDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';
import { SYSVARS_BASE, D_FILE, ROM_LOAD_TRAP, ROM_POST_LOAD } from '../sysvars';
import { NEWLINE } from '../charset';

const TSTATES_PER_FRAME = 65000; // 3.25MHz / 50Hz
const TSTATES_PER_NMI = 208; // one TV scanline
const MAX_BOOT_FRAMES = 600;

/**
 * The ZX81 machine: Z80 + ROM + RAM + the minimal hardware set that lets the
 * unmodified ROM run in both FAST and SLOW mode:
 *
 *  - Echoed memory at 0x8000+ where M1 opcode fetches of bytes with bit 6
 *    clear execute as NOP (the ROM "executes" the display file this way).
 *  - The NMI generator (OUT 0xFD off / OUT 0xFE on, one NMI per scanline).
 *  - The maskable interrupt wired to A6 of the refresh address: fires when
 *    the R register's bit 6 goes low while interrupts are enabled.
 *  - Keyboard matrix on IN (0xFE).
 *
 * Video is rendered as a per-frame D_FILE snapshot (see display.ts) rather
 * than cycle-exact scanline generation — correct for BASIC games.
 */
export class Zx81Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly memory: Zx81Memory;
  private readonly keyboard = new Zx81Keyboard();
  private readonly cpu: Z80Core;
  private nmiGeneratorOn = false;
  private nmiCounter = 0;
  private prevRBit6 = true;
  private speed = 1;
  private imageData: ImageData | null = null;
  private disposed = false;
  /** .P image waiting to be injected when the ROM reaches its LOAD loop. */
  private pendingImage: Uint8Array | null = null;

  constructor(opts: { rom: Uint8Array; ramKb: 16 | 32 | 64 }) {
    this.memory = new Zx81Memory(opts.rom, opts.ramKb);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: (port: number) => {
        if ((port & 0x01) === 0) {
          // IN (0xFE): keyboard + config bits (also resets vsync on hardware)
          return this.keyboard.readPort((port >> 8) & 0xff);
        }
        return 0xff;
      },
      io_write: (port: number) => {
        // Any OUT ends the vsync pulse on hardware; we only track the NMI
        // generator: OUT (0xFD) = off (A1 low), OUT (0xFE) = on (A0 low).
        if ((port & 0x02) === 0) {
          this.nmiGeneratorOn = false;
        } else if ((port & 0x01) === 0) {
          this.nmiGeneratorOn = true;
          this.nmiCounter = 0;
        }
      },
      opcode_read: (address: number) => {
        // The ZX81 video trick: M1 fetches in the echo region execute the
        // display file; bytes with bit 6 clear are fed to the CPU as NOP
        // (the hardware puts the byte on the video latch instead).
        const b = this.memory.read(address);
        if (address >= 0x8000 && (b & 0x40) === 0) return 0x00;
        return b;
      },
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.ram.fill(0);
    this.keyboard.releaseAll();
    this.nmiGeneratorOn = false;
    this.nmiCounter = 0;
    this.prevRBit6 = true;
    this.cpu.reset();
  }

  runFrame(): void {
    const budget = TSTATES_PER_FRAME * this.speed;
    let cycles = 0;
    while (cycles < budget) {
      // Flash-load trap: when the ROM sits in its tape-read loop (0x0347),
      // drop the queued .P image into memory and continue at the SLOW/FAST
      // routine — the same place a real tape LOAD hands control back to.
      // The interpreter's return address is on the stack at this point, so
      // it then runs the program via NXTLIN.
      if (this.pendingImage && this.cpu.getPC() === ROM_LOAD_TRAP) {
        const image = this.pendingImage;
        this.pendingImage = null;
        for (let i = 0; i < image.length; i++) {
          this.memory.write(SYSVARS_BASE + i, image[i]!);
        }
        this.keyboard.releaseAll();
        this.cpu.setPC(ROM_POST_LOAD);
      }
      let t: number;
      if (this.cpu.isHalted()) {
        // A halted Z80 still performs refresh cycles: R keeps incrementing,
        // which is what terminates each display line's HALT via the INT.
        const r = this.cpu.getR();
        this.cpu.setR((r & 0x80) | ((r + 1) & 0x7f));
        t = 4;
      } else {
        t = this.cpu.run_instruction();
      }
      cycles += t;

      // Maskable INT on falling edge of R bit 6 (refresh address line A6)
      const rBit6 = (this.cpu.getR() & 0x40) !== 0;
      if (this.prevRBit6 && !rBit6 && this.cpu.getIFF1()) {
        this.cpu.interrupt(false, 0xff);
      }
      this.prevRBit6 = rBit6;

      // NMI generator: one NMI per scanline while enabled
      if (this.nmiGeneratorOn) {
        this.nmiCounter += t;
        while (this.nmiCounter >= TSTATES_PER_NMI) {
          this.nmiCounter -= TSTATES_PER_NMI;
          this.cpu.interrupt(true, 0);
        }
      }
    }
  }

  /** True once the boot screen shows the inverse-K cursor. */
  private hasKCursor(): boolean {
    const dFile = this.memory.readWord(D_FILE);
    if (dFile < SYSVARS_BASE || this.memory.read(dFile) !== NEWLINE)
      return false;
    let addr = dFile;
    for (let i = 0; i < 24 * 33 + 1; i++, addr++) {
      if (this.memory.read(addr) === 0xb0) return true; // inverse K
    }
    return false;
  }

  /** Run whole frames until the ROM has finished booting to the K cursor. */
  bootToBasic(): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (frame >= 10 && this.hasKCursor()) return;
    }
    throw new Error('ZX81 ROM did not boot — emulator bug');
  }

  /** Hold a key chord for a few frames, then release it. */
  private tapKeys(codes: string[]): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < 5; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 5; i++) this.runFrame();
  }

  loadProgram(image: Uint8Array): void {
    this.reset();
    this.bootToBasic();
    // Queue the image, then type LOAD "" on the emulated keyboard. When the
    // ROM reaches its tape-read loop the trap in runFrame() injects the
    // image — the authentic load path, so the program starts exactly as it
    // would from cassette (auto-running if NXTLIN points at line 1).
    this.pendingImage = image;
    this.tapKeys(['KeyJ']); // LOAD (keyword mode)
    this.tapKeys(['Shift', 'KeyP']); // "
    this.tapKeys(['Shift', 'KeyP']); // "
    this.tapKeys(['Enter']);
    for (let i = 0; i < 100 && this.pendingImage; i++) this.runFrame();
    if (this.pendingImage) {
      this.pendingImage = null;
      throw new Error('ZX81 ROM never reached the LOAD trap');
    }
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    renderDisplay(this.memory, this.imageData.data);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** Direct access for tests and debugging. */
  get mem(): Zx81Memory {
    return this.memory;
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleKey(e, down);
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
  }
}
