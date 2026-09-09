import { isE2EMode } from '@/workers/workerRegistry';
import { buildDeterministicGlbDataUrl } from '@/lib/api/mockGlb';

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
  providers?: {
    mesh?: {
      configured: 'auto' | 'triposr' | 'hunyuan';
      selected: string;
      hunyuan?: { available: boolean; mode: string };
      triposr?: { mode: string };
    };
    texture?: ProviderInfo;
    audio?: ProviderInfo;
    dialogue?: ProviderInfo;
    speech?: ProviderInfo;
    tts?: ProviderInfo;
    depth?: ProviderInfo;
  };
}

export interface ProviderInfo {
  provider: string;
  mode: string;
  fallback?: string;
  available?: boolean;
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

export interface AudioResult {
  jobId: string;
  wavBase64: string;
  /** True when the backend served the procedural fallback, not AudioGen. */
  synthetic: boolean;
  elapsedMs: number;
}

export type ProgressStage =
  | 'DIFFUSION'
  | 'RECONSTRUCTION'
  | 'DECIMATION'
  | 'AUDIO'
  | 'NPC'
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

export async function generateAudio(request: {
  prompt: string;
  durationSec?: number;
  seed?: number | null;
}): Promise<AudioResult> {
  if (isE2EMode()) {
    await maybeFailMock(request.prompt);
    await runMockTimeline('AUDIO');
    return {
      jobId: 'e2e-audio-000003',
      wavBase64: mockWavBase64,
      synthetic: true,
      elapsedMs: 900,
    };
  }
  const response = await fetch(`${API_BASE}/api/v1/generate-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
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
  const buffer = await response.arrayBuffer();
  return {
    jobId: response.headers.get('X-EchoForge-Job') ?? 'unknown',
    wavBase64: arrayBufferToBase64(buffer),
    synthetic: response.headers.get('X-EchoForge-Synthetic') === 'true',
    elapsedMs: 0,
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
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

const mockGlbUrl = buildDeterministicGlbDataUrl();

const mockMeshResult: MeshResult = {
  jobId: 'e2e-mesh-000001',
  glbUrl: mockGlbUrl,
  bounds: {
    min: [-0.5, -0.5, -0.5],
    max: [0.5, 0.5, 0.5],
    center: [0, 0, 0],
    size: [1, 1, 1],
  },
  faceCount: 18763,
  vertexCount: 9412,
  glbSizeBytes: base64ByteLength(mockGlbUrl),
  elapsedMs: 2874,
};

function base64ByteLength(dataUrl: string): number {
  const encoded = dataUrl.split(',', 2)[1] ?? '';
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return (encoded.length * 3) / 4 - padding;
}

const mockTextureResult: TextureResult = {
  jobId: 'e2e-tex-000002',
  imageBase64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  seed: 42,
  elapsedMs: 1120,
};

/** A tiny audible 440 Hz WAV so the mock audio emitter is real to the ear. */
const mockWavBase64 = buildMockWav();

function buildMockWav(): string {
  const sampleRate = 16000;
  const numSamples = sampleRate; // 1s
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const v = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.2;
    view.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return arrayBufferToBase64(buffer);
}

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
async function runMockTimeline(
  stage: 'RECONSTRUCTION' | 'DIFFUSION' | 'AUDIO',
) {
  const ticks: Array<[number, string]> =
    stage === 'RECONSTRUCTION'
      ? [
          [5, 'queued for GPU'],
          [30, 'encoding image features'],
          [60, 'sampling density field'],
          [90, 'extracting surface'],
          [100, 'reconstruction complete'],
        ]
      : stage === 'AUDIO'
        ? [
            [10, 'queued for synthesis'],
            [45, 'sampling audio tokens'],
            [85, 'stitching loop'],
            [100, 'complete'],
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
