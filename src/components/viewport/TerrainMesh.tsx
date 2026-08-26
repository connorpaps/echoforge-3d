'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { positionLocal, texture, vec3 } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';
import {
  TERRAIN_HEIGHT_SCALE,
  TERRAIN_SIZE,
} from '@/lib/terrain/heightmap';
import { heightmapToDataTexture } from '@/lib/terrain/heightmapTexture';

/**
 * Terrain mesh displaced in real time by a TSL node material sampling the
 * heightmap texture (docs/08 Task 1.4). The geometry stays flat; the
 * positionNode raises vertices along local +Z (which maps to world +Y after
 * the plane's rotateX). Flat shading derives normals from displaced world
 * position, so lighting follows the actual surface.
 */
export function TerrainMesh() {
  const heightmap = useSceneStore((s) => s.terrainHeightmap);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(64, 64, TERRAIN_SIZE, TERRAIN_SIZE);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new MeshStandardNodeMaterial({
        color: new THREE.Color('#2a2f3a'),
        flatShading: true,
        roughness: 0.9,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    if (!heightmap) return;
    const heightTex = heightmapToDataTexture(heightmap, TERRAIN_SIZE);
    material.positionNode = positionLocal.add(
      vec3(0, 0, texture(heightTex).r.mul(TERRAIN_HEIGHT_SCALE)),
    );
    material.needsUpdate = true;
  }, [heightmap, material]);

  useEffect(() => {
    useUiStore.getState().setTerrainVertexCount(TERRAIN_SIZE * TERRAIN_SIZE);
    return () => useUiStore.getState().setTerrainVertexCount(0);
  }, []);

  if (!heightmap) return null;

  return <mesh geometry={geometry} material={material} receiveShadow />;
}
