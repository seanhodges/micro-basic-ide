---
name: adding-a-target-system
description: >-
  Add a new target system (BASIC dialect + emulator + virtual keyboard) to
  micro-basic-ide. Use when the user wants to support a new microcomputer or
  BASIC dialect, port the IDE to another machine, add an emulator for a new
  CPU/bus, or build a virtual keyboard layout for a new target machine.
---

# Adding a new target system to micro-basic-ide

A **target system** is one microcomputer's worth of support: a BASIC **dialect**
(tokenizer, charset, keywords), an **emulator** (CPU bus + display + I/O), and a
**virtual keyboard**. This skill is the workflow that ties those pieces together
in the right order. It does not replace the reference docs — read them.

## The one mental model

The app **only** talks to the `Dialect` and `MachineEmulator` interfaces in
`src/dialects/types.ts`. Everything machine-specific lives in a single folder,
`src/dialects/<name>/`, mirroring `src/dialects/zx81/` (the only existing target).
If you find yourself editing anything outside your new dialect folder — except
`src/dialects/registry.ts`, a ROM asset, and an optional CSS theme block — stop
and reconsider: the seam is being violated.

## Read first (authoritative references)

Before writing any code, read these. They contain the binary layouts, type
shapes, and worked examples this skill only summarizes:

- `docs/adding-a-dialect.md` — the dialect folder and its files.
- `docs/adding-a-virtual-keyboard.md` — the full keyboard guide (data model,
  `setKey` wiring, theming, tests).
- `docs/file-formats.md` — editor text, tokenized program layout, image/`.P`
  format, cassette audio.
- `docs/serial-protocol.md` — the WebSerial bridge (only if you add serial
  transfer).
- `src/dialects/types.ts` — the exact `Dialect`, `MachineEmulator`, `KeywordInfo`,
  `CharsetMapping`, `BuildTarget`, `AiProfile` shapes.

Copy from `src/dialects/zx81/` and `src/keyboard/` as you go — those are the
working examples for every step below.

## Build order

Work inside a new `src/dialects/<name>/` folder. Each step names the interface it
satisfies and the zx81 file to mirror.

1. **`keywords.ts`** — a `KeywordInfo[]` table (`word`, `token`, `kind`,
   optional `signature`/`doc`). This alone powers highlighting and autocomplete
   via the generic builders in `src/editor/`. Mirror `zx81/keywords.ts`.

2. **`charset.ts`** — a `CharsetMapping` (`toMachine` text→codes throwing
   `CharsetError` on unmappable input, `toUnicode` codes→text, `glyph` for a
   single code). Mirror `zx81/charset.ts`.

3. **`tokenizer.ts` / `detokenizer.ts`** — text ↔ tokenized program bytes. The
   tokenizer **collects `TokenizeError[]` (1-based line, 0-based column) — it does
   not throw** — so errors surface inline in the editor. See `docs/file-formats.md`
   for the tokenized line layout. Mirror `zx81/tokenizer.ts`.

4. **Image builder** — the per-machine equivalent of `zx81/pfile.ts` (e.g. a
   `.tap`/`.sna`/`.p` builder). Turns tokenized program bytes into the full
   loadable memory image and parses it back. See `docs/file-formats.md`.

5. **`language.ts`** — `languageSupport(): Extension` and a `CompletionSource`,
   built from the generic builders in `src/editor/`. Mirror `zx81/language.ts`.

