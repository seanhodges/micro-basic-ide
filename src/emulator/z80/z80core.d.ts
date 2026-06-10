/** Bus interface the vendored Z80 core calls into. */
export interface Z80Bus {
  mem_read(address: number): number;
  mem_write(address: number, value: number): void;
  io_read(port: number): number;
  io_write(port: number, value: number): void;
  /**
   * Optional M1 opcode-fetch hook (micro-basic-ide patch). When present it is
   * used instead of mem_read for the primary opcode fetch only — this is what
   * lets the ZX81 machine return NOP for display-file bytes executed in the
   * echo region without affecting data reads.
   */
  opcode_read?(address: number): number;
}

export interface Z80Flags {
  S: number; Z: number; Y: number; H: number; X: number; P: number; N: number; C: number;
}

export interface Z80State {
  a: number; b: number; c: number; d: number; e: number; h: number; l: number;
  a_prime: number; b_prime: number; c_prime: number; d_prime: number;
  e_prime: number; h_prime: number; l_prime: number;
  ix: number; iy: number; i: number; r: number; sp: number; pc: number;
  flags: Z80Flags; flags_prime: Z80Flags;
  imode: number; iff1: number; iff2: number;
  halted: boolean; do_delayed_di: boolean; do_delayed_ei: boolean;
  cycle_counter: number;
}

export interface Z80Core {
  getState(): Z80State;
  setState(state: Z80State): void;
  reset(): void;
  /** Runs one instruction; returns T-states consumed (including interrupt overhead). */
  run_instruction(): number;
  /** Pulse INT (non_maskable=false) or NMI (non_maskable=true). */
  interrupt(non_maskable: boolean, data: number): void;
  // micro-basic-ide additions:
  getPC(): number;
  setPC(value: number): void;
  getR(): number;
  setR(value: number): void;
  getIFF1(): number;
  isHalted(): boolean;
  clearHalt(): void;
}

declare function Z80(core: Z80Bus): Z80Core;
export default Z80;
