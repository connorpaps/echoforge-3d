import {
  TERRAIN_HEIGHT_SCALE,
  TERRAIN_SIZE,
  TERRAIN_WORLD_SIZE,
} from '@/lib/terrain/heightmap';

/**
 * Args tuple for @react-three/rapier's `<HeightfieldCollider>`
 * (verified from the published types: `[width, height, heights, scale]`).
 *
 * VERIFIED EMPIRICALLY AGAINST THE INSTALLED BINDINGS
 * (@dimforge/rapier3d-compat 0.19.2). Three quirks must be handled here or
 * the physics terrain silently vanishes (player falls through):
 *
 * 1. CELL COUNTS, NOT SAMPLE COUNTS — the dim3 wasm binding builds
 *    `DMatrix::from_vec(nrows + 1, ncols + 1, heights)`, so `width`/`height`
 *    are cell counts and the heights array must hold `(nrows+1) * (ncols+1)`
 *    samples. Passing `size` cells with `size*size` heights traps the wasm
 *    module (`RuntimeError: unreachable`) and crashes the page.
 *
 * 2. FULL-EXTENT SCALE — the heightfield's local grid is normalized to a
 *    ±0.5 unit square, so `scale.x/z` is the WHOLE world footprint, not the
 *    per-cell width. With scale.x = cell (= 64/127) the terrain collapses to a
 *    1×1 unit patch and nothing collides.
 *
 * 3. TRANSPOSED + FLIPPED LAYOUT — the DMatrix column-major construction makes
 *    rapier place sample `heights[i * ncols + j]` at world (x = i, z = j),
 *    while our mesh places `heightmap[z * size + x]` at world
 *    (x = x, z = size-1-z). The converter below maps our mesh layout onto the
 *    physics layout so collider and visuals agree exactly.
 */
export interface HeightfieldSpec {
  width: number; // cell count along X
  height: number; // cell count along Z
  heights: number[]; // (width+1) * (height+1) samples
  scale: { x: number; y: number; z: number };
}

/**
 * Maps our mesh layout (`heightmap[z * size + x]`, world z grows upward in the
 * grid) onto rapier's physics layout (`heights[i * ncols + j]`, world z grows
 * with j). Verified against `world.debugRender()` output: a bump at
 * `heightmap[2 * 8 + 5]` must appear at world x = col, z = size-1-row.
 */
export function heightmapToPhysicsGrid(
  heightmap: Float32Array,
  size = TERRAIN_SIZE,
): Float32Array {
  const out = new Float32Array(size * size);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      out[x * size + (size - 1 - z)] = heightmap[z * size + x];
    }
  }
  return out;
}

export function buildHeightfieldSpec(
  heightmap: Float32Array,
  size = TERRAIN_SIZE,
): HeightfieldSpec {
  return {
    width: size - 1,
    height: size - 1,
    heights: Array.from(heightmapToPhysicsGrid(heightmap, size)),
    scale: {
      x: TERRAIN_WORLD_SIZE,
      y: TERRAIN_HEIGHT_SCALE,
      z: TERRAIN_WORLD_SIZE,
    },
  };
}

/** Flat fallback collider so play mode is walkable before any terrain exists. */
export function flatHeightmap(size = TERRAIN_SIZE): Float32Array {
  return new Float32Array(size * size);
}
