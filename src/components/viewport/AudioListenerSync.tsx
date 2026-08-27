'use client';

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAudioContext } from '@/lib/audio/spatialAudio';

/**
 * Mirrors the viewport camera into the Web Audio listener (Task 3.2) so HRTF
 * emitters pan/attenuate relative to where the user is looking. Works in both
 * editor mode (OrbitControls) and play mode (FirstPersonRig) — the R3F camera
 * is the listener either way.
 */
export function AudioListenerSync() {
  useFrame(({ camera }) => {
    const ctx = getAudioContext();
    const listener = ctx?.listener;
    if (!ctx || !listener) return;

    const p = camera.position;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const up = camera.up;

    const l = listener as AudioListener & {
      setPosition?: (x: number, y: number, z: number) => void;
      setOrientation?: (
        x: number,
        y: number,
        z: number,
        ux: number,
        uy: number,
        uz: number,
      ) => void;
    };

    if (l.positionX && l.forwardX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y;
      l.positionZ.value = p.z;
      l.forwardX.value = dir.x;
      l.forwardY.value = dir.y;
      l.forwardZ.value = dir.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    } else if (l.setPosition) {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation?.(dir.x, dir.y, dir.z, up.x, up.y, up.z);
    }
  });

  return null;
}
