export interface AudioPlayback {
  /** Resolves when playback completes (or is cancelled). */
  done: Promise<void>;
  cancel(): void;
  readonly durationSeconds: number;
}

/**
 * Play cassette samples through the speakers. Must be called from a user
 * gesture (browser autoplay policy).
 */
export function playSamples(
  samples: Float32Array,
  sampleRate: number,
): AudioPlayback {
  const ctx = new AudioContext({ sampleRate });
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  let finished: () => void;
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  source.onended = () => {
    void ctx.close();
    finished();
  };
  source.start();

  return {
    done,
    durationSeconds: buffer.duration,
    cancel: () => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    },
  };
}
