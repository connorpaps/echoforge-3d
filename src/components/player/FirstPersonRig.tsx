'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EYE_HEIGHT, usePlayerStore } from '@/lib/stores/usePlayerStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';

const MAX_PITCH = 1.2;

/**
 * First-person camera rig (docs/02 §3.3): in play mode the camera follows the
 * player capsule at eye height with pointer-lock mouse look; in editor mode it
 * hands control back to OrbitControls.
 */
export function FirstPersonRig() {
  const mode = useSceneStore((s) => s.activeMode);
  const camera = useThree((s) => s.camera);
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    if (mode === 'play') {
      yaw.current = 0;
      pitch.current = 0;
      const lockPromise = document.body.requestPointerLock?.();
      // Headless browsers reject pointer lock; that's fine — WASD still works.
      if (lockPromise && typeof lockPromise.catch === 'function') {
        lockPromise.catch(() => {});
      }
    } else {
      document.exitPointerLock?.();
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'play') return;
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === null) return;
      yaw.current -= event.movementX * 0.002;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - event.movementY * 0.002,
        -MAX_PITCH,
        MAX_PITCH,
      );
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [mode]);

  useFrame(() => {
    if (mode !== 'play') return;
    const [x, y, z] = usePlayerStore.getState().position;
    camera.position.set(x, y + EYE_HEIGHT, z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null;
}
