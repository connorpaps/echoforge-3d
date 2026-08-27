'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { captureViewportFrame } from '@/lib/viewport/capture';
import { useDialogueStore } from '@/lib/stores/useDialogueStore';
import { usePlayerStore } from '@/lib/stores/usePlayerStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';

export const INTERACT_DISTANCE = 4;

/**
 * Module-level proximity mirror (written per frame from the render loop,
 * read by the DOM DialogueBubble on a slow poll) — avoids zustand churn at
 * 60 fps the same way cameraRef does.
 */
export const npcProximityRef: { id: string | null; distance: number } = {
  id: null,
  distance: Infinity,
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );
}

/**
 * Vision-NPC interaction (Task 3.3): tracks proximity to `npc` entities and
 * on <E> captures the current viewport frame and asks the backend SmolVLM
 * service for a persona-driven reply (played back by Kokoro in Task 3.4).
 */
export function NpcInteract() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  // Track the nearest NPC within interact range each frame.
  useFrame(() => {
    const { entities, activeMode } = useSceneStore.getState();
    const reference =
      activeMode === 'play'
        ? usePlayerStore.getState().position
        : [camera.position.x, camera.position.y, camera.position.z];

    let nearest: string | null = null;
    let nearestDistance = INTERACT_DISTANCE;
    for (const [id, entity] of Object.entries(entities)) {
      if (entity.type !== 'npc') continue;
      const [x, y, z] = entity.position;
      const distance = Math.hypot(x - reference[0], y - reference[1], z - reference[2]);
      if (distance < nearestDistance) {
        nearest = id;
        nearestDistance = distance;
      }
    }
    npcProximityRef.id = nearest;
    npcProximityRef.distance = nearestDistance;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e' || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const entityId = npcProximityRef.id;
      if (!entityId) return;
      const entity = useSceneStore.getState().entities[entityId];
      if (!entity || entity.type !== 'npc') return;
      if (useDialogueStore.getState().thinking) return;

      const frame = captureViewportFrame(gl, scene, camera);
      if (!frame) return;
      void useDialogueStore.getState().speak(
        entityId,
        frame,
        entity.npcPersona,
      );
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gl, scene, camera]);

  return null;
}
