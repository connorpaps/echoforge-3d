import { describe, expect, it } from 'vitest';
import {
  buildHeightfieldSpec,
  flatHeightmap,
  heightmapToPhysicsGrid,
} from '@/lib/physics/rapierHeightfield';
import {
  TERRAIN_HEIGHT_SCALE,
  TERRAIN_SIZE,
  TERRAIN_WORLD_SIZE,
} from '@/lib/terrain/heightmap';

describe('heightmapToPhysicsGrid', () => {
  it('transposes and flips the mesh layout onto rapier coordinates', () => {
    const size = 8;
    const src = new Float32Array(size * size);
    src[2 * size + 5] = 0.75; // mesh row 2, col 5

    const out = heightmapToPhysicsGrid(src, size);

    // rapier places out[i * ncols + j] at world (x = i, z = j); the mesh puts
    // src[z][x] at world (x, z = size-1-z), so the bump must land at i=5, j=5.
    expect(out[5 * size + 5]).toBe(0.75);
    expect(out[2 * size + 5]).toBe(0);
    expect(out).toHaveLength(size * size);
  });

  it('is a bijection (no values lost)', () => {
    const src = new Float32Array(TERRAIN_SIZE * TERRAIN_SIZE);
    for (let i = 0; i < src.length; i++) src[i] = (i % 7) / 7;
    const out = heightmapToPhysicsGrid(src, TERRAIN_SIZE);
    expect([...out].sort()).toEqual([...src].sort());
  });
});

describe('buildHeightfieldSpec', () => {
  it('exposes cell counts with a (cells+1)^2 sample grid (rapier 0.19 dim3 semantics)', () => {
    const heightmap = new Float32Array(TERRAIN_SIZE * TERRAIN_SIZE);
    heightmap[3 * TERRAIN_SIZE + 7] = 0.75;

    const spec = buildHeightfieldSpec(heightmap, TERRAIN_SIZE);

    // The installed wasm binding builds a (nrows+1) x (ncols+1) DMatrix from
    // the heights array, so cells = size-1 while samples stay size*size.
    expect(spec.width).toBe(TERRAIN_SIZE - 1);
    expect(spec.height).toBe(TERRAIN_SIZE - 1);
    expect(spec.heights).toHaveLength(TERRAIN_SIZE * TERRAIN_SIZE);
    expect(spec.heights).toHaveLength((spec.width + 1) * (spec.height + 1));
  });

  it('scales X/Z by the full world extent and Y by the height scale', () => {
    const spec = buildHeightfieldSpec(new Float32Array(TERRAIN_SIZE * TERRAIN_SIZE));
    // The heightfield local grid is normalized to ±0.5, so the scale is the
    // WHOLE footprint — not the per-cell width. With x = 64 the terrain spans
    // the full 64m; per-cell width would collapse it to a 1x1 patch.
    expect(spec.scale.x).toBe(TERRAIN_WORLD_SIZE);
    expect(spec.scale.z).toBe(TERRAIN_WORLD_SIZE);
    expect(spec.scale.y).toBe(TERRAIN_HEIGHT_SCALE);
  });

  it('the flat fallback is all zeros and walkable', () => {
    const flat = flatHeightmap();
    expect(flat).toHaveLength(TERRAIN_SIZE * TERRAIN_SIZE);
    expect(flat.every((v) => v === 0)).toBe(true);
  });
});
