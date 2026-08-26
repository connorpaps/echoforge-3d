'use client';

import { HeightfieldCollider } from '@react-three/rapier';
import { useMemo } from 'react';
import {
  buildHeightfieldSpec,
  flatHeightmap,
} from '@/lib/physics/rapierHeightfield';
import { TERRAIN_SIZE } from '@/lib/terrain/heightmap';
import { useSceneStore } from '@/lib/stores/useSceneStore';

/**
 * Heightfield collider driven by the terrain heightmap. When no terrain
 * exists yet the collider is a flat zero field, so play mode is walkable
 * from the start (docs/08 Task 1.5).
 */
export function TerrainCollider() {
  const heightmap = useSceneStore((s) => s.terrainHeightmap);

  const spec = useMemo(
    () => buildHeightfieldSpec(heightmap ?? flatHeightmap(), TERRAIN_SIZE),
    [heightmap],
  );

  return (
    <HeightfieldCollider
      args={[spec.width, spec.height, spec.heights, spec.scale]}
      friction={1}
    />
  );
}
