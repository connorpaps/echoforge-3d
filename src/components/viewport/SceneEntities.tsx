'use client';

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

export function applyGeneratedTexture(root: THREE.Object3D, texture: THREE.Texture) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) => {
      if (!material) return;
      const texturedMaterial = material as THREE.Material & {
        color?: THREE.Color;
        map?: THREE.Texture | null;
        needsUpdate: boolean;
      };
      texturedMaterial.map = texture;
      texturedMaterial.color?.set(0xffffff);
      texturedMaterial.needsUpdate = true;
    });
  });
}

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
  const selectEntity = useSceneStore((s) => s.selectEntity);
  const selected = useSceneStore((s) => s.selectedEntityId === entity.id);
  const [loaded, setLoaded] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const bounds = useMemo(
    () => (loaded ? new THREE.Box3().setFromObject(loaded) : null),
    [loaded],
  );

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

  useEffect(() => {
    if (!loaded || !entity.materialUrl) return;
    let alive = true;
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(entity.materialUrl, (texture) => {
      if (!alive) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      applyGeneratedTexture(loaded, texture);
    });
    return () => {
      alive = false;
    };
  }, [entity.materialUrl, loaded]);

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

  if (!loaded || !bounds) return null;

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const highlightSize = [
    Math.max(size.x, 0.1) * 1.08,
    Math.max(size.y, 0.1) * 1.08,
    Math.max(size.z, 0.1) * 1.08,
  ] as [number, number, number];

  return (
    <group
      data-testid={`scene-entity-${entity.id}`}
      position={entity.position}
      rotation={entity.rotation}
      scale={entity.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        selectEntity(entity.id);
      }}
    >
      <primitive object={loaded} />
      {selected ? (
        <mesh position={center}>
          <boxGeometry args={highlightSize} />
          <meshBasicMaterial color="#34d399" wireframe transparent opacity={0.8} />
        </mesh>
      ) : null}
    </group>
  );
}
