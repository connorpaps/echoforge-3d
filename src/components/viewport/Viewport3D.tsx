'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { Scene } from './Scene';

/**
 * R3F v9 renderer selection.
 *
 * Default: stable WebGL2 renderer with TSL-capable materials.
 * When NEXT_PUBLIC_ENABLE_WEBGPU === "true": experimental WebGPU renderer via
 * three/webgpu's WebGPURenderer through R3F's async `gl` factory. All scene
 * materials are TSL node materials, so the renderer swap is the only change.
 */
export default function Viewport3D() {
  const useWebGPU = process.env.NEXT_PUBLIC_ENABLE_WEBGPU === 'true';

  if (useWebGPU) {
    return (
      <Canvas
        gl={async (defaultProps) => {
          const { WebGPURenderer } = await import('three/webgpu');
          const renderer = new WebGPURenderer({
            // R3F passes a real DOM canvas on the web renderer path
            canvas: defaultProps.canvas as HTMLCanvasElement,
            antialias: true,
          });
          await renderer.init();
          return renderer;
        }}
        camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 200 }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    );
  }

  return (
    <Canvas
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        // three r185: the WebGL renderer only compiles TSL node materials
        // (MeshStandardNodeMaterial) after an explicit opt-in. Without this,
        // node materials have no vertex/fragment shader and WebGLProgram
        // crashes with "Cannot read properties of undefined (reading
        // 'replace')" on the first draw — the whole frame aborts and the
        // viewport goes black the moment terrain is generated.
        gl.setNodesHandler(new WebGLNodesHandler());
      }}
      camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 200 }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
