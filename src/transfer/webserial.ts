import {
  ACK,
  NAK,
  EOT,
  buildHeader,
  splitBlocks,
  CMD_LOAD_P,
} from './protocol';

export function webSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export interface SerialProgress {
  sentBlocks: number;
  totalBlocks: number;
}

const MAX_RETRIES = 3;
const ACK_TIMEOUT_MS = 3000;

/**
 * Send a .P payload to a microcontroller bridge over WebSerial using the
 * protocol in docs/serial-protocol.md. The user picks the port; the bridge
 * firmware is responsible for delivering the bytes to the ZX81.
 */
export async function sendOverSerial(
  payload: Uint8Array,
  onProgress?: (p: SerialProgress) => void,
): Promise<void> {
  if (!webSerialSupported()) {
    throw new Error(
      'WebSerial is not supported in this browser (try Chrome or Edge)',
    );
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });

  const writer = port.writable!.getWriter();
  const reader = port.readable!.getReader();

  const readByte = async (): Promise<number> => {
    const deadline = Date.now() + ACK_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: false }>((resolve) =>
          setTimeout(
            () => resolve({ value: undefined, done: false }),
            deadline - Date.now(),
          ),
        ),
      ]);
      if (result.done) throw new Error('Serial port closed by device');
      if (result.value && result.value.length > 0) return result.value[0]!;
    }
    throw new Error('Timed out waiting for bridge ACK');
  };

  try {
    await writer.write(buildHeader(CMD_LOAD_P, payload.length));
    const blocks = splitBlocks(payload);
    for (let i = 0; i < blocks.length; i++) {
      let attempt = 0;
      for (;;) {
        await writer.write(blocks[i]!.wire);
        const reply = await readByte();
        if (reply === ACK) break;
        if (reply === NAK && attempt < MAX_RETRIES) {
          attempt++;
          continue;
        }
        throw new Error(
          reply === NAK
            ? `Block ${i} rejected after ${MAX_RETRIES} retries`
            : `Unexpected reply 0x${reply.toString(16)} from bridge`,
        );
      }
      onProgress?.({ sentBlocks: i + 1, totalBlocks: blocks.length });
    }
    await writer.write(Uint8Array.from([EOT]));
  } finally {
    writer.releaseLock();
    reader.releaseLock();
    await port.close();
  }
}
