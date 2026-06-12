# Serial bridge protocol

The IDE can push a built program to real hardware over WebSerial via a
microcontroller bridge (Arduino, Pi Pico, ESP32…). The bridge firmware is out
of scope for this repo; this document specifies the wire protocol it must
implement, plus notes on delivering the program to the ZX81.

## Link

- 115200 baud, 8 data bits, no parity, 1 stop bit (8N1).
- The IDE is always the initiator.

## Frame layout

```
+-------------+------+----------------+
| magic       | cmd  | length         |
| "Z81!" (4B) | u8   | u32 little-end |
+-------------+------+----------------+
| payload, in 256-byte blocks:        |
|   block bytes (<=256)               |
|   CRC32 of block bytes, u32 LE      |
|   ... wait for ACK/NAK ...          |
+-------------------------------------+
| EOT (0x04)                          |
+-------------------------------------+
```

| Field  | Value                                       |
| ------ | ------------------------------------------- |
| magic  | `5A 38 31 21` ("Z81!")                      |
| cmd    | `0x01` = LOAD_P (payload is a raw .P image) |
| length | payload byte count                          |

The final block may be shorter than 256 bytes; its CRC32 still follows it.
CRC32 is the standard reflected polynomial `0xEDB88320` (same as zlib).

## Handshake

After each block (bytes + CRC) the bridge replies with a single byte:

- `0x06` ACK — block accepted, send the next one.
- `0x15` NAK — CRC mismatch, the IDE resends the same block (up to 3 times).

After the last block is ACKed the IDE sends `0x04` (EOT). The transfer is
complete; the bridge now owns delivery to the machine.

## Delivering a .P image to a ZX81

Two practical bridge designs:

1. **Cassette signal synthesis (no ZX81 modification).** The bridge re-encodes
   the .P bytes as the ZX81 tape signal on a GPIO pin wired to the EAR input
   (through a voltage divider to ~1V peak). The user types `LOAD ""` first.
   Encoding: each byte MSB-first; bit 0 = 4 pulses, bit 1 = 9 pulses; one
   pulse = 150µs high + 150µs low; ~1300µs silence after every bit. Prefix
   the data with the program name (ZX81 charset, last char +0x80).

2. **RAM injection (ZXpand-style, requires bus access).** Bridges with access
   to the expansion bus can DMA the image to 0x4009 and patch NXTLIN, but
   this is hardware-specific and not specified here.

A LOAD_P payload is exactly the file the IDE exports as `.P`, i.e. the memory
dump from 0x4009 up to E_LINE-1.
