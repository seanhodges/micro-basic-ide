# Micro BASIC IDE

A web IDE for microcomputer BASIC dialects — write, run and ship games for
real retro hardware from your browser. The first supported machine is the
**Sinclair ZX81**; the architecture is built around a dialect abstraction so
other machines (Spectrum, C64…) can plug in later.

![ZX81 BASIC in the editor, running in the built-in emulator]

## Features

- **Editor** — CodeMirror 6 with ZX81 BASIC syntax highlighting, keyword
  autocomplete (with per-keyword documentation), live tokenizer linting, and
  a byte counter against the 16K RAM budget.
- **Built-in emulator** — a TypeScript ZX81: vendored Z80 core, the real ROM,
  SLOW/FAST display hardware emulation, keyboard mapping. One click
  tokenizes your source to a `.P` image and flash-loads it through the ROM's
  own tape-LOAD path.
- **AI code generation** — a chat panel backed by the Claude API (bring your
  own key, stored only in your browser). Claude knows the ZX81's rules — one
  statement per line, mandatory LET, INKEY$ game loops, PRINT AT — and
  generated programs land in your editor with one click (replace, merge by
  line number, or replace+run).
- **Real hardware transfer**
  - **Cassette audio**: play the ZX81 tape signal straight out of your
    speakers into the EAR port, or download it as a `.wav`.
  - **`.P` file** download for ZXpand and friends, and import of existing
    `.P` files back into editable text.
  - **WebSerial** push to a microcontroller bridge
    ([protocol spec](docs/serial-protocol.md)).
- **Save/load `.bas`** with the File System Access API (download fallback),
  autosave to localStorage, and bundled sample games.

## Getting started

```sh
npm install
npm run dev    # IDE on http://localhost:5173
npm test       # 44 unit tests incl. booting the emulator ROM
npm run build  # static site in dist/ (deployable to GitHub Pages)
```

Open the IDE, pick **File ▸ Samples ▸ Breakout**, press **▶ Run** (or
Ctrl+Enter), click the screen and play with the 5 and 8 keys.

For AI generation, click **✦ AI**, add your Anthropic API key (created at
[platform.claude.com](https://platform.claude.com/)), and ask for a game.

## Writing ZX81 BASIC

One numbered line per statement, keywords as words. Specials: block graphics
as unicode (`█▀▌▒`…) or escapes (`\::`), inverse video as `%A`, `**` for
power. See [docs/file-formats.md](docs/file-formats.md).

## Running on real hardware

1. **Cassette**: connect your headphone jack to the ZX81 EAR socket, volume
   to max. On the ZX81 type `LOAD ""` and press NEW LINE; in the IDE choose
   **⇥ Hardware ▸ Play through speakers**. Use _robust mode_ if loads fail.
2. **ZXpand / SD interfaces**: download the `.P` file and copy it across.
3. **Serial bridge**: any microcontroller implementing the
   [bridge protocol](docs/serial-protocol.md) can receive programs via
   WebSerial (Chrome/Edge).

## Project layout

```
src/dialects/types.ts      the Dialect interface — the contract for a machine
src/dialects/zx81/         everything ZX81: charset, tokenizer, .P builder,
                           emulator, cassette encoder, AI profile
src/emulator/z80/          vendored MIT Z80 core (Molly Howell) + patches
src/editor/                generic CM6 language/completion/lint builders
src/ai/                    Claude API client, prompt builder, code extractor
src/transfer/              WAV writer, audio player, WebSerial, protocol
docs/adding-a-dialect.md   how to add the next machine
```

## ROM licensing

`public/roms/zx81.rom` is © Amstrad, distributed under Amstrad's
long-standing permission for emulator use — see
[public/roms/ATTRIBUTION.md](public/roms/ATTRIBUTION.md).
