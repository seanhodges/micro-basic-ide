import { fake6502, type Cpu6502 } from 'jsbeeb/src/fake6502.js';
import { findModel } from 'jsbeeb/src/models.js';
import { Video } from 'jsbeeb/src/video.js';
import { FakeSoundChip } from 'jsbeeb/src/soundchip.js';
import * as utils from 'jsbeeb/src/utils.js';
import type { MachineEmulator } from '../../dialects/types';
import { BbcHostKeyboard, matrixForToken } from './keyboard';

/** jsbeeb's Video ULA renders into a fixed 1024×625 RGBA framebuffer… */
const FB_WIDTH = 1024;
const FB_HEIGHT = 625;
/** …of which the standard visible rect (jsbeeb's own canvas size) is 896×600. */
export const BBC_DISPLAY_WIDTH = 896;
export const BBC_DISPLAY_HEIGHT = 600;

const CPU_HZ = 2_000_000;
const CYCLES_PER_FRAME = CPU_HZ / 50;
/** Cycles from hard reset to the BASIC prompt (bbcmicrobot-proven value). */
const BOOT_CYCLES = 725_000;

/** OS 1.20 keyboard buffer: page-3 offset pointer at 0x2E1, wraps to 0xE0. */
const KBD_BUFFER_BASE = 0x300;
const KBD_BUFFER_INSERT_PTR = 0x2e1;

// In the browser, jsbeeb fetches 'roms/…' relative to this base; the images
// are committed under public/roms/ in the layout jsbeeb expects.
if (typeof window !== 'undefined') {
  utils.setBaseUrl(import.meta.env.BASE_URL);
}

/** Point jsbeeb's ROM loader at its package root when running under node. */
export function configureNodeRomPath(jsbeebRoot: string): void {
  utils.setNodeBasePath(jsbeebRoot);
}

/**
 * The BBC Micro Model B, wrapped around the jsbeeb emulator
 * (https://github.com/mattgodbolt/jsbeeb, GPL-3.0-or-later).
 *
 * Unlike the in-tree Z80 machines this adapter delegates all hardware
 * emulation — 6502, video ULA + CRTC + SAA5050 teletext, VIAs, keyboard — to
 * jsbeeb and only maps its API onto the MachineEmulator contract. The dialect
 * tokenizes BASIC to the genuine BASIC II byte layout (see
 * src/dialects/bbcmicro/tokenizer.ts), so loading is simply: poke the image at
 * PAGE, fix up TOP/VARTOP, then type RUN into the OS keyboard buffer.
 */
export class BbcMachine implements MachineEmulator {
  readonly displayWidth = BBC_DISPLAY_WIDTH;
  readonly displayHeight = BBC_DISPLAY_HEIGHT;

  private readonly cpu: Cpu6502;
  private readonly hostKeyboard: BbcHostKeyboard;
  private readonly fb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
  /** Snapshot of the last complete frame, copied at paint time. */
  private readonly completeFb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
  private lastPaint = { minx: 80, miny: 12, maxx: 976, maxy: 612 };

  private readonly ready: Promise<void>;
  private initialised = false;
  private injecting = false;
  private loadGeneration = 0;
  private loadError = '';
  private speed = 1;
  private disposed = false;

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor() {
    const model = findModel('B');
    const fb32 = new Uint32Array(this.fb8.buffer);
    const video = new Video(model.isMaster, fb32, (minx, miny, maxx, maxy) => {
      this.lastPaint = { minx, miny, maxx, maxy };
      // Snapshot now — jsbeeb clears fb32 for the next frame after painting.
      this.completeFb8.set(this.fb8);
    });
    this.cpu = fake6502(model, { video, soundChip: new FakeSoundChip() });
    this.hostKeyboard = new BbcHostKeyboard(this.cpu.sysvia);
    this.ready = this.cpu.initialise().then(() => {
      this.initialised = true;
    });
    this.ready.catch((e) => {
      this.loadError = e instanceof Error ? e.message : String(e);
    });
  }

