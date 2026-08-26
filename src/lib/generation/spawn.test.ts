import { describe, expect, it } from 'vitest';
import {
  buildMeshEntity,
  facingAzimuthToward,
  SPAWN_POSITION,
  SPAWN_TARGET_HEIGHT,
} from './spawn';
import type { MeshResult } from '@/lib/api/generate';

function makeResult(overrides: Partial<MeshResult> = {}): MeshResult {
  return {
    jobId: 'abc123',
    glbUrl: 'data:model/gltf-binary;base64,AAA=',
    bounds: {
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
      center: [0, 0, 0],
      size: [1, 1, 1],
    },
    faceCount: 19994,
    vertexCount: 10001,
    glbSizeBytes: 535045,
    elapsedMs: 10421,
    ...overrides,
  };
}

describe('buildMeshEntity', () => {
  it('derives a stable id from the job id', () => {
    const entity = buildMeshEntity(makeResult());
    expect(entity.id).toBe('mesh-abc123');
    expect(entity.type).toBe('mesh');
    expect(entity.name).toBe('Generated Mesh');
  });

  it('scales a unit-sized asset to the target height and sits it on the ground', () => {
    const entity = buildMeshEntity(makeResult());
    expect(entity.scale[1]).toBeCloseTo(SPAWN_TARGET_HEIGHT);
    // base of the model (min.y) lands on y = 0
    expect(entity.position[1]).toBeCloseTo(0.5 * SPAWN_TARGET_HEIGHT);
    expect(entity.position[0]).toBe(SPAWN_POSITION[0]);
    expect(entity.position[2]).toBe(SPAWN_POSITION[2]);
  });

  it('scales by the vertical size when the model is not cubic', () => {
    const result = makeResult({
      bounds: {
        min: [-0.2, -1.0, -0.2],
        max: [0.2, 1.0, 0.2],
        center: [0, 0, 0],
        size: [0.4, 2.0, 0.4],
      },
    });
    const entity = buildMeshEntity(result);
    expect(entity.scale[0]).toBeCloseTo(1.0);
    expect(entity.position[1]).toBeCloseTo(1.0);
  });

  it('guards against a zero-height model', () => {
    const result = makeResult({
      bounds: {
        min: [-0.5, -0.5, -0.5],
        max: [0.5, -0.5, 0.5],
        center: [0, -0.5, 0],
        size: [1, 0, 1],
      },
    });
    const entity = buildMeshEntity(result);
    expect(entity.scale[1]).toBeCloseTo(SPAWN_TARGET_HEIGHT);
  });

  it('raises the base by the terrain ground offset', () => {
    const entity = buildMeshEntity(makeResult(), 2.5);
    expect(entity.position[1]).toBeCloseTo(2.5 + 0.5 * SPAWN_TARGET_HEIGHT);
  });

  it('carries the glb url and static convex hull physics metadata', () => {
    const entity = buildMeshEntity(makeResult());
    expect(entity.glbUrl).toContain('data:model/gltf-binary');
    expect(entity.physics).toEqual({ colliderType: 'convexHull', mass: 0 });
  });

  it('defaults to a zero yaw rotation', () => {
    expect(buildMeshEntity(makeResult()).rotation).toEqual([0, 0, 0]);
  });

  it('applies the facing azimuth as a yaw around Y', () => {
    const entity = buildMeshEntity(makeResult(), 0, Math.PI / 2);
    expect(entity.rotation).toEqual([0, Math.PI / 2, 0]);
  });

  it('computes the azimuth that points the +Z front at the camera', () => {
    // camera at (12, 0, 12), asset at spawn (2, 0, 0): front should face
    // normalize(10, 12) on the XZ plane
    const yaw = facingAzimuthToward(12, 12, SPAWN_POSITION[0], SPAWN_POSITION[2]);
    const dx = 12 - SPAWN_POSITION[0];
    const dz = 12 - SPAWN_POSITION[2];
    // rotating +Z by `yaw` around Y gives (sin yaw, 0, cos yaw)
    expect(Math.sin(yaw)).toBeCloseTo(dx / Math.hypot(dx, dz));
    expect(Math.cos(yaw)).toBeCloseTo(dz / Math.hypot(dx, dz));
  });
});
