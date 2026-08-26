import { KokoroTTS } from 'kokoro-js';
import type { TtsResult, WorkerRequest, WorkerResponse } from './workerTypes';

let ttsInstance: KokoroTTS | null = null;

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

async function runInit(): Promise<void> {
  ttsInstance = await KokoroTTS.from_pretrained(
    'onnx-community/Kokoro-82M-v1.0-ONNX',
    { dtype: 'q8', device: 'webgpu' },
  );
}

async function runSpeak(payload: { text?: string; voice?: string }): Promise<TtsResult> {
  if (!ttsInstance) throw new Error('TTS instance not initialized');
  if (!payload.text) throw new Error('Missing text payload');

  const raw = await ttsInstance.generate(payload.text, {
    // Voice ids are a fixed catalog in kokoro-js; validated at runtime.
    voice: (payload.voice ??
      'af_heart') as NonNullable<Parameters<KokoroTTS['generate']>[1]>['voice'],
  });

  return { audio: raw.audio, sampleRate: raw.sampling_rate };
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, requestId, payload } = event.data;
  try {
    if (type === 'INIT') {
      await runInit();
      ctx.postMessage(
        { type: 'READY', requestId } satisfies WorkerResponse,
        [],
      );
      return;
    }
    if (type === 'SPEAK') {
      const result = await runSpeak(payload as { text?: string; voice?: string });
      ctx.postMessage(
        { type: 'RESULT', requestId, payload: result } satisfies WorkerResponse,
        [result.audio.buffer],
      );
      return;
    }
    ctx.postMessage({
      type: 'ERROR',
      requestId,
      error: `Unknown request type "${type}"`,
    } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({
      type: 'ERROR',
      requestId,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
