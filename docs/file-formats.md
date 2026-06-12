# File formats

## Editor source format (.bas)

Plain UTF-8 text, one BASIC line per text line: a line number (1–9999)
followed by exactly one statement. Keywords are written as words (`PRINT`,
`GOTO`, `INKEY$`, `**` for power). Lowercase input is folded to uppercase.

Special character conventions (zxtext2p-compatible where practical):

| Source               | Meaning                                                          |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| `▘▝▀▖▌▞▛`            | quarter/half block graphics (codes 0x01–0x07)                    |
| `█▟▙▄▜▐▚▗`           | inverse block graphics (0x80–0x87)                               |
| `▒`                  | grey block (0x08)                                                |
| `\!!` `\!'` `\!.`    | grey full / top / bottom (0x08–0x0A)                             |
| `\|                  | ` `\|'` `\|.`                                                    | inverse grey full / top / bottom (0x88–0x8A) |
| `\' ` `\ '` `\''` …  | quadrant escapes: left+right column, `'`=top `.`=bottom `:`=full |
| `%A` … `%9`          | inverse video character                                          |
| `""` inside a string | the quote-image character (0xC0)                                 |
| `£`                  | pound sign (0x0C)                                                |

`#` and other characters outside the ZX81 set are tokenizer errors.

## Tokenized program area

Per line: `u16 BE line number`, `u16 LE length` (body + terminator),
tokenized body, `0x76` (NEWLINE). Numeric literals appear as their printable
characters followed by `0x7E` and the 5-byte ZX81 float (exponent+0x80,
then a 4-byte mantissa whose top bit is replaced by the sign).

## .P files

A `.P` file is the ZX81 memory dump from 0x4009 (VERSN) up to but not
including the address in E_LINE — identical to what the ROM's SAVE writes:

```
0x4009  system variables (0x74 bytes)
0x407D  tokenized program
        display file (this IDE writes a collapsed one: 25 x 0x76)
        variables area (terminated by 0x80)
```

The IDE sets `NXTLIN` to the first program line so loaded programs auto-run
(toggleable in `buildPFile`), and `CDFLAG` bit 6 for SLOW mode.

## Cassette audio

See `docs/serial-protocol.md` § Delivering a .P image — the WAV/audio export
uses the same encoding at 44.1kHz, with a 2s leader (4s in robust mode).
