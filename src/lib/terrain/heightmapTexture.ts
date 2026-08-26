import * as THREE from 'three';

/** Wrap a Float32Array heightmap as a single-channel float texture for TSL. */
export function heightmapToDataTexture(
  heightmap: Float32Array,
  size: number,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(
    heightmap,
    size,
    size,
    THREE.RedFormat,
    THREE.FloatType,
  );
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
