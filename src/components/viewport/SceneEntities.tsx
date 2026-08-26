'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

/**
 * Renders every `mesh` entity in the scene store that carries a GLB asset.
 *
 * Uses an imperative GLTFLoader (rather than drei's suspense-based useGLTF)
 * so a corrupt/placeholder payload degrades to "not rendered" instead of
 * throwing through the render tree. Data URLs (the backend returns a base64
 * GLB) are supported by FileLoader natively.
 */
export function SceneEntities() {
  const entities = useSceneStore((s) => s.entities);

  return (
    <>
      {Object.values(entities).map(
        (entity) =>
          entity.glbUrl && <EntityMesh key={entity.id} entity={entity} />,
      )}
    </>
  );
}

function EntityMesh({ entity }: { entity: SceneEntity }) {
  const [loaded, setLoaded] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let alive = true;
    let group: THREE.Group | null = null;

    if (!entity.glbUrl) return;

    new GLTFLoader().load(
      entity.glbUrl,
      (gltf) => {
        if (!alive) return;
        group = gltf.scene;
        gltf.scene.traverse((object) => {
          if (!(object as THREE.Mesh).isMesh) return;
          const mesh = object as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // TripoSR GLBs carry baked vertex colors with no material; make sure
          // they render (GLTFLoader assigns a default material that may not
          // enable vertexColors).
          if (mesh.geometry.getAttribute('color')) {
            const material = mesh.material as
              | THREE.MeshStandardMaterial
              | THREE.MeshStandardMaterial[]
              | undefined;
            const apply = (m: THREE.MeshStandardMaterial) => {
              m.vertexColors = true;
              m.needsUpdate = true;
            };
            if (Array.isArray(material)) material.forEach(apply);
            else if (material) apply(material);
          }
        });
        setLoaded(gltf.scene);
      },
      undefined,
      (error) => {
        // Unparseable payload (e.g., E2E placeholder) — skip silently.
        if (alive) console.warn('[entities] failed to load GLB', error);
      },
    );

    return () => {
      alive = false;
      setLoaded(null);
      group?.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material?.dispose();
        }
      });
    };
  }, [entity.glbUrl]);

  if (!loaded) return null;

  return (
    <group
      position={entity.position}
      rotation={entity.rotation}
      scale={entity.scale}
    >
      <primitive object={loaded} />
    </group>
  );
}
