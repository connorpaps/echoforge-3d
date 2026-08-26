import { env, pipeline } from '@huggingface/transformers';
import type {
  TranscriptionResult,
  WorkerRequest,
  WorkerResponse,
} from './workerTypes';

env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Structural pipeline type (the full ASR pipeline class type is too heavily
 * overloaded for TS's union representation at the call site).
 */
type SpeechRecognizer = (
  audio: Float32Array,
  options?: { language?: string; task?: string },
) => Promise<{ text: string }>;

let asrPipeline: SpeechRecognizer | null = null;

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

async function runInit(): Promise<void> {
  // NOTE: spec originally pinned `onnx-community/distil-whisper-small`, but
  // that repo is gated on HF (HTTP 401 without a logged-in account + accepted
  // license). `onnx-community/whisper-small.en` is public and is the full
  // (non-distilled) Whisper-small, so accuracy is on par or better.
  const instance = await pipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-small.en',
    // 'auto' = WebGPU when available, WASM otherwise — matches the app's
    // WebGL-default / WebGPU-opt-in design (see depth.worker.ts).
    { device: 'auto', dtype: 'fp32' },
  );
  asrPipeline = instance as unknown as SpeechRecognizer;
}

async function runTranscribe(payload: {
  audio?: Float32Array;
  sampleRate?: number;
}): Promise<TranscriptionResult> {
  if (!asrPipeline) throw new Error('Speech pipeline not initialized');
  if (!payload.audio) throw new Error('Missing audio payload');

  const output = await asrPipeline(payload.audio, {
    language: 'english',
    task: 'transcribe',
  });

  return { text: output.text };
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
    if (type === 'TRANSCRIBE') {
      const result = await runTranscribe(
        payload as { audio?: Float32Array; sampleRate?: number },
      );
      ctx.postMessage(
        { type: 'RESULT', requestId, payload: result } satisfies WorkerResponse,
        [],
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
