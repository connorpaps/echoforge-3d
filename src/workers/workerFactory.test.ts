import { describe, expect, it, vi } from 'vitest';
import {
  createWorkerClient,
  type WorkerLike,
} from '@/workers/workerFactory';

class FakeWorker implements WorkerLike {
  private messageHandlers = new Set<(event: MessageEvent) => void>();
  private errorHandlers = new Set<(event: ErrorEvent) => void>();

  postMessage(message: unknown, _transfer?: Transferable[]): void {
    const { type, requestId } = message as { type: string; requestId?: string };
    setTimeout(() => {
      if (type === 'INIT') {
        this.emit({ type: 'READY', requestId });
      } else if (type === 'ECHO') {
        this.emit({ type: 'RESULT', requestId, payload: 'pong' });
      } else if (type === 'FAIL') {
        this.emit({ type: 'ERROR', requestId, error: 'boom' });
      } else if (type === 'SILENT') {
        // never responds — used to prove dispose() rejects pending
      }
    }, 0);
  }

  addEventListener(
    type: 'message',
    handler: (event: MessageEvent) => void,
  ): void;
  addEventListener(type: 'error', handler: (event: ErrorEvent) => void): void;
  addEventListener(
    type: 'message' | 'error',
    handler: ((event: MessageEvent) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.messageHandlers.add(handler as (event: MessageEvent) => void);
    } else {
      this.errorHandlers.add(handler as (event: ErrorEvent) => void);
    }
  }

  removeEventListener(
    type: 'message',
    handler: (event: MessageEvent) => void,
  ): void;
  removeEventListener(type: 'error', handler: (event: ErrorEvent) => void): void;
  removeEventListener(
    type: 'message' | 'error',
    handler: ((event: MessageEvent) => void) | ((event: ErrorEvent) => void),
  ): void {
    if (type === 'message') {
      this.messageHandlers.delete(handler as (event: MessageEvent) => void);
    } else {
      this.errorHandlers.delete(handler as (event: ErrorEvent) => void);
    }
  }

  terminate(): void {
    this.messageHandlers.clear();
    this.errorHandlers.clear();
  }

  private emit(message: unknown): void {
    this.messageHandlers.forEach((handler) =>
      handler({ data: message } as MessageEvent),
    );
  }
}

describe('createWorkerClient', () => {
  it('reports READY after INIT and replays status to new subscribers', async () => {
    const client = createWorkerClient(new FakeWorker());
    const statuses: string[] = [];
    const unsubscribe = client.onStatus((s) => statuses.push(s));

    await client.request('INIT');
    expect(statuses).toContain('loading');
    expect(statuses).toContain('ready');

    // Late subscribers get the current status replayed immediately.
    const late: string[] = [];
    client.onStatus((s) => late.push(s));
    expect(late).toEqual(['ready']);

    unsubscribe();
    client.dispose();
  });

  it('resolves requests and rejects error responses', async () => {
    const client = createWorkerClient(new FakeWorker());
    await client.request('INIT');
    await expect(client.request('ECHO')).resolves.toBe('pong');
    await expect(client.request('FAIL')).rejects.toThrow('boom');
    client.dispose();
  });

  it('forwards transferables to postMessage', async () => {
    const worker = new FakeWorker();
    const postMessageSpy = vi.spyOn(worker, 'postMessage');
    const client = createWorkerClient(worker);
    await client.request('INIT');

    const buffer = new ArrayBuffer(8);
    await client.request('ECHO', { data: buffer }, [buffer]);

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ECHO', requestId: expect.any(String) }),
      [buffer],
    );
    client.dispose();
  });

  it('rejects in-flight requests when disposed', async () => {
    const client = createWorkerClient(new FakeWorker());
    const pending = client.request('SILENT');
    client.dispose();
    await expect(pending).rejects.toThrow('Worker disposed');
  });

  it('marks status error and rejects pending when the worker crashes', async () => {
    const worker = new FakeWorker();
    const client = createWorkerClient(worker);
    const statuses: string[] = [];
    client.onStatus((s) => statuses.push(s));

    const pending = client.request('SILENT');
    // Simulate an uncaught worker error event via the registered listeners.
    const listeners = (worker as unknown as {
      errorHandlers: Set<(event: ErrorEvent) => void>;
    }).errorHandlers;
    listeners.forEach((h) => h({ message: 'crashed' } as ErrorEvent));

    expect(statuses).toContain('error');
    await expect(pending).rejects.toThrow('crashed');
    client.dispose();
  });
});
