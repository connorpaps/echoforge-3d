'use client';

import { useEffect } from 'react';
import {
  decodeWavBase64,
  getAudioContext,
  SpatialAudioEmitter,
} from '@/lib/audio/spatialAudio';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

type AudioEntity = SceneEntity & { audioUrl: string };

/**
 * Renders every `audio_emitter` SceneEntity as a looping HRTF emitter
 * (Task 3.2). Emitters are cached per entity id — position/volume updates
 * mutate the live panner instead of rebuilding audio nodes, and removed
 * entities are reaped and disposed.
 */
const emitters = new Map<string, SpatialAudioEmitter>();

export function AudioEmitters() {
  const entities = useSceneStore((s) => s.entities);
  const setEmitterCount = useUiStore((s) => s.setAudioEmitterCount);

  const audioEntities = Object.values(entities).filter(
    (e): e is AudioEntity => e.type === 'audio_emitter' && !!e.audioUrl,
  );

  // Ensure every audio entity has a live emitter (create → decode → play).
  useEffect(() => {
    const ctx = getAudioContext();
    if (!ctx) {
      setEmitterCount(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      await Promise.all(
        audioEntities.map(async (entity) => {
          try {
            let emitter = emitters.get(entity.id);
            if (!emitter) {
              emitter = new SpatialAudioEmitter(ctx, entity.position, {
                volume: entity.volume ?? 0.8,
                falloffDistance: entity.falloffDistance ?? 15,
              });
              emitters.set(entity.id, emitter);
            }
            emitter.setPosition(entity.position);
            emitter.setVolume(entity.volume ?? 0.8);
            if (!emitter.hasBuffer) {
              const buffer = await decodeWavBase64(ctx, entity.audioUrl);
              if (cancelled) return;
              emitter.setBuffer(buffer);
              emitter.play();
            }
          } catch (err) {
            console.error('[audio] emitter failed to start', entity.id, err);
          }
        }),
      );
      if (!cancelled) setEmitterCount(emitters.size);
    })();

    return () => {
      cancelled = true;
    };
  }, [audioEntities, setEmitterCount]);

  // Reap emitters whose entities were removed from the scene.
  useEffect(() => {
    const live = new Set(audioEntities.map((e) => e.id));
    let changed = false;
    for (const [id, emitter] of emitters) {
      if (!live.has(id)) {
        emitter.dispose();
        emitters.delete(id);
        changed = true;
      }
    }
    if (changed) setEmitterCount(emitters.size);
  }, [audioEntities, setEmitterCount]);

  return null;
}
