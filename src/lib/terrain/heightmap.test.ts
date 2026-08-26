import { describe, expect, it } from 'vitest';
import {
  applyElevationBrush,
  buildHeightmap,
  clearElevation,
  invertElevation,
  isElevationBlank,
  normalizeDepth,
  quantizeHeightmap,
  resizeHeightmap,
  TERRAIN_SIZE,
} from '@/lib/terrain/heightmap';

describe('normalizeDepth', () => {
  it('maps values into 0..1', () => {
    const out = normalizeDepth(new Float32Array([10, 20, 30]));
    expect(out).toEqual(new Float32Array([0, 0.5, 1]));
  });

  it('returns a flat zero buffer for constant input', () => {
    const out = normalizeDepth(new Float32Array([5, 5, 5]));
    expect(out).toEqual(new Float32Array([0, 0, 0]));
  });
});

describe('resizeHeightmap', () => {
  it('upsamples 2x2 to 4x4 with nearest-neighbor mapping', () => {
    const src = new Float32Array([0, 1, 1, 0]);
    const out = resizeHeightmap(src, 2, 2, 4);
    expect(out.length).toBe(16);
    // top-left quad comes from source (0,0); top-right from (1,0); etc.
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(1);
    expect(out[12]).toBe(1);
    expect(out[15]).toBe(0);
  });

  it('downsamples to the terrain grid size', () => {
    const src = new Float32Array(256 * 256).fill(0.5);
    const out = resizeHeightmap(src, 256, 256, TERRAIN_SIZE);
    expect(out.length).toBe(TERRAIN_SIZE * TERRAIN_SIZE);
    expect(out[0]).toBe(0.5);
  });
});

describe('quantizeHeightmap', () => {
  it('rounds to discrete steps', () => {
    const out = quantizeHeightmap(new Float32Array([0.23, 0.77]), 4);
    expect(out[0]).toBe(0.25);
    expect(out[1]).toBe(0.75);
  });
});

describe('applyElevationBrush', () => {
  it('raises the center and falls off radially', () => {
    const elevation = new Float32Array(9 * 9);
    applyElevationBrush(elevation, 9, 4, 4, 3, 1);
    const center = elevation[4 * 9 + 4];
    const edge = elevation[1 * 9 + 1]; // distance ~4.24 > radius 3
    expect(center).toBe(1);
    expect(edge).toBe(0);
  });

  it('clamps accumulated elevation at 1', () => {
    const elevation = new Float32Array(9 * 9);
    applyElevationBrush(elevation, 9, 4, 4, 2, 1);
    applyElevationBrush(elevation, 9, 4, 4, 2, 1);
    expect(elevation[4 * 9 + 4]).toBe(1);
  });

  it('is additive with partial height', () => {
    const elevation = new Float32Array(9 * 9);
    applyElevationBrush(elevation, 9, 4, 4, 1, 0.4);
    expect(elevation[4 * 9 + 4]).toBeCloseTo(0.4);
  });
});

describe('clearElevation / invertElevation', () => {
  it('clears to zero', () => {
    const elevation = new Float32Array(4).fill(0.8);
    clearElevation(elevation);
    expect(elevation).toEqual(new Float32Array([0, 0, 0, 0]));
  });

  it('inverts 0..1 values', () => {
    const elevation = new Float32Array([0.2, 0.8]);
    invertElevation(elevation);
    expect(elevation[0]).toBeCloseTo(0.8);
    expect(elevation[1]).toBeCloseTo(0.2);
  });

  it('detects a blank buffer', () => {
    expect(isElevationBlank(new Float32Array(16))).toBe(true);
    const elevation = new Float32Array(16);
    elevation[5] = 0.1;
    expect(isElevationBlank(elevation)).toBe(false);
  });
});

describe('buildHeightmap', () => {
  it('produces a normalized, resized, quantized terrain grid', () => {
    // 8x8 gaussian hill
    const size = 8;
    const depth = new Float32Array(size * size);
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const nx = x / (size - 1) - 0.5;
        const nz = z / (size - 1) - 0.5;
        depth[z * size + x] = Math.exp(-(nx * nx + nz * nz) * 10);
      }
    }
    const hm = buildHeightmap(depth, size, size, TERRAIN_SIZE, 32);
    expect(hm.length).toBe(TERRAIN_SIZE * TERRAIN_SIZE);
    for (const v of hm) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // center is high, corner is low
    expect(hm[(TERRAIN_SIZE / 2) * TERRAIN_SIZE + TERRAIN_SIZE / 2]).toBe(1);
    expect(hm[0]).toBe(0);
  });
});
