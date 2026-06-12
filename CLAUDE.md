# CLAUDE.md

Guidance for working in this repository. Read the **Commands** and
**Architecture** sections first — they cover most tasks.

## What this is

`micro-basic-ide` is a browser-based IDE for microcomputer BASIC dialects. The
first (and currently only) dialect is the **Sinclair ZX81**, with an in-browser
Z80 emulator, hardware export (cassette audio / `.P` files / WebSerial), and an
optional Claude-powered code assistant.

**Stack:** TypeScript (strict), React 18, Vite 6, Vitest 3, CodeMirror 6,
Zustand 5, and the Anthropic SDK.

**Key mental model:** the app talks only to the `Dialect` interface
(`src/dialects/types.ts`) and the `MachineEmulator` it returns — never to ZX81
specifics directly. All machine-specific code lives under one folder
(`src/dialects/zx81/`). This is the seam that makes new dialects pluggable.

## Commands

```bash
npm install            # install dependencies
npm run dev            # Vite dev server at http://localhost:5173

npm test               # run all unit tests once (vitest run)
npm run test:watch     # vitest in watch mode
npx vitest run src/dialects/zx81/tokenizer.test.ts   # run a single test file

npm run typecheck      # fast type check (tsc -b, no bundle)
npm run lint           # ESLint
npm run lint:fix       # ESLint with autofix
npm run format         # Prettier write
npm run format:check   # Prettier check (used in CI)

npm run build          # tsc -b && vite build → dist/
```

**Before finishing a change**, run `npm run typecheck`, `npm test`, and
`npm run lint`. For tokenizer / emulator / charset changes, add or update the
colocated `*.test.ts` rather than only checking by hand.

## Architecture

| Path                          | Role                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/dialects/types.ts`       | The `Dialect` / `MachineEmulator` contracts — the app's only seam                                           |
| `src/dialects/registry.ts`    | Registers available dialects (`getDialect(id)`)                                                             |
| `src/dialects/zx81/`          | Entire ZX81 implementation (tokenizer, charset, keywords, `pfile`, emulator, audio, `aiProfile`, `targets`) |
| `src/dialects/zx81/emulator/` | ZX81 hardware: memory map, display, keyboard, wiring the Z80 core                                           |
| `src/emulator/z80/`           | Vendored Z80 CPU core (machine-independent)                                                                 |
| `src/editor/`                 | Generic CodeMirror builders: BASIC language, completions, lint, line numbering                              |
| `src/app/`                    | Zustand store (`store.ts`) and app-level hooks/utilities                                                    |
| `src/components/`             | React UI: `Workspace`, `EmulatorPane`, `AiPanel`, `Toolbar`, status bar                                     |
| `src/ai/`                     | Anthropic SDK client, prompt builder, AI code extractor/merge                                               |
| `src/transfer/`               | Hardware export: WAV cassette, `.P`, WebSerial protocol                                                     |
| `src/storage/`                | localStorage settings + autosave                                                                            |
| `src/samples/`                | Bundled sample `.bas` programs                                                                              |

**Run-a-program data flow:**

```
editor (CodeMirror)
  → store.setSource()
  → dialect.tokenize(source)          # text → program bytes (+ TokenizeError[])
  → buildPFile(...)                   # bytes → full memory image
  → zx81Machine.loadProgram(image)
  → runFrame() + renderTo(canvas)     # per 50Hz frame
```

The AI path is parallel: prompt + lint errors → `streamChat()` →
`extractCodeBlocks()` → `mergeBasicLines()` → push back into the editor.

## Adding a dialect

Implement the `Dialect` interface in a new `src/dialects/<name>/` folder
(mirroring `zx81/`) and register it in `src/dialects/registry.ts`. Nothing
outside the dialect folder should need to change. Full step-by-step guide:
**`docs/adding-a-dialect.md`**. See also `docs/file-formats.md` (`.bas` / `.P` /
cassette audio) and `docs/serial-protocol.md` (the WebSerial bridge).

## Conventions

- **Strict TypeScript** — `noUnusedLocals`, `noUnusedParameters`, and
  `noFallthroughCasesInSwitch` are on; unused symbols fail the build.
- **Naming** — components `PascalCase`, functions/vars `camelCase`, hardware
  constants `SCREAMING_SNAKE_CASE` (e.g. `TSTATES_PER_FRAME`).
- **Errors, not throws** — the tokenizer collects `TokenizeError[]` (1-based
  line, 0-based column) for inline editor display instead of throwing.
- **State** — single Zustand store; components subscribe via narrow selectors
  (`useIdeStore((s) => s.source)`). Async work is requested by bumping a counter
  (e.g. `runRequest`) that a `useEffect` watches, not by calling across modules.
- **Tests** — `*.test.ts` colocated with source; emulator tests may read the
  real ROM from `public/roms/zx81.rom`.
- **Formatting** — Prettier (single quotes, semicolons, 2-space, trailing
  commas). Run `npm run format` before committing.

## ZX81 BASIC gotchas

- One numbered statement per line; line numbers are 1–9999 and must be strictly
  ascending. No multi-statement lines, no `ELSE`.
- Variable names are single letters (`A`–`Z`, optional `$` for strings).
- Keywords tokenize to single bytes; the charset maps unicode block graphics and
  escapes to ZX81 codes.
- Display has two modes: **FAST** (CPU full speed, screen blanked) and **SLOW**
  (continuous display, ~1/4 speed).

## Don't touch

- `src/emulator/z80/` — vendored Z80 core (MIT, Molly Howell). Don't rewrite it;
  fix bugs upstream-style or in the ZX81 bus instead.
- `public/roms/zx81.rom` — third-party ROM (© Amstrad, emulator-use permission).
  Don't modify or relicense.
