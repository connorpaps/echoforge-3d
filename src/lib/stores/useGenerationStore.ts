import { create } from 'zustand';
import {
  generateMesh as apiGenerateMesh,
  generateTexture as apiGenerateTexture,
  subscribeProgress,
  type MeshResult,
  type ProgressEvent,
  type ProgressStage,
  type TextureResult,
} from '@/lib/api/generate';

export type GenerationKind = 'mesh' | 'texture';
export type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

export type GenerationResult = MeshResult | TextureResult;

interface PendingRequest {
  kind: GenerationKind;
  prompt: string;
  imageBase64: string;
}

interface GenerationState {
  status: GenerationStatus;
  kind: GenerationKind | null;
  stage: ProgressStage | null;
  percent: number;
  message: string;
  result: GenerationResult | null;
  errorMessage: string | null;

  generateMesh: (prompt: string, imageBase64: string) => Promise<void>;
  generateTexture: (prompt: string) => Promise<void>;
  retry: () => Promise<void>;
  dismiss: () => void;
  /** Internal — applied from progress events; exported for tests. */
  _applyProgress: (event: ProgressEvent) => void;
}

let unsubscribe: (() => void) | null = null;
let pending: PendingRequest | null = null;

/**
 * Generative task state machine (docs/02_DESIGN_BRIEF.md §4):
 * idle → generating (with live stage/percent ticks) → success | error,
 * plus retry for recoverable GPU failures.
 */
export const useGenerationStore = create<GenerationState>()((set, get) => {
  const begin = (request: PendingRequest) => {
    pending = request;
    set({
      status: 'generating',
      kind: request.kind,
      stage: null,
      percent: 0,
      message: 'queued',
      result: null,
      errorMessage: null,
    });
    unsubscribe?.();
    unsubscribe = subscribeProgress((event) => get()._applyProgress(event));
  };

  const finish = (result: GenerationResult) => {
    unsubscribe?.();
    unsubscribe = null;
    set({ status: 'success', stage: 'DONE', percent: 100, result });
  };

  const fail = (error: unknown) => {
    unsubscribe?.();
    unsubscribe = null;
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    set({ status: 'error', stage: 'ERROR', errorMessage });
  };

  return {
    status: 'idle',
    kind: null,
    stage: null,
    percent: 0,
    message: '',
    result: null,
    errorMessage: null,

    _applyProgress: (event) =>
      set({
        stage: event.stage,
        percent: event.percent,
        message: event.message,
      }),

    generateMesh: async (prompt, imageBase64) => {
      begin({ kind: 'mesh', prompt, imageBase64 });
      try {
        finish(await apiGenerateMesh({ prompt, imageBase64 }));
      } catch (error) {
        fail(error);
      }
    },

    generateTexture: async (prompt) => {
      begin({ kind: 'texture', prompt, imageBase64: '' });
      try {
        finish(await apiGenerateTexture({ prompt, seed: 42 }));
      } catch (error) {
        fail(error);
      }
    },

    retry: async () => {
      if (!pending) return;
      const request = pending;
      await (request.kind === 'mesh'
        ? get().generateMesh(request.prompt, request.imageBase64)
        : get().generateTexture(request.prompt));
    },

    dismiss: () => {
      set({
        status: 'idle',
        kind: null,
        stage: null,
        percent: 0,
        message: '',
        result: null,
        errorMessage: null,
      });
    },
  };
});
