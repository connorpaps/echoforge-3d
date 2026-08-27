'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useUiStore } from '@/lib/stores/useUiStore';
import {
  createWebGlPostFx,
  createWebGpuPostFx,
  type PostFxHandle,
} from '@/lib/viewport/postprocessing';

/**
 * Post-processing mount (Task 3.5). Renders through the composer every frame
 * with a positive renderPriority, which tells R3F to skip its own render
 * (verified against fiber v9's loop: `internal.priority > 0` disables the
 * automatic `gl.render`). The FX toggle from the TopBar flips the bloom/FXAA
 * passes live.
 */
export function PostFx() {
  const useWebGPU = process.env.NEXT_PUBLIC_ENABLE_WEBGPU === 'true';
  return useWebGPU ? <WebGpuPostFx /> : <WebGlPostFx />;
}

function WebGlPostFx() {
  const gl = useThree((s) => s.gl) as THREE.WebGLRenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const enabled = useUiStore((s) => s.postFxEnabled);
  const handleRef = useRef<PostFxHandle | null>(null);

  useEffect(() => {
    const handle = createWebGlPostFx(gl, scene, camera, enabled);
    handle.setSize(size.width, size.height);
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
    // Composer is created once per renderer/scene/camera — the enabled flag
    // is applied by the toggle effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    handleRef.current?.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    handleRef.current?.setSize(size.width, size.height);
  }, [size.width, size.height]);

  useFrame(() => {
    handleRef.current?.render();
  }, 1);

  return null;
}

function WebGpuPostFx() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const enabled = useUiStore((s) => s.postFxEnabled);
  const handleRef = useRef<PostFxHandle | null>(null);

  useEffect(() => {
    let disposed = false;
    void createWebGpuPostFx(gl, scene, camera, enabled).then((handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
    });
    return () => {
      disposed = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    handleRef.current?.setEnabled(enabled);
  }, [enabled]);

  useFrame(() => {
    handleRef.current?.render();
  }, 1);

  return null;
}