  /** Resolves once the ROMs are loaded and the machine can run (for tests). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Direct CPU access for tests and debugging. */
  get processor(): Cpu6502 {
    return this.cpu;
  }

  reset(): void {
    this.loadGeneration++;
    this.loadError = '';
    void this.ready.then(() => {
      if (!this.disposed) this.cpu.reset(true);
    });
  }

  runFrame(): void {
    if (!this.initialised || this.injecting || this.disposed) return;
    this.cpu.execute(Math.round(CYCLES_PER_FRAME * this.speed));
  }

  /**
   * Inject a tokenized BASIC program (the dialect's "image": the BASIC II
   * in-memory layout, terminated by 0x0D 0xFF). ROM loading is async, so the
   * work is queued; frames render the machine booting in the meantime and the
   * program starts as soon as the pipeline lands it.
   */
  loadProgram(image: Uint8Array): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed) return;
        this.injecting = true;
        try {
          this.cpu.sysvia.clearKeys();
          this.cpu.reset(true);
          this.cpu.execute(BOOT_CYCLES);
          const page = this.cpu.readmem(0x18) << 8;
          if (page === 0) throw new Error('BBC OS did not boot to BASIC');
          for (let i = 0; i < image.length; i++) {
            this.cpu.writemem(page + i, image[i]!);
          }
          // TOP and VARTOP point past the program so BASIC accepts it.
          const end = page + image.length;
          this.cpu.writemem(0x02, end & 0xff);
          this.cpu.writemem(0x03, (end >>> 8) & 0xff);
          this.cpu.writemem(0x12, end & 0xff);
          this.cpu.writemem(0x13, (end >>> 8) & 0xff);
          this.typeIntoOsBuffer('RUN\r');
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('BBC loadProgram failed:', e);
        }
      }
    })();
  }

  /** Write keystrokes straight into the OS 1.20 keyboard buffer. */
  private typeIntoOsBuffer(text: string): void {
    let ptr = this.cpu.readmem(KBD_BUFFER_INSERT_PTR);
    for (let i = 0; i < text.length; i++) {
      this.cpu.writemem(KBD_BUFFER_BASE + ptr, text.charCodeAt(i));
      ptr++;
      if (ptr > 0xff) ptr = 0xe0;
    }
    this.cpu.writemem(KBD_BUFFER_INSERT_PTR, ptr);
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = FB_WIDTH;
      this.backCanvas.height = FB_HEIGHT;
      this.backImageData = new ImageData(FB_WIDTH, FB_HEIGHT);
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.completeFb8);
    const { minx, miny, maxx, maxy } = this.lastPaint;
    backCtx.putImageData(
      this.backImageData,
      0,
      0,
      minx,
      miny,
      maxx - minx,
      maxy - miny,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      minx,
      miny,
      maxx - minx,
      maxy - miny,
      0,
      0,
      this.displayWidth,
      this.displayHeight,
    );
    if (this.loadError) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, this.displayHeight - 28, this.displayWidth, 28);
      ctx.fillStyle = '#ff6666';
      ctx.font = '14px monospace';
      ctx.fillText(this.loadError, 8, this.displayHeight - 10);
    }
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    // F12 acts as the BREAK key (reset line), as in jsbeeb itself.
    if (e.key === 'F12' || e.key === 'Pause') {
      this.cpu.setReset(down);
      return true;
    }
    if (e.metaKey || e.key === 'F11') return false;
    return this.hostKeyboard.handleKey(e, down);
  }

  setKey(token: string, down: boolean): void {
    if (token === 'Break') {
      this.cpu.setReset(down);
      return;
    }
    const colRow = matrixForToken(token);
    if (!colRow) return;
    if (down) this.cpu.sysvia.keyDownRaw(colRow);
    else this.cpu.sysvia.keyUpRaw(colRow);
  }

  releaseAllKeys(): void {
    this.cpu.sysvia.clearKeys();
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
    this.cpu.sysvia.clearKeys();
  }
}
