/** Typed message protocol shared by all EchoForge web workers. */

export type WorkerStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Message sent from the main thread to a worker. */
export interface WorkerRequest<T = unknown> {
  type: string;
  requestId?: string;
  payload?: T;
}

/** Message sent from a worker back to the main thread. */
export interface WorkerResponse<T = unknown> {
  type: 'READY' | 'RESULT' | 'ERROR' | 'PROGRESS';
  requestId?: string;
  payload?: T;
  error?: string;
}

/** Depth estimation result (zero-copy Float32Array transferred to main thread). */
export interface DepthResult {
  depth: Float32Array;
  width: number;
  height: number;
}

/** Speech transcription result. */
export interface TranscriptionResult {
  text: string;
}

/** TTS synthesis result (zero-copy Float32Array transferred to main thread). */
export interface TtsResult {
  audio: Float32Array;
  sampleRate: number;
}
