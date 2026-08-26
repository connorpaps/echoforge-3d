/** Grid resolution shared by the terrain mesh, physics collider, and store. */
export const TERRAIN_SIZE = 128;

/** World-space footprint of the terrain (meters, centered at origin). */
export const TERRAIN_WORLD_SIZE = 64;

/** World-space vertical extent of the displaced terrain (meters). */
export const TERRAIN_HEIGHT_SCALE = 4;

/**
 * Normalize raw depth values into 0..1 elevations. A perfectly flat input
 * yields a flat zero heightmap (no divide-by-zero).
 */
export function normalizeDepth(depth: Float32Array): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (const value of depth) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const range = max - min;
  if (range < 1e-9) return new Float32Array(depth.length);
  const out = new Float32Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    out[i] = (depth[i] - min) / range;
  }
  return out;
}

/** Resample a heightmap to a square NxN grid (nearest-neighbor). */
export function resizeHeightmap(
  source: Float32Array,
  srcWidth: number,
  srcHeight: number,
  dstSize: number,
): Float32Array {
  const out = new Float32Array(dstSize * dstSize);
  for (let z = 0; z < dstSize; z++) {
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.min(
        srcWidth - 1,
        Math.round((x / (dstSize - 1)) * (srcWidth - 1)),
      );
      const sz = Math.min(
        srcHeight - 1,
        Math.round((z / (dstSize - 1)) * (srcHeight - 1)),
      );
      out[z * dstSize + x] = source[sz * srcWidth + sx];
    }
  }
  return out;
}

/** Round elevations to `levels` discrete steps to smooth model noise. */
export function quantizeHeightmap(
  heightmap: Float32Array,
  levels = 32,
): Float32Array {
  const out = new Float32Array(heightmap.length);
  for (let i = 0; i < heightmap.length; i++) {
    out[i] = Math.round(heightmap[i] * levels) / levels;
  }
  return out;
}

/**
 * Apply a radial-falloff elevation brush (additive, clamped to 0..1).
 * `cx`/`cy` are buffer-space coordinates; radius is in buffer pixels.
 */
export function applyElevationBrush(
  elevation: Float32Array,
  size: number,
  cx: number,
  cy: number,
  radius: number,
  height: number,
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(size - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(size - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) {
        const falloff = 1 - d2 / r2;
        const idx = y * size + x;
        elevation[idx] = Math.min(1, elevation[idx] + height * falloff);
      }
    }
  }
}

export function clearElevation(elevation: Float32Array): void {
  elevation.fill(0);
}

/** True when the elevation buffer has no strokes (e.g., after Clear). */
export function isElevationBlank(elevation: Float32Array): boolean {
  return elevation.every((value) => value === 0);
}

export function invertElevation(elevation: Float32Array): void {
  for (let i = 0; i < elevation.length; i++) {
    elevation[i] = 1 - elevation[i];
  }
}

/**
 * Sample the world-space terrain elevation at a point (meters). Returns 0
 * for flat ground when no heightmap exists. Used by the player controller
 * for grounded checks and by the physics collider mapping.
 */
export function terrainHeightAt(
  heightmap: Float32Array | null,
  size: number,
  worldX: number,
  worldZ: number,
): number {
  if (!heightmap) return 0;
  const col = Math.round(
    (worldX / TERRAIN_WORLD_SIZE + 0.5) * (size - 1),
  );
  const row = Math.round(
    (worldZ / TERRAIN_WORLD_SIZE + 0.5) * (size - 1),
  );
  const c = Math.max(0, Math.min(size - 1, col));
  const r = Math.max(0, Math.min(size - 1, row));
  return heightmap[r * size + c] * TERRAIN_HEIGHT_SCALE;
}

/**
 * Full pipeline: normalize raw depth -> resize to the terrain grid ->
 * quantize. Consumed by both the terrain mesh and the physics collider.
 */
export function buildHeightmap(
  depth: Float32Array,
  width: number,
  height: number,
  size = TERRAIN_SIZE,
  levels = 32,
): Float32Array {
  const normalized = normalizeDepth(depth);
  const resized = resizeHeightmap(normalized, width, height, size);
  return quantizeHeightmap(resized, levels);
}
