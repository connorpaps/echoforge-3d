'use client';

import { useSceneStore } from '@/lib/stores/useSceneStore';

/**
 * Visual placeholder for `npc` SceneEntities (Task 3.3): a glowing ring on
 * the ground + a floating violet orb so the player can see where to walk to
 * press E. A proper NPC mesh/rig lands in the post-plan mesh milestone.
 */
export function NpcMarkers() {
  const entities = useSceneStore((s) => s.entities);
  const npcs = Object.values(entities).filter((e) => e.type === 'npc');

  return (
    <>
      {npcs.map((entity) => (
        <group key={entity.id} position={entity.position}>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.35, 0.55, 24]} />
            <meshBasicMaterial color="#5e6ad2" />
          </mesh>
          <mesh position={[0, 1, 0]}>
            <sphereGeometry args={[0.28, 16, 16]} />
            <meshStandardMaterial
              color="#5e6ad2"
              emissive="#23284f"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}
