import { describe, expect, it } from 'vitest';
import {
  createFakeRecordingSession,
  resamplePcm,
} from '@/lib/audio/recorder';

describe('resamplePcm', () => {
  it('returns a copy at the same rate', () => {
    const input = new Float32Array([0, 0.5, 1]);
    const out = resamplePcm(input, 16000, 16000);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('halves the length when downsampling 32k -> 16k', () => {
    const input = new Float32Array(3200).map((_, i) => Math.sin(i / 20));
    const out = resamplePcm(input, 32000, 16000);
    expect(out.length).toBe(1600);
  });

  it('linearly interpolates between samples', () => {
    // 3 samples [0,1,0] at 3Hz -> 2Hz: positions 0 and 1.5; index 1.5
    // lands halfway between sample 1 (1) and sample 2 (0).
    const out = resamplePcm(new Float32Array([0, 1, 0]), 3, 2);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0.5);
  });
});

describe('E2E fake recording session', () => {
  it('emits a deterministic 16kHz PCM buffer', async () => {
    const session = createFakeRecordingSession();
    const pcm = await session.stop();
    expect(pcm).toBeInstanceOf(Float32Array);
    expect(pcm.length).toBe(8000); // 0.5s at 16kHz
    expect(pcm.some((v) => v !== 0)).toBe(true);
  });

  it('cancel is a no-op that resolves cleanly', () => {
    const session = createFakeRecordingSession();
    expect(() => session.cancel()).not.toThrow();
  });
});
