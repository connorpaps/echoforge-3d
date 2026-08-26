import { isE2EMode } from '@/workers/workerRegistry';

/**
 * EchoForge 3D — generative backend client (docs/04_API_CONTRACTS.md).
 *
 * Talks to the FastAPI microservice (backend/main.py) over REST for
 * generation + a WebSocket for live progress ticks. In E2E hermetic mode
 * (`NEXT_PUBLIC_E2E="true"`) every call is replaced with a deterministic
 * fixture and the progress stream is scripted, so CI never needs a GPU.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

// --- contracts ---------------------------------------------------------------

export interface CudaInfo {
  available: boolean;
  deviceName: string | null;
  vramTotalMB: number;
  vramAllocatedMB: number;
  vramReservedMB: number;
  vramPeakReservedMB: number;
}

export interface HealthInfo {
  status: string;
  vramMB: number;
  cuda: CudaInfo;
}

export interface MeshBounds {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
}

export interface MeshResult {
  jobId: string;
  glbUrl: string;
  bounds: MeshBounds;
  faceCount: number;
  vertexCount: number;
  glbSizeBytes: number;
  elapsedMs: number;
}

export interface TextureResult {
  jobId: string;
  imageBase64: string;
  seed: number | null;
  elapsedMs: number;
}

export type ProgressStage =
  | 'DIFFUSION'
  | 'RECONSTRUCTION'
  | 'DECIMATION'
  | 'DONE'
  | 'ERROR';

export interface ProgressEvent {
  jobId: string;
  stage: ProgressStage;
  percent: number;
  message: string;
}

// --- REST --------------------------------------------------------------------

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { detail?: string };
      if (data.detail) detail = data.detail;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export async function fetchHealth(): Promise<HealthInfo> {
  if (isE2EMode()) return mockHealth;
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as HealthInfo;
}

export async function generateMesh(request: {
  prompt: string;
  imageBase64: string;
  resolution?: number;
}): Promise<MeshResult> {
  if (isE2EMode()) {
    await maybeFailMock(request.prompt);
    await runMockTimeline('RECONSTRUCTION');
    return mockMeshResult;
  }
  return postJson<MeshResult>('/api/v1/generate-mesh', request);
}

export async function generateTexture(request: {
  prompt: string;
  seed?: number | null;
}): Promise<TextureResult> {
  if (isE2EMode()) {
    await maybeFailMock(request.prompt);
    await runMockTimeline('DIFFUSION');
    return mockTextureResult;
  }
  return postJson<TextureResult>('/api/v1/generate-texture', request);
}

// --- WebSocket progress -------------------------------------------------------

/**
 * Subscribe to live progress events. Returns an unsubscribe function.
 * In E2E mode the stream is driven by the mock timeline instead of a socket.
 */
export function subscribeProgress(
  onEvent: (event: ProgressEvent) => void,
): () => void {
  if (isE2EMode()) {
    mockBus.add(onEvent);
    return () => mockBus.delete(onEvent);
  }
  const socket = new WebSocket(`${WS_BASE}/ws/progress`);
  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data as string) as ProgressEvent);
    } catch {
      // ignore malformed frames
    }
  };
  return () => socket.close();
}

// --- E2E fixtures ---------------------------------------------------------------

const mockHealth: HealthInfo = {
  status: 'ok',
  vramMB: 4256,
  cuda: {
    available: true,
    deviceName: 'Mock Rasterizer (E2E)',
    vramTotalMB: 8191,
    vramAllocatedMB: 96,
    vramReservedMB: 4256,
    vramPeakReservedMB: 7421,
  },
};

const mockMeshResult: MeshResult = {
  jobId: 'e2e-mesh-000001',
  glbUrl:
    'data:model/gltf-binary;base64,AAAAGgIAAAAGbW9jaw==', // minimal placeholder payload
  bounds: {
    min: [-0.5, -0.5, -0.5],
    max: [0.5, 0.5, 0.5],
    center: [0, 0, 0],
    size: [1, 1, 1],
  },
  faceCount: 18763,
  vertexCount: 9412,
  glbSizeBytes: 400768,
  elapsedMs: 2874,
};

const mockTextureResult: TextureResult = {
  jobId: 'e2e-tex-000002',
  imageBase64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  seed: 42,
  elapsedMs: 1120,
};

type MockBusHandler = (event: ProgressEvent) => void;
const mockBus = new Set<MockBusHandler>();

function emitMock(event: Omit<ProgressEvent, 'jobId'> & { jobId?: string }) {
  const full: ProgressEvent = {
    jobId: event.jobId ?? 'e2e',
    stage: event.stage,
    percent: event.percent,
    message: event.message,
  };
  mockBus.forEach((handler) => handler(full));
}

/** Deterministic error trigger for E2E tests (prompt containing "fail"). */
async function maybeFailMock(prompt: string) {
  if (prompt.toLowerCase().includes('fail')) {
    await sleep(120);
    throw new Error('GPU queue saturated — retry in 3s (mock)');
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Scripted progress timeline so the generating pill animates in E2E runs. */
async function runMockTimeline(stage: 'RECONSTRUCTION' | 'DIFFUSION') {
  const ticks: Array<[number, string]> =
    stage === 'RECONSTRUCTION'
      ? [
          [5, 'queued for GPU'],
          [30, 'encoding image features'],
          [60, 'sampling density field'],
          [90, 'extracting surface'],
          [100, 'reconstruction complete'],
        ]
      : [
          [15, 'model loaded — sampling'],
          [55, 'step 1/1'],
          [100, 'complete'],
        ];
  for (const [percent, message] of ticks) {
    emitMock({ stage, percent, message });
    await sleep(120);
  }
  emitMock({ stage: 'DONE', percent: 100, message: 'done' });
}
