import { createWorkerClient, type WorkerClient } from '@/workers/workerFactory';
import { createWorker } from '@/workers/workerRegistry';
import {
  getAudioContext,
  resumeAudioContext,
  SpatialAudioEmitter,
} from '@/lib/audio/spatialAudio';
import type { TtsResult } from '@/workers/workerTypes';

/**
 * Kokoro-82M TTS playback layer (Task 3.4).
 *
 * Owns a lazily-created tts.worker client (real model worker, or the
 * deterministic fixture client in E2E mode) and plays synthesized speech
 * through the HRTF spatial bus — attached to an NPC entity position when one
 * is given, so dialogue pans/attenuates like any other emitter.
 */

let ttsClient: WorkerClient | null = null;
let ttsInitPromise: Promise<WorkerClient> | null = null;

async function ensureTtsClient(): Promise<WorkerClient> {
  if (ttsClient) return ttsClient;
  if (!ttsInitPromise) {
    ttsInitPromise = (async () => {
      const client = createWorkerClient(createWorker('tts'));
      try {
        await client.request('INIT');
        ttsClient = client;
        return client;
      } catch (err) {
        client.dispose();
        ttsInitPromise = null;
        throw err;
      }
    })();
  }
  return ttsInitPromise;
}

export interface SpeakOptions {
  voice?: string;
  /** Attach the utterance to a 3D position (NPC speech → spatial panning). */
  position?: [number, number, number];
}

/**
 * Synthesize and play a line of dialogue. Resolves once playback has
 * *started* (not finished); safe to fire-and-forget.
 */
export async function speakDialogue(
  text: string,
  options: SpeakOptions = {},
): Promise<void> {
  if (!text.trim()) return;
  const ctx = getAudioContext();
  if (!ctx) return; // no Web Audio in this environment — nothing to play
  resumeAudioContext();

  const client = await ensureTtsClient();
  const result = await client.request<TtsResult>('SPEAK', {
    text,
    voice: options.voice ?? 'af_heart',
  });

  // decodeAudioData detaches the transferred buffer, so copy it first.
  const buffer = await ctx.decodeAudioData(result.audio.slice().buffer);

  if (options.position) {
    // One-shot spatial utterance at the NPC position; self-disposes on end.
    const emitter = new SpatialAudioEmitter(ctx, options.position, {
      volume: 1,
      loop: false,
    });
    emitter.setBuffer(buffer);
    emitter.playOneShot();
  } else {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }
}
