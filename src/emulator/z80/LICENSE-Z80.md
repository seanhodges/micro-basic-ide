# Vendored Z80 core

`z80core.js` is a vendored copy of [Z80.js](https://github.com/DrGoldfire/Z80.js)
by Molly Howell, released under the MIT license.

## Local modifications

The following patches were applied for micro-basic-ide (all marked in-source):

1. **M1 opcode-fetch hook** — the primary opcode fetch in `run_instruction`
   uses `core.opcode_read(pc)` when the bus provides it, falling back to
   `core.mem_read(pc)`. The ZX81 machine uses this to feed the CPU NOPs when
   it "executes" the display file in the echoed memory region (the hardware
   trick behind ZX81 video), without affecting ordinary data reads.
2. **Lightweight accessors** — `getPC/setPC/getR/setR/getIFF1/isHalted/clearHalt`
   were added to the public API so the machine loop can generate the ZX81's
   R-register-driven maskable interrupt and emulate R refresh increments
   during HALT without allocating a full state object per instruction.
3. **ESM export** — `export default Z80;` appended.

## Original license (MIT)

Copyright (c) Molly Howell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
