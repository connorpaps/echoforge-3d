'use client';

export interface RecordingSession {
  /** Stop the recorder and resolve mono 16kHz PCM (Float32, -1..1). */
  stop(): Promise<Float32Array>;
  /** Abort without producing audio. */
  cancel(): void;
}

/** Linear-interpolation resampler for mono PCM (unit-tested). */
export function resamplePcm(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return input.slice();
  const ratio = fromRate / toRate;
  const outLength = Math.round(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

/**
 * Deterministic fake mic session used in E2E mode (NEXT_PUBLIC_E2E="true"):
 * 0.5s of a 440Hz tone at 16kHz — CI never needs a real microphone.
 */
export function createFakeRecordingSession(): RecordingSession {
  return {
    async stop(): Promise<Float32Array> {
      const sampleRate = 16000;
      const length = sampleRate / 2;
      const pcm = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        pcm[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.25;
      }
      return pcm;
    },
    cancel(): void {},
  };
}

function pickSupportedMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

async function decodeToPcm(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const mono = audioBuffer.getChannelData(0);
  return resamplePcm(mono, audioBuffer.sampleRate, 16000);
}

/**
 * Start recording the microphone via MediaRecorder. Resolves a session that
 * returns 16kHz mono PCM on stop(). Uses the deterministic fake session in
 * E2E mode so tests never require mic permission.
 */
export async function startRecording(): Promise<RecordingSession> {
  if (process.env.NEXT_PUBLIC_E2E === 'true') {
    return createFakeRecordingSession();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start(250);

  return {
    async stop(): Promise<Float32Array> {
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      await stopped;
      const blob = new Blob(chunks, { type: mimeType ?? 'audio/webm' });
      return decodeToPcm(await blob.arrayBuffer());
    },

    cancel(): void {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
