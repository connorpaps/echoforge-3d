import type { MeshResult } from '@/lib/api/generate';
import type { SceneEntity } from '@/lib/stores/useSceneStore';

/**
 * World-space spot where freshly generated meshes drop into the scene.
 * Near the origin — the default camera at (12, 10, 12) looks at the origin,
 * so the asset lands inside the editor's field of view on any viewport.
 */
export const SPAWN_POSITION: [number, number, number] = [0, 0, 0];

/** Target world-space height (meters) for a generated mesh. */
export const SPAWN_TARGET_HEIGHT = 2.0;

/**
 * Yaw (radians, around world Y) that turns the +Z-facing front of a mesh
 * toward the point `(cameraX, cameraZ)` as seen from `(fromX, fromZ)`.
 *
 * The backend orients every generated mesh so its photo-facing side points
 * +Z; rotating the entity group by this yaw re-points that side at the
 * viewer's camera.
 */
export function facingAzimuthToward(
  cameraX: number,
  cameraZ: number,
  fromX: number,
  fromZ: number,
): number {
  return Math.atan2(cameraX - fromX, cameraZ - fromZ);
}

/**
 * Convert a successful mesh generation into a scene entity.
 *
 * The backend returns a normalized asset (bounds roughly ±0.5) plus exact
 * model-space bounds, so we scale it to a consistent in-world size and place
 * its base at `groundOffset` (the current terrain height at the spawn point,
 * typically 0 for flat ground) at a fixed spawn position. `facingAzimuth`
 * yaws the asset so its photo-facing front points at the viewer's camera
 * (see `facingAzimuthToward`). The entity id is derived from the job id,
 * which also makes re-spawning the same result a no-op for the store.
 */
export function buildMeshEntity(
  result: MeshResult,
  groundOffset = 0,
  facingAzimuth = 0,
): SceneEntity {
  const { bounds } = result;
  const modelHeight = bounds.size[1] || 1;
  const scale = SPAWN_TARGET_HEIGHT / modelHeight;

  return {
    id: `mesh-${result.jobId}`,
    name: 'Generated Mesh',
    type: 'mesh',
    position: [
      SPAWN_POSITION[0],
      groundOffset - bounds.min[1] * scale,
      SPAWN_POSITION[2],
    ],
    rotation: [0, facingAzimuth, 0],
    scale: [scale, scale, scale],
    glbUrl: result.glbUrl,
    physics: { colliderType: 'convexHull', mass: 0 },
  };
}
