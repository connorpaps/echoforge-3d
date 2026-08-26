'use client';

import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { inputDirection, usePlayerInput } from '@/lib/physics/controls';
import { PLAYER_SPAWN, usePlayerStore } from '@/lib/stores/usePlayerStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { terrainHeightAt } from '@/lib/terrain/heightmap';

const WALK_SPEED = 4.2;
const JUMP_SPEED = 5.5;
const CAPSULE_HALF_HEIGHT = 0.5;
const CAPSULE_RADIUS = 0.4;

function cameraYaw(camera: THREE.Camera): number {
  // YXZ order: yaw is the Y rotation (0 = looking down -Z).
  return camera.rotation.y;
}

/**
 * First-person capsule: dynamic rigid body (gravity applies naturally) with
 * per-frame horizontal velocity from WASD (camera-relative) and jump impulses
 * when grounded. Grounded is computed from the terrain heightmap (or flat
 * ground), so the character never relies on fallback collision checks.
 */
export function PlayerController() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const input = usePlayerInput();
  const mode = useSceneStore((s) => s.activeMode);

  // Respawn deterministically when entering play mode.
  useEffect(() => {
    if (mode === 'play') {
      bodyRef.current?.setTranslation(
        { x: PLAYER_SPAWN[0], y: PLAYER_SPAWN[1], z: PLAYER_SPAWN[2] },
        true,
      );
      usePlayerStore.getState().reset();
    }
  }, [mode]);

  useFrame(({ camera }) => {
    const body = bodyRef.current;
    if (!body) return;
    if (mode !== 'play') return;

    const [forward, strafe] = inputDirection(input.current);
    const yaw = cameraYaw(camera);

    // Camera-relative horizontal direction.
    const dir = new THREE.Vector3();
    dir.x = -Math.sin(yaw) * forward + -Math.cos(yaw) * strafe;
    dir.z = -Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
    if (dir.lengthSq() > 0) dir.normalize();

    const velocity = body.linvel();
    const x = dir.x * WALK_SPEED;
    const z = dir.z * WALK_SPEED;

    // Grounded check against the terrain heightfield.
    const translation = body.translation();
    const terrain = useSceneStore.getState().terrainHeightmap;
    const groundY = terrainHeightAt(
      terrain,
      128,
      translation.x,
      translation.z,
    );
    const feetY = translation.y - CAPSULE_HALF_HEIGHT - CAPSULE_RADIUS;
    const grounded = feetY <= groundY + 0.25;

    let y = velocity.y;
    if (input.current.jump && grounded) y = JUMP_SPEED;

    body.setLinvel({ x, y, z }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);

    usePlayerStore.getState().setGrounded(grounded);
    usePlayerStore
      .getState()
      .setPosition([translation.x, translation.y, translation.z]);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      position={PLAYER_SPAWN}
      colliders={false}
      canSleep={false}
      lockRotations
      linearDamping={0.05}
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
    </RigidBody>
  );
}
