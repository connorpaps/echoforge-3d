import type { WorkerLike } from './workerFactory';
import type { WorkerRequest } from './workerTypes';

export type WorkerId = 'depth' | 'speech' | 'tts';

/**
 * E2E hermetic mode — enabled by the Playwright webServer env
 * (`NEXT_PUBLIC_E2E="true"`). Replaces real model-backed workers with
 * deterministic fixture clients so CI never downloads models or touches the
 * network. On-device dev servers default to real workers.
 */
export function isE2EMode(): boolean {
  return process.env.NEXT_PUBLIC_E2E === 'true';
}

/**
 * Real model-backed workers. Bundlers (webpack/vite) only treat
 * `new Worker(new URL(...))` as a compilable worker when the URL expression
 * appears directly as the constructor argument. Routing through a map or
 * variable makes webpack emit the `.ts` file as a raw asset, which the dev
 * server then serves with MIME `video/mp2t` — the module worker then crashes
 * with "Failed to load module script". Keep these factories direct.
 */
function createDepthWorker(): WorkerLike {
  return new Worker(new URL('./depth.worker.ts', import.meta.url));
}

function createSpeechWorker(): WorkerLike {
  return new Worker(new URL('./speech.worker.ts', import.meta.url));
}

function createTtsWorker(): WorkerLike {
  return new Worker(new URL('./tts.worker.ts', import.meta.url));
}

/** Create the real model-backed worker for the given worker id. */
export function createRealWorker(id: WorkerId): WorkerLike {
  switch (id) {
    case 'depth':
      return createDepthWorker();
    case 'speech':
      return createSpeechWorker();
    case 'tts':
      return createTtsWorker();
  }
}

/** Create the deterministic fixture client used in E2E mode. */
export function createMockWorker(id: WorkerId): WorkerLike {
  return new MockWorker(id);
}

export function createWorker(id: WorkerId): WorkerLike {
  return isE2EMode() ? createMockWorker(id) : createRealWorker(id);
}

/**
 * Deterministic heightmap (smooth gaussian hill, 0..1) used by the E2E mock
 * depth worker — produces identical terrain on every CI run.
 */
export function createDeterministicHeightmap(size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1) - 0.5;
      const nz = z / (size - 1) - 0.5;
      out[z * size + x] = Math.exp(-(nx * nx + nz * nz) * 10);
    }
  }
  return out;
}

function resolveFixture(id: WorkerId, type: string): unknown {
  if (id === 'depth' && type === 'ESTIMATE_DEPTH') {
    const size = 128;
    return { depth: createDeterministicHeightmap(size), width: size, height: size };
  }
  if (id === 'speech' && type === 'TRANSCRIBE') {
    return { text: 'place a bonfire on the hill' };
  }
  if (id === 'tts' && type === 'SPEAK') {
    return { audio: new Float32Array(1600), sampleRate: 24000 };
  }
  return undefined;
}

/** Simulates a worker without threading: answers INIT/READY and fixture results. */
class MockWorker implements WorkerLike {
  private messageHandlers = new Set<(event: MessageEvent) => void>();
  private errorHandlers = new Set<(event: ErrorEvent) => void>();
  private ready = false;

  constructor(private readonly id: WorkerId) {}

  postMessage(message: unknown, _transfer?: Transferable[]): void {
    const req = message as WorkerRequest;
    // Simulate async turnaround so promise ordering matches the real client.
    setTimeout(() => {
      if (req.type === 'INIT') {
        this.ready = true;
        this.emit({ type: 'READY', requestId: req.requestId });
        return;
      }
      if (!this.ready) {
        this.emit({
          type: 'ERROR',
          requestId: req.requestId,
          error: 'Worker not initialized',
        });
        return;
      }
      const payload = resolveFixture(this.id, req.type);
      if (payload === undefined) {
        this.emit({
          type: 'ERROR',
          requestId: req.requestId,
          error: `No fixture for "${req.type}"`,
        });
        return;
      }
      this.emit({ type: 'RESULT', requestId: req.requestId, payload });
    }, 5);
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
