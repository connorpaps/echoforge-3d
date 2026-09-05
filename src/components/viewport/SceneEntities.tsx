'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

/**
 * Renders every `mesh` entity in the scene store that carries a GLB asset.
 *
 * Uses an imperative GLTFLoader (rather than drei's suspense-based useGLTF)
 * so a corrupt/placeholder payload can report an actionable error without
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
  const removeEntity = useSceneStore((s) => s.removeEntity);
  const [loaded, setLoaded] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let alive = true;
    let group: THREE.Group | null = null;
    setLoaded(null);
    setLoadError(null);

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
        if (!alive) return;
        const message = error instanceof Error ? error.message : 'Invalid GLB payload';
        setLoadError(message);
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
  }, [entity.glbUrl, retryCount]);

  if (loadError) {
    return (
      <Html position={entity.position}>
        <div
          role="alert"
          className="w-64 rounded-md border border-accent-danger/60 bg-bg-surface p-3 text-xs text-text-primary shadow-lg"
        >
          <p>Unable to load {entity.name}</p>
          <p className="mt-1 text-[11px] text-text-secondary">{loadError}</p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              data-testid={`remove-${entity.id}`}
              onClick={() => removeEntity(entity.id)}
              className="rounded-sm border border-border-subtle px-2 py-1 text-[11px]"
            >
              Remove
            </button>
            <button
              type="button"
              data-testid={`retry-${entity.id}`}
              onClick={() => setRetryCount((count) => count + 1)}
              className="rounded-sm border border-accent-primary/50 px-2 py-1 text-[11px] text-accent-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </Html>
    );
  }

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
