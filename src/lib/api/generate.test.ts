import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = await import('@/lib/api/generate');

function jsonResponse(body: unknown, _ok = true, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('generate API client (real HTTP path)', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetchHealth parses the health contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: 'ok',
          vramMB: 1234,
          cuda: { available: true, deviceName: 'RTX', vramTotalMB: 8191 },
        }),
      ),
    );
    const health = await api.fetchHealth();
    expect(health.status).toBe('ok');
    expect(health.cuda.deviceName).toBe('RTX');
    expect(health.cuda.vramTotalMB).toBe(8191);
  });

  it('generateMesh posts to the contract path and parses the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        jobId: 'j1',
        glbUrl: 'data:model/gltf-binary;base64,AAA=',
        bounds: { min: [0, 0, 0], max: [1, 1, 1], center: [0, 0, 0], size: [1, 1, 1] },
        faceCount: 42,
        vertexCount: 21,
        glbSizeBytes: 100,
        elapsedMs: 500,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.generateMesh({ prompt: 'vase', imageBase64: 'data:x' });
    expect(result.faceCount).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/generate-mesh'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('generateMesh surfaces backend error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ detail: 'mesh generation failed: OOM' }, false, 500),
      ),
    );
    await expect(
      api.generateMesh({ prompt: 'x', imageBase64: 'data:y' }),
    ).rejects.toThrow('mesh generation failed: OOM');
  });
});

describe('generate API client (E2E mock seam)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_E2E = 'true';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
  });

  it('generateMesh returns the deterministic fixture', async () => {
    const result = await api.generateMesh({ prompt: 'vase', imageBase64: 'x' });
    expect(result.faceCount).toBe(18763);
    expect(result.jobId).toMatch(/^e2e-mesh/);
  });

  it('subscribeProgress streams the scripted timeline and unsubscribes', async () => {
    const events: Array<{ stage: string; percent: number }> = [];
    const unsubscribe = api.subscribeProgress((event) =>
      events.push({ stage: event.stage, percent: event.percent }),
    );

    await api.generateMesh({ prompt: 'vase', imageBase64: 'x' });

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].stage).toBe('RECONSTRUCTION');
    expect(events.at(-1)?.stage).toBe('DONE');

    unsubscribe();
    const before = events.length;
    await api.generateMesh({ prompt: 'vase', imageBase64: 'x' });
    expect(events.length).toBe(before); // unsubscribed — no new events
  });

  it('prompt containing "fail" triggers the mock error', async () => {
    await expect(
      api.generateTexture({ prompt: 'make this fail now' }),
    ).rejects.toThrow('GPU queue saturated');
  });
});
