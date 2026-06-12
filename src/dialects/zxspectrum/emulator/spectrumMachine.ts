import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import type { MachineEmulator } from '../../types';
import { SpectrumMemory } from './memory';
import { SpectrumKeyboard } from './keyboard';
import { renderDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';
import { buildTap, parseTap } from '../tapfile';

const TSTATES_PER_FRAME = 69888; // 3.5MHz / ~50.08Hz (48K ULA frame)
const FLASH_FRAMES = 16; // FLASH attribute toggles every 16 frames
const MAX_BOOT_FRAMES = 200;
const LD_BYTES = 0x0556; // ROM tape-loader entry; trapped for flash loading

/**
 * The ZX Spectrum 48K: Z80 + 16K ROM + 48K RAM + the ULA pieces the unmodified
 * ROM needs to boot and run BASIC:
 *
 *  - One maskable interrupt (IM1 / RST 38h) per 50Hz frame, driving the
 *    keyboard scan and the FRAMES counter.
 *  - Keyboard matrix and border on port 0xFE.
 *  - A flash-load trap at the ROM's LD-BYTES routine: while a program is queued
 *    the trap satisfies the header and data block reads directly, so LOAD ""
 *    behaves exactly as a cassette load (auto-running when the .TAP header
 *    carries an auto-start line).
 *
 * The display is rendered as a per-frame snapshot of screen + attribute memory
 * (see display.ts) — faithful for BASIC programs without cycle-exact video.
 */
export class SpectrumMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly memory: SpectrumMemory;
  private readonly keyboard = new SpectrumKeyboard();
  private readonly cpu: Z80Core;
  private border = 7;
  private speed = 1;
  private frameCount = 0;
  private imageData: ImageData | null = null;
  private disposed = false;
  /** Header + data blocks waiting to be injected at the next LOAD. */
  private pending: { header: Uint8Array; data: Uint8Array } | null = null;

  constructor(opts: { rom: Uint8Array }) {
    this.memory = new SpectrumMemory(opts.rom);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: (port: number) => {
        if ((port & 0x01) === 0) {
          // ULA: keyboard on the high address byte (EAR/bits 5-7 read high).
          return this.keyboard.readPort((port >> 8) & 0xff);
        }
        return 0xff;
      },
      io_write: (port: number, value: number) => {
        if ((port & 0x01) === 0) this.border = value & 0x07;
      },
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.clearRam();
    this.keyboard.releaseAll();
    this.pending = null;
    this.border = 7;
    this.frameCount = 0;
    this.cpu.reset();
  }

  runFrame(): void {
    const budget = TSTATES_PER_FRAME * this.speed;
    let cycles = 0;
    // One maskable interrupt per frame (IM1) when interrupts are enabled.
    if (this.cpu.getIFF1()) this.cpu.interrupt(false, 0xff);

    while (cycles < budget) {
      if (this.pending && this.cpu.getPC() === LD_BYTES) {
        this.serviceLoadTrap();
        continue;
      }
      if (this.cpu.isHalted()) break; // idle until the next frame's interrupt
      cycles += this.cpu.run_instruction();
    }
    this.frameCount++;
  }

  /**
   * Satisfy one ROM LD-BYTES call: A holds the expected flag (0x00 header /
   * 0xFF data), IX the destination, DE the byte count. Fill the block, advance
   * IX, and return to the caller with carry set (success).
   */
  private serviceLoadTrap(): void {
    const st = this.cpu.getState();
    const length = (st.d << 8) | st.e;
    const block = st.a === 0x00 ? this.pending!.header : this.pending!.data;
    for (let k = 0; k < length; k++) {
      this.memory.write((st.ix + k) & 0xffff, block[k] ?? 0);
    }
    if (st.a !== 0x00) {
      // Data block loaded: wipe the "Program: …" load chatter and reset the
      // print position so the program auto-runs onto a clean screen.
      this.clearScreen();
      this.pending = null;
    }

    const ret = this.memory.readWord(st.sp);
    st.sp = (st.sp + 2) & 0xffff;
    st.pc = ret;
    st.ix = (st.ix + length) & 0xffff;
    st.d = 0;
    st.e = 0;
    st.flags.C = 1; // success
    this.cpu.setState(st);
  }

  /**
   * CHARS (0x5C36) becomes 0x3C00 once the boot init has run (the RAM test
   * first fills all RAM with 0x02, so screen contents are not a reliable
   * signal on their own). Interrupts are enabled by then.
   */
  private isInitialised(): boolean {
    return this.memory.readWord(0x5c36) === 0x3c00 && this.cpu.getIFF1() === 1;
  }

  /** True once the bottom editing line carries the copyright prompt. */
  private promptDrawn(): boolean {
    for (let xb = 0; xb < 32; xb++) {
      for (let r = 0; r < 8; r++) {
        const y = 23 * 8 + r;
        const addr =
          0x4000 |
          ((y & 0x07) << 8) |
          ((y & 0x38) << 2) |
          ((y & 0xc0) << 5) |
          xb;
        if (this.memory.read(addr) !== 0) return true;
      }
    }
    return false;
  }

  /** Run whole frames until the ROM has booted to the ready prompt. */
  bootToReady(): void {
    let initFrame = -1;
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (initFrame < 0) {
        if (this.isInitialised()) initFrame = frame;
      } else if (frame - initFrame >= 4 && this.promptDrawn()) {
        return;
      }
    }
    throw new Error('ZX Spectrum ROM did not boot — emulator bug');
  }

  /** Hold a key chord for a few frames, then release it. */
  private tapKeys(codes: string[], holdFrames = 4): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < holdFrames; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 4; i++) this.runFrame();
  }

  loadProgram(image: Uint8Array): void {
    this.reset();
    this.bootToReady();
    // Inject without an auto-start line, then drive RUN: the LOAD-with-LINE
    // auto-run path skips the CLEAR that sets up the variable/stack pointers,
    // whereas RUN performs it, so variables behave correctly.
    const { program } = parseTap(image);
    const { header, data } = parseTap(buildTap(program, { autoStart: null }));
    this.pending = { header, data };
    // Type LOAD "" — J is LOAD in keyword mode, then two SYMBOL SHIFT+P quotes.
    this.tapKeys(['KeyJ']);
    this.tapKeys(['SymShift', 'KeyP']);
    this.tapKeys(['SymShift', 'KeyP']);
    this.tapKeys(['Enter']);
    for (let i = 0; i < 200 && this.pending; i++) this.runFrame();
    if (this.pending) {
      this.pending = null;
      throw new Error('ZX Spectrum ROM never reached the LOAD trap');
    }
    // Start the program with a proper RUN (R is the RUN keyword in K mode).
    // The ENTER that submits RUN is released quickly so it is no longer held
    // when the program's first statement runs — otherwise an opening INKEY$
    // would read the ENTER key instead of "".
    this.tapKeys(['KeyR']);
    this.tapKeys(['Enter'], 2);
    for (let i = 0; i < 12; i++) this.runFrame();
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    const flashPhase = Math.floor(this.frameCount / FLASH_FRAMES) % 2 === 1;
    renderDisplay(this.memory, this.imageData.data, flashPhase);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** Clear the display to black-on-white and home the upper-screen print cursor. */
  private clearScreen(): void {
    for (let a = 0x4000; a < 0x5800; a++) this.memory.write(a, 0x00);
    for (let a = 0x5800; a < 0x5b00; a++) this.memory.write(a, 0x38);
    this.memory.writeWord(0x5c84, 0x4000); // DF_CC: upper-screen print address
    this.memory.write(0x5c88, 33); // S_POSN column (33 = leftmost)
    this.memory.write(0x5c89, 24); // S_POSN line (24 = top)
  }

  /** Direct access for tests and debugging. */
  get mem(): SpectrumMemory {
    return this.memory;
  }

  get borderColor(): number {
    return this.border;
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleKey(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.keyboard.setKey(token, down);
  }

  releaseAllKeys(): void {
    this.keyboard.releaseAll();
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
