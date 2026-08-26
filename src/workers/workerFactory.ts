import type { WorkerResponse, WorkerStatus } from './workerTypes';

/**
 * Structural subset of the native `Worker` API this client relies on.
 * Native `Worker` satisfies it; the E2E mock client implements it directly.
 */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    handler: (event: MessageEvent) => void,
  ): void;
  addEventListener(type: 'error', handler: (event: ErrorEvent) => void): void;
  removeEventListener(
    type: 'message',
    handler: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: 'error',
    handler: (event: ErrorEvent) => void,
  ): void;
  terminate(): void;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export interface WorkerClient {
  /** Send a request and await the matching RESULT/ERROR response. */
  request<TRes = unknown>(
    type: string,
    payload?: unknown,
    transfer?: Transferable[],
  ): Promise<TRes>;
  /** Subscribe to status transitions (replays current status immediately). */
  onStatus(callback: (status: WorkerStatus) => void): () => void;
  /** Terminate the worker and reject all in-flight requests. */
  dispose(): void;
}

let requestSeq = 0;

/**
 * Wraps any WorkerLike in a promise-based request/response client.
 *
 * Workers reply with `READY` (after INIT) and `RESULT`/`ERROR` messages that
 * carry the original requestId, so concurrent requests never cross wires.
 * Transferables are forwarded to `postMessage` for zero-copy ArrayBuffers.
 */
export function createWorkerClient(worker: WorkerLike): WorkerClient {
  let status: WorkerStatus = 'loading';
  const statusListeners = new Set<(status: WorkerStatus) => void>();
  const pending = new Map<string, PendingRequest>();

  const setStatus = (next: WorkerStatus): void => {
    status = next;
    statusListeners.forEach((cb) => cb(next));
  };

  const rejectAll = (reason: Error): void => {
    pending.forEach((p) => p.reject(reason));
    pending.clear();
  };

  worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const { type, requestId, payload, error } = event.data ?? {};
    if (type === 'READY') {
      setStatus('ready');
      // READY carries the INIT requestId so the init promise resolves.
      if (requestId !== undefined) {
        const p = pending.get(requestId);
        if (p) {
          pending.delete(requestId);
          p.resolve(undefined);
        }
      }
      return;
    }
    if (requestId === undefined) return;
    const p = pending.get(requestId);
    if (!p) return;
    pending.delete(requestId);
    if (type === 'RESULT') {
      p.resolve(payload);
    } else if (type === 'ERROR') {
      p.reject(new Error(error ?? 'Worker error'));
    }
  });

  worker.addEventListener('error', (event: ErrorEvent) => {
    setStatus('error');
    rejectAll(new Error(event.message || 'Worker crashed'));
  });

  return {
    request<TRes>(
      type: string,
      payload?: unknown,
      transfer?: Transferable[],
    ): Promise<TRes> {
      const requestId = `req_${++requestSeq}`;
      return new Promise<TRes>((resolve, reject) => {
        pending.set(requestId, {
          resolve: (value) => resolve(value as TRes),
          reject,
        });
        worker.postMessage({ type, requestId, payload }, transfer ?? []);
      });
    },

    onStatus(callback) {
      statusListeners.add(callback);
      callback(status);
      return () => statusListeners.delete(callback);
    },

    dispose() {
      worker.terminate();
      rejectAll(new Error('Worker disposed'));
      statusListeners.clear();
    },
  };
}
