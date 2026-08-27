import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/generate', () => ({
  generateMesh: vi.fn(),
  generateTexture: vi.fn(),
  generateAudio: vi.fn(),
  subscribeProgress: vi.fn(() => () => {}),
}));

import {
  generateAudio,
  generateMesh,
  generateTexture,
} from '@/lib/api/generate';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';

const mockGenerateMesh = vi.mocked(generateMesh);
const mockGenerateTexture = vi.mocked(generateTexture);
const mockGenerateAudio = vi.mocked(generateAudio);

function resetStore() {
  useGenerationStore.getState().dismiss();
}

describe('useGenerationStore', () => {
  beforeEach(() => {
    resetStore();
    mockGenerateMesh.mockReset();
    mockGenerateTexture.mockReset();
    mockGenerateAudio.mockReset();
  });

  it('transitions idle → generating → success on mesh generation', async () => {
    mockGenerateMesh.mockResolvedValue({
      jobId: 'j1',
      glbUrl: 'data:x',
      bounds: { min: [0, 0, 0], max: [1, 1, 1], center: [0, 0, 0], size: [1, 1, 1] },
      faceCount: 100,
      vertexCount: 50,
      glbSizeBytes: 10,
      elapsedMs: 20,
    });

    const promise = useGenerationStore.getState().generateMesh('vase', 'img');
    expect(useGenerationStore.getState().status).toBe('generating');
    expect(useGenerationStore.getState().kind).toBe('mesh');

    // Simulate a live progress tick from the socket.
    useGenerationStore
      .getState()
      ._applyProgress({ jobId: 'j1', stage: 'RECONSTRUCTION', percent: 60, message: 'mid' });
    expect(useGenerationStore.getState().percent).toBe(60);

    await promise;
    const state = useGenerationStore.getState();
    expect(state.status).toBe('success');
    expect(state.stage).toBe('DONE');
    expect(state.result?.jobId).toBe('j1');
  });

  it('transitions to error and retry re-runs the request', async () => {
    mockGenerateTexture.mockRejectedValueOnce(new Error('GPU queue saturated'));
    mockGenerateTexture.mockResolvedValueOnce({
      jobId: 'j2',
      imageBase64: 'AAA=',
      seed: 42,
      elapsedMs: 10,
    });

    await useGenerationStore.getState().generateTexture('castle');
    expect(useGenerationStore.getState().status).toBe('error');
    expect(useGenerationStore.getState().errorMessage).toContain('saturated');

    await useGenerationStore.getState().retry();
    expect(useGenerationStore.getState().status).toBe('success');
    expect(mockGenerateTexture).toHaveBeenCalledTimes(2);
  });

  it('transitions idle → generating → success on audio generation', async () => {
    mockGenerateAudio.mockResolvedValue({
      jobId: 'j5',
      wavBase64: 'UklGRg==',
      synthetic: true,
      elapsedMs: 30,
    });

    const promise = useGenerationStore.getState().generateAudio('rain', 8);
    expect(useGenerationStore.getState().status).toBe('generating');
    expect(useGenerationStore.getState().kind).toBe('audio');
    expect(mockGenerateAudio).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'rain', durationSec: 8, seed: 42 }),
    );

    await promise;
    const state = useGenerationStore.getState();
    expect(state.status).toBe('success');
    expect(state.result).toMatchObject({ wavBase64: 'UklGRg==' });
  });

  it('dismiss returns to idle and clears the result', async () => {
    mockGenerateMesh.mockResolvedValue({
      jobId: 'j3',
      glbUrl: 'data:x',
      bounds: { min: [0, 0, 0], max: [1, 1, 1], center: [0, 0, 0], size: [1, 1, 1] },
      faceCount: 1,
      vertexCount: 3,
      glbSizeBytes: 1,
      elapsedMs: 1,
    });
    await useGenerationStore.getState().generateMesh('vase', 'img');
    expect(useGenerationStore.getState().status).toBe('success');

    useGenerationStore.getState().dismiss();
    expect(useGenerationStore.getState().status).toBe('idle');
    expect(useGenerationStore.getState().result).toBeNull();
  });

  it('unsubscribes the progress socket after completion', async () => {
    const unsubscribe = vi.fn();
    const { subscribeProgress } = await import('@/lib/api/generate');
    vi.mocked(subscribeProgress).mockReturnValue(unsubscribe);

    mockGenerateMesh.mockResolvedValue({
      jobId: 'j4',
      glbUrl: 'data:x',
      bounds: { min: [0, 0, 0], max: [1, 1, 1], center: [0, 0, 0], size: [1, 1, 1] },
      faceCount: 1,
      vertexCount: 3,
      glbSizeBytes: 1,
      elapsedMs: 1,
    });
    await useGenerationStore.getState().generateMesh('vase', 'img');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
