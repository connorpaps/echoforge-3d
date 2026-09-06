'use client';

import { useEffect, useRef } from 'react';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { cameraRef } from '@/lib/viewport/cameraRef';
import type { AudioResult } from '@/lib/api/generate';

/**
 * Bridge between the generation state machine and the scene graph (Task 3.2):
 * when an ambient-audio generation succeeds, its WAV is registered as an
 * `audio_emitter` SceneEntity near the camera, which <AudioEmitters> then
 * renders as a looping HRTF emitter. Deduped by jobId so re-renders or
 * retries never double-spawn.
 */
export function GeneratedAudioBridge() {
  const addEntity = useSceneStore((s) => s.addEntity);
  const selectEntity = useSceneStore((s) => s.selectEntity);
  const status = useGenerationStore((s) => s.status);
  const kind = useGenerationStore((s) => s.kind);
  const result = useGenerationStore((s) => s.result);
  const lastSpawnedJob = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'success' || kind !== 'audio' || !result) return;
    if (!('wavBase64' in result)) return;
    if (lastSpawnedJob.current === result.jobId) return;
    lastSpawnedJob.current = result.jobId;

    const audio = result as AudioResult;
    // Drop the loop just in front of the viewer's camera position.
    const position: [number, number, number] = [
      cameraRef.x,
      cameraRef.y - 1,
      cameraRef.z,
    ];
    const entityId = `audio-${audio.jobId}`;
    addEntity({
      id: entityId,
      name: 'Ambient Loop',
      type: 'audio_emitter',
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      audioUrl: `data:audio/wav;base64,${audio.wavBase64}`,
      volume: 0.8,
      falloffDistance: 15,
      physics: { colliderType: 'none', mass: 0 },
    });
    selectEntity(entityId);
  }, [status, kind, result, addEntity, selectEntity]);

  return null;
}
