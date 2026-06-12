import { useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { downloadBlob } from '../storage/files';
import { samplesToWav } from '../transfer/wav';
import { playSamples, type AudioPlayback } from '../transfer/audioPlayer';
import { sendOverSerial, webSerialSupported } from '../transfer/webserial';

export function TransferDialog() {
  const open = useIdeStore((s) => s.transferOpen);
  const setOpen = useIdeStore((s) => s.setTransferOpen);
  const source = useIdeStore((s) => s.source);
  const fileName = useIdeStore((s) => s.fileName);
  const dialect = useIdeStore((s) => s.dialect);

  const defaultName =
    fileName.replace(/\.[^.]*$/, '').toUpperCase() || 'PROGRAM';
  const [name, setName] = useState(defaultName);
  const [robust, setRobust] = useState(false);
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const playbackRef = useRef<AudioPlayback | null>(null);

  if (!open) return null;

  const guard = (fn: () => void | Promise<void>) => () => {
    setStatus('');
    Promise.resolve(fn()).catch((e: unknown) =>
      setStatus(e instanceof Error ? e.message : String(e)),
    );
  };

  const baseName = name.trim() || 'PROGRAM';

  const buildImage = (): Uint8Array => {
    const result = dialect.tokenize(source, { programName: baseName });
    if (result.errors.length > 0) {
      throw new Error(
        `Program has ${result.errors.length} error(s) — fix them first`,
      );
    }
    if (result.image.length === 0) throw new Error('Program is empty');
    return result.image;
  };

  const runFileTarget = (targetId: string) =>
    guard(async () => {
      const target = dialect.buildTargets.find((t) => t.id === targetId);
      if (!target) throw new Error(`No ${targetId} target for ${dialect.name}`);
      const blob = await target.build(source, { programName: baseName });
      downloadBlob(
        blob,
        `${baseName.toLowerCase()}.${target.fileExtension ?? 'bin'}`,
      );
      setStatus(`${target.label} done.`);
    });

  const playAudio = guard(async () => {
    const audio = dialect.audio;
    if (!audio)
      throw new Error(`${dialect.name} has no cassette audio support`);
    const samples = audio.buildSamples(source, baseName, robust);
    const playback = playSamples(samples, audio.sampleRate);
    playbackRef.current = playback;
    setPlaying(true);
    setStatus(
      `Playing ${playback.durationSeconds.toFixed(0)}s of cassette audio…`,
    );
    await playback.done;
    setPlaying(false);
    setStatus('Playback finished.');
  });

  const downloadWav = guard(() => {
    const audio = dialect.audio;
    if (!audio)
      throw new Error(`${dialect.name} has no cassette audio support`);
    const samples = audio.buildSamples(source, baseName, robust);
    downloadBlob(
      samplesToWav(samples, audio.sampleRate),
      `${baseName.toLowerCase()}.wav`,
    );
    setStatus('.wav downloaded — play it into the machine at high volume.');
  });

  const stopAudio = () => {
    playbackRef.current?.cancel();
    setPlaying(false);
  };

  const sendSerial = guard(async () => {
    const image = buildImage();
    setStatus('Choose the bridge serial port…');
    await sendOverSerial(image, (p) =>
      setStatus(`Sending block ${p.sentBlocks}/${p.totalBlocks}…`),
    );
    setStatus('Transfer complete.');
  });

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Run on real hardware</h2>
        <label>
          Program name (tape header)
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            maxLength={10}
          />
        </label>

        {dialect.audio && (
          <div className="transfer-group">
            <h3>Cassette audio</h3>
            <p>
              Connect this device&apos;s headphone output to the machine&apos;s
              EAR socket and set the volume to maximum.{' '}
              {dialect.audio.loadInstructions}
            </p>
            <label className="inline">
              <input
                type="checkbox"
                checked={robust}
                onChange={(e) => setRobust(e.target.checked)}
              />
              Robust mode (slower encoding, for temperamental hardware)
            </label>
            <div className="modal-actions left">
              {playing ? (
                <button onClick={stopAudio}>■ Stop audio</button>
              ) : (
                <button onClick={playAudio}>▶ Play through speakers</button>
              )}
              <button onClick={downloadWav}>Download .wav</button>
            </div>
          </div>
        )}

        <div className="transfer-group">
          <h3>Files &amp; serial</h3>
          <div className="modal-actions left">
            <button onClick={runFileTarget('p-file')}>Download .P file</button>
            <button
              onClick={sendSerial}
              disabled={!webSerialSupported()}
              title={
                webSerialSupported()
                  ? 'Send to a microcontroller bridge (see docs/serial-protocol.md)'
                  : 'WebSerial needs Chrome or Edge'
              }
            >
              Send via serial bridge
            </button>
          </div>
        </div>

        {status && <p className="transfer-status">{status}</p>}
        <div className="modal-actions">
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
