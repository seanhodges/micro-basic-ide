# Adding a new BASIC dialect

The app only talks to the `Dialect` interface (`src/dialects/types.ts`);
everything machine-specific lives in one folder. To add, say, ZX Spectrum
BASIC:

1. **Create `src/dialects/spectrum/`** mirroring `src/dialects/zx81/`:
   - `keywords.ts` — the token table (`KeywordInfo[]`). This alone powers
     highlighting and autocomplete via the generic builders in `src/editor/`.
   - `charset.ts` — a `CharsetMapping` between editor text and machine codes.
   - `tokenizer.ts` / `detokenizer.ts` — text ↔ tokenized program bytes.
   - an image builder (the Spectrum equivalent of `pfile.ts` is a `.tap`/
     `.sna` builder).
   - `emulator/` — a `MachineEmulator` implementation. The Z80 core in
     `src/emulator/z80/` is machine-independent; provide your own bus
     (memory map, ULA ports, contention model as needed).
   - `aiProfile.ts` — a system prompt teaching Claude the dialect's rules.
   - `targets.ts` — `BuildTarget[]` for file exports, plus optional cassette
     audio support.
   - `index.ts` — assemble and export the `Dialect` object.
2. **Register it** in `src/dialects/registry.ts`.
3. **Drop the ROM** into `public/roms/` with an attribution note.
4. **Add tests**: tokenizer round-trip, image-builder pointer consistency,
   and a machine boot test like `zx81Machine.test.ts` (boot the ROM, inject a
   program, assert on display memory).

Nothing outside the dialect folder should need to change: the editor, lint,
status bar, AI panel, transfer dialog and emulator pane all operate on the
interface. Dialects whose display is not the classic 256×192 set
`displaySize` on the `Dialect` object; the emulator pane sizes its canvas
from it.

## Wrapping an existing emulator instead

A dialect's `MachineEmulator` does not have to be built from an in-tree CPU
core: the BBC Micro target (`src/dialects/bbcmicro/`) wraps the
[jsbeeb](https://github.com/mattgodbolt/jsbeeb) npm package behind an adapter
in `src/emulator/bbc/`. That pattern looks like:

- an adapter class implementing `MachineEmulator`, confining all contact
  with the third-party API to one folder, plus a hand-written `.d.ts` for
  the surface used (jsbeeb ships no types);
- ROM assets copied into `public/roms/` in the layout the package's loader
  expects, with attribution;
- a native tokenizer is still preferred over delegating to the emulated ROM:
  the BBC dialect tokenizes in TypeScript (`src/dialects/bbcmicro/tokenizer.ts`)
  to the genuine BASIC II byte layout, so the emulator just pokes the `image`
  in at PAGE — the same image used for `.bbc` import/export. Its output is
  regression-tested byte-for-byte against jsbeeb's ROM tokeniser
  (`tokenizer.test.ts`), which is how the keyword flags were pinned down.

Mind the license: jsbeeb is GPL-3.0-or-later, which is why this project is
GPL — see the License section in the README before adding a dependency under
a different license.

### BBC Micro follow-up checklist

Done: native tokenizer/detokenizer + linter (real `byteSize`, syntax errors
in the editor), full keyword table, and `.bbc` tokenized-program import/export.
Still to do: authentic keyboard layout styling/theme, sound (real jsbeeb
SoundChip + WebAudio), dot-abbreviation expansion in the tokenizer (`P.` →
`PRINT`), and richer build targets (`.ssd` disc / UEF cassette export).
