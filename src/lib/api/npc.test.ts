import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = await import('@/lib/api/npc');

describe('npc API client (real HTTP path)', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the frame + persona and parses the dialogue contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jobId: 'npc1',
          dialogueText: 'I see a campfire on the ridge.',
          synthetic: false,
          elapsedMs: 420,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.requestNpcDialogue({
      frameBase64: 'data:image/png;base64,AAAA',
      persona: 'be terse',
    });
    expect(result.dialogueText).toContain('campfire');
    expect(result.synthetic).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/npc-dialogue'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('surfaces backend error details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'NPC dialogue failed: OOM' }),
          { status: 500 },
        ),
      ),
    );
    await expect(
      api.requestNpcDialogue({ frameBase64: 'x' }),
    ).rejects.toThrow('NPC dialogue failed: OOM');
  });
});

describe('npc API client (E2E mock seam)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_E2E = 'true';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
  });

  it('returns the deterministic fixture transcript', async () => {
    const result = await api.requestNpcDialogue({ frameBase64: 'x' });
    expect(result.jobId).toMatch(/^e2e-npc/);
    expect(result.synthetic).toBe(true);
    expect(result.dialogueText.length).toBeGreaterThan(0);
  });
});