6. **`emulator/`** — a `MachineEmulator` implementation. Two proven shapes:
   - **In-tree bus over a shared CPU core** (Sinclair pattern): **reuse the
     machine-independent Z80 core at `src/emulator/z80/` — do not modify it**;
     supply your own bus (memory map, I/O ports, any contention model). Mirror
     the zx81 split: `emulator/<machine>.ts` (the class), `memory.ts`,
     `display.ts`, `keyboard.ts`.
   - **Adapter over an npm emulator** (BBC pattern): wrap the package behind an
     adapter folder like `src/emulator/bbc/` (jsbeeb) with a hand-written
     `.d.ts` for the API surface used; copy its ROMs into `public/roms/` in the
     layout its loader expects; set `displaySize` on the `Dialect` when the
     screen is not 256×192. **Check the package license first** — jsbeeb's
     GPL-3.0 is why this project is GPL.

   Either way, implement every `MachineEmulator` method:
   - `reset()` — full reset.
   - `loadProgram(image)` — inject a built image post-boot and arrange for it to
     run (zx81 does this via a ROM load trap + setting the next-line pointer).
   - `runFrame()` — advance one 50 Hz display frame of CPU time.
   - `renderTo(ctx)` — draw the display to the canvas; expose `displayWidth` /
     `displayHeight`.
   - `keyEvent(e, down)` — physical keyboard, returns `true` when consumed.
   - `setKey(token, down)` — virtual keyboard tokens → key matrix (see step 7).
   - `releaseAllKeys()`, `setSpeed(multiplier)`, `dispose()`.

7. **`keyboardLayout.ts`** — a `KeyboardLayout` value (pure data: keys, legends,
   layers, modifiers, glyphs, optional editor modes). **The virtual keyboard is
   entirely data-driven — `src/keyboard/VirtualKeyboard.tsx` and
   `src/keyboard/inputEngine.ts` need no changes.** Import types from
   `src/keyboard/layoutSchema.ts`; copy `zx81/keyboardLayout.ts` (a full
   5-layer / 4-editor-mode example). Wire the keys into your emulator's
   `setKey(token, down)`: the token strings are opaque to the framework, so pick
   whatever maps naturally to your matrix. **Keep separate `physicalDown` and
   `virtualDown` sets and union them when writing the matrix** so a physical keyup
   never releases a key the virtual keyboard still holds (and vice versa). Full
   detail and the matrix pattern: `docs/adding-a-virtual-keyboard.md` §1–2;
   reference `zx81/emulator/keyboard.ts`.

8. **`aiProfile.ts`** — an `AiProfile` (`model`, `systemPrompt`, `maxTokens`)
   whose system prompt teaches Claude the dialect's rules, constraints, and perf
   tricks. Mirror `zx81/aiProfile.ts`.

9. **`targets.ts`** — a `BuildTarget[]` for file exports (each with `id`, `label`,
   optional `fileExtension`, and `build(source, opts)` → `Blob`), plus optional
   cassette `audio` ({ `sampleRate`, `buildSamples`, `loadInstructions` }). See
   `docs/file-formats.md` and `docs/serial-protocol.md`. Mirror `zx81/targets.ts`.

10. **`samples.ts`** — a `SampleFile[]` (`name`, `title`, `text`) of example
    programs **in this dialect's own BASIC**. The **first entry is the starter**
    shown for a fresh document and swapped in when the user selects this machine.
    Mirror `zxspectrum/samples.ts` (raw `.bas` files under `samples/`). Don't
    point a new dialect at the zx81 `src/samples/` programs — they won't run.

11. **`index.ts`** — assemble and export the `Dialect` object from all the pieces
    above. Mirror `zx81/index.ts` exactly (it shows how `tokenize`, `detokenize`,
    `lint`, `romUrl`, `createEmulator`, `keyboardLayout`, `samples`,
    `buildTargets`, `audio`, and `aiProfile` are stitched together).

## Wire it up

- **Register** the dialect in `src/dialects/registry.ts` — add it to the
  `dialects[]` array; it is then auto-discovered everywhere.
- **ROM** — drop the machine ROM in `public/roms/<id>.rom` with an attribution
  note, and point to it with
  ``romUrl: `${import.meta.env.BASE_URL}roms/<id>.rom` ``.
- **Theme (optional)** — add a `.virtual-keyboard.vk-theme-<id>` CSS block in
  `src/styles.css`; the class must match the `theme` field in your
  `KeyboardLayout`.

