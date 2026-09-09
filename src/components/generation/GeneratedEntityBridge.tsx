'use client';

import { useEffect, useRef } from 'react';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import {
  buildMeshEntity,
  facingAzimuthToward,
  SPAWN_POSITION,
} from '@/lib/generation/spawn';
import { cameraRef } from '@/lib/viewport/cameraRef';
import { terrainHeightAt, TERRAIN_SIZE } from '@/lib/terrain/heightmap';
import type { MeshResult } from '@/lib/api/generate';

/**
 * Bridge between the generation state machine and the scene graph.
 *
 * When a mesh generation succeeds, its GLB is added to the entity store as a
 * `SceneEntity` (positioned + auto-scaled), which the viewport's
 * <SceneEntities> then renders. Hermetic mode uses a valid tiny GLB, so this
 * same bridge and loader path are exercised without a GPU.
 */
export function GeneratedEntityBridge() {
  const addEntity = useSceneStore((s) => s.addEntity);
  const selectEntity = useSceneStore((s) => s.selectEntity);
  const status = useGenerationStore((s) => s.status);
  const result = useGenerationStore((s) => s.result);
  const lastSpawnedJob = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'success' || !result) return;
    if (!('glbUrl' in result)) return; // texture results don't spawn meshes
    if (lastSpawnedJob.current === result.jobId) return;
    lastSpawnedJob.current = result.jobId;

    // Sit the asset on top of whatever terrain exists at the spawn point and
    // yaw it so its photo-facing front points at the viewer's camera (the
    // backend guarantees the front faces +Z; cameraRef tracks the live orbit).
    const { terrainHeightmap } = useSceneStore.getState();
    const groundOffset = terrainHeightAt(
      terrainHeightmap,
      TERRAIN_SIZE,
      SPAWN_POSITION[0],
      SPAWN_POSITION[2],
    );
    const facingAzimuth = facingAzimuthToward(
      cameraRef.x,
      cameraRef.z,
      SPAWN_POSITION[0],
      SPAWN_POSITION[2],
    );
    const entity = buildMeshEntity(result as MeshResult, groundOffset, facingAzimuth);
    addEntity(entity);
    selectEntity(entity.id);
  }, [status, result, addEntity, selectEntity]);

  return null;
}
