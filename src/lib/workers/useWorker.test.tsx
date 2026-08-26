import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorker } from '@/lib/workers/useWorker';
import type { WorkerClient } from '@/workers/workerFactory';
import type { WorkerStatus } from '@/workers/workerTypes';

const mocks = vi.hoisted(() => ({
  createWorkerClient: vi.fn<(worker: unknown) => WorkerClient>(),
  createWorker: vi.fn(),
}));

vi.mock('@/workers/workerFactory', () => ({
  createWorkerClient: mocks.createWorkerClient,
}));

// The real registry constructs a native Worker, which jsdom lacks.
vi.mock('@/workers/workerRegistry', () => ({
  createWorker: mocks.createWorker,
}));

function makeFakeClient(): WorkerClient & {
  emitStatus: (s: WorkerStatus) => void;
} {
  const statusListeners = new Set<(s: WorkerStatus) => void>();
  const request = vi.fn(async () => ({ text: 'fixture' }));

  const client = {
    emitStatus: (s: WorkerStatus) => statusListeners.forEach((cb) => cb(s)),
    request,
    onStatus: (cb: (s: WorkerStatus) => void) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    dispose: vi.fn(),
  } as unknown as WorkerClient & { emitStatus: (s: WorkerStatus) => void };

  return client;
}

describe('useWorker', () => {
  beforeEach(() => {
    mocks.createWorkerClient.mockReset();
  });

  it('starts idle, initializes the worker, and reaches ready', async () => {
    const fake = makeFakeClient();
    mocks.createWorkerClient.mockReturnValue(fake);

    const { result } = renderHook(() => useWorker('depth'));

    expect(result.current.status).toBe('idle');

    await act(async () => {
      fake.emitStatus('ready');
    });

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mocks.createWorkerClient).toHaveBeenCalled();
    expect(fake.request).toHaveBeenCalledWith('INIT');
  });

  it('routes task requests through the client', async () => {
    const fake = makeFakeClient();
    mocks.createWorkerClient.mockReturnValue(fake);

    const { result } = renderHook(() => useWorker('speech'));

    await act(async () => {
      fake.emitStatus('ready');
    });

    const out = await act(async () =>
      result.current.request<{ text: string }>('TRANSCRIBE', {
        audio: new Float32Array(8),
      }),
    );
    expect(out.text).toBe('fixture');
    expect(fake.request).toHaveBeenCalledWith(
      'TRANSCRIBE',
      { audio: expect.any(Float32Array) },
      undefined,
    );
  });

  it('marks status error when INIT fails', async () => {
    const fake = makeFakeClient();
    mocks.createWorkerClient.mockReturnValue(fake);
    const requestMock = fake.request as unknown as ReturnType<typeof vi.fn>;
    requestMock.mockRejectedValueOnce(new Error('init failed'));

    const { result } = renderHook(() => useWorker('tts'));

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
