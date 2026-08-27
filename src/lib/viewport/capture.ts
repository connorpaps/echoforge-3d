import * as THREE from 'three';

/**
 * Capture the current viewport frame without `preserveDrawingBuffer`
 * (which would tax the renderer permanently). Renders the scene into an
 * offscreen WebGLRenderTarget, reads the pixels back, and encodes a PNG
 * data URL via a 2D canvas — used for the vision-aware NPC (Task 3.3).
 */
export function captureViewportFrame(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  maxWidth = 512,
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const width = Math.min(gl.domElement.width, maxWidth);
  const height = Math.max(
    1,
    Math.round((gl.domElement.height / gl.domElement.width) * width),
  );

  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const previousTarget = gl.getRenderTarget();
  gl.setRenderTarget(target);
  gl.render(scene, camera);
  gl.setRenderTarget(previousTarget);

  const pixels = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  target.dispose();

  // readRenderTargetPixels is bottom-up — flip rows for the 2D canvas.
  const image = ctx.createImageData(width, height);
  const flipped = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    flipped.set(pixels.subarray(srcRow, srcRow + width * 4), y * width * 4);
  }
  image.data.set(flipped);
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