That is all a new dialect needs — the **target-machine dropdown** in
`src/components/Toolbar.tsx` is generic: it lists every entry in `dialects[]`
and calls `store.setDialect(id)`, which swaps the active `dialect` and persists
it (`storage/settings.ts` `getDialectId`/`setDialectId`). Switching rebuilds the
editor (`CodeMirrorHost` is keyed on `dialect`), tears down and rebuilds the
emulator (`EmulatorPane` disposes its machine in a `dialect`-keyed effect), and
re-renders the virtual keyboard from `dialect.keyboardLayout`. So once a dialect
is registered it is immediately selectable and runnable — **do not re-wire the
picker per dialect.** If you find the dropdown still shows only one machine,
check the registry, not the UI. Keep new UI text dialect-driven (e.g.
`dialect.name`), never a hard-coded machine name.

- **Samples are per-dialect.** The Toolbar's Samples menu lists
  `dialect.samples`, and switching machines swaps the editor to the new
  dialect's starter (`samples[0]`) **only when the document is untouched** —
  blank or exactly some dialect's starter (`store.isStarterOrEmpty`). Code the
  user wrote or loaded is never replaced. So just provide good `samples`; the
  swap is generic.

## Conventions (from CLAUDE.md)

- **Strict TypeScript** — `noUnusedLocals` / `noUnusedParameters` /
  `noFallthroughCasesInSwitch` are on; unused symbols fail the build.
- **Errors, not throws** — the tokenizer returns `TokenizeError[]`, it does not
  throw.
- **Naming** — components `PascalCase`, functions/vars `camelCase`, hardware
  constants `SCREAMING_SNAKE_CASE` (e.g. `TSTATES_PER_FRAME`).
- **Formatting** — Prettier (single quotes, semicolons, 2-space, trailing
  commas). Run `npm run format` before committing.

## Test & verify

Add colocated `*.test.ts` files (Vitest), mirroring the zx81 examples:

- **Tokenizer round-trip** — `zx81/tokenizer.test.ts`.
- **Image-builder pointer consistency** — `zx81/pfile.test.ts`.
- **Machine boot** — `zx81/emulator/zx81Machine.test.ts`: boot the real ROM,
  inject a program, assert on display memory. Emulator tests may read the real ROM
  from `public/roms/`.
- **Keyboard layout validation** — `zx81/keyboardLayout.test.ts` (every key's
  `labels` is index-aligned with `layers`; every referenced modifier and glyph
  exists).
- **Keyboard matrix** — `zx81/emulator/keyboard.test.ts`: `setKey`/`readMatrix`
  and the physical+virtual union.

Then run, from the repo root:

```bash
npm run typecheck
npm test
npm run lint
npm run dev      # optional: drive the new emulator + keyboard in the browser
```

## Key files to study

| File                                                  | What it shows                                            |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `src/dialects/types.ts`                               | Every interface you must implement                       |
| `src/dialects/zx81/index.ts`                          | How a `Dialect` is assembled                             |
| `src/dialects/registry.ts`                            | Where to register the new dialect                        |
| `src/dialects/zx81/emulator/`                         | `MachineEmulator` over the shared Z80 core               |
| `src/emulator/z80/`                                   | Vendored, machine-independent CPU core — **do not edit** |
| `src/keyboard/layoutSchema.ts`                        | All keyboard-layout type definitions                     |
| `src/dialects/zx81/keyboardLayout.ts`                 | Full layered keyboard example                            |
| `src/dialects/zx81/emulator/keyboard.ts`              | Matrix + dual press-source pattern                       |
| `src/keyboard/inputEngine.ts` / `VirtualKeyboard.tsx` | Generic kbd — no changes needed                          |

## Guardrails

- **Don't touch** `src/emulator/z80/` (vendored MIT Z80 core) or existing
  third-party ROMs under `public/roms/` — fix bus bugs in your dialect's emulator,
  not in the core.
- Nothing outside `src/dialects/<name>/` should change except the registry, the
  new ROM asset, and an optional `src/styles.css` theme block. If a wider change
  seems necessary, the dialect seam is probably being bypassed.
