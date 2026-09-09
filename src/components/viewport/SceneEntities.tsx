'use client';

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshStandardNodeMaterial } from 'three/webgpu';
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

    const loader = new GLTFLoader();
    const handleLoad = (gltf: { scene: THREE.Group }) => {
      if (!alive) return;
      group = gltf.scene;
      try {
        prepareLoadedMesh(gltf.scene);
        setLoaded(gltf.scene);
      } catch (error) {
        handleError(error);
      }
    };
    const handleError = (error: unknown) => {
      if (!alive) return;
      const message = error instanceof Error ? error.message : 'Invalid GLB payload';
      setLoadError(message);
    };

    if (entity.glbUrl.startsWith('data:')) {
      try {
        loader.parse(decodeBase64DataUrl(entity.glbUrl), '', handleLoad, handleError);
      } catch (error) {
        handleError(error);
      }
    } else {
      loader.load(entity.glbUrl, handleLoad, undefined, handleError);
    }

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
        <>
          <mesh position={center}>
            <boxGeometry args={highlightSize} />
            <meshBasicMaterial color="#34d399" wireframe transparent opacity={0.8} />
          </mesh>
          <Html position={center} center pointerEvents="none">
            <span
              data-testid={`loaded-mesh-${entity.id}`}
              className="rounded-sm border border-accent-forge/70 bg-bg-surface/90 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-accent-forge shadow-sm"
            >
              {entity.name} · GLB loaded
            </span>
          </Html>
        </>
      ) : null}
    </group>
  );
}

function decodeBase64DataUrl(dataUrl: string): ArrayBuffer {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

/** Keep imported GLBs compatible with the project's WebGL/WebGPU TSL path. */
export function prepareLoadedMesh(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nodeMaterials = materials.map((material) => {
      const source = material as THREE.Material & Record<string, unknown>;
      const nodeMaterial = new MeshStandardNodeMaterial({
        color: source.color instanceof THREE.Color ? source.color.clone() : new THREE.Color(0xc8643f),
        map: source.map instanceof THREE.Texture ? source.map : null,
        metalness: typeof source.metalness === 'number' ? source.metalness : 0,
        roughness: typeof source.roughness === 'number' ? source.roughness : 0.72,
      });
      preserveMaterialProperties(source, nodeMaterial);
      nodeMaterial.vertexColors = Boolean(mesh.geometry.getAttribute('color'));
      nodeMaterial.needsUpdate = true;
      material.dispose();
      return nodeMaterial;
    });
    mesh.material = Array.isArray(mesh.material) ? nodeMaterials : nodeMaterials[0];
  });
}

const MATERIAL_PROPERTIES_TO_PRESERVE = [
  'transparent',
  'opacity',
  'alphaTest',
  'side',
  'depthTest',
  'depthWrite',
  'colorWrite',
  'dithering',
  'toneMapped',
  'polygonOffset',
  'polygonOffsetFactor',
  'polygonOffsetUnits',
  'normalMap',
  'normalScale',
  'bumpMap',
  'bumpScale',
  'displacementMap',
  'displacementScale',
  'displacementBias',
  'aoMap',
  'aoMapIntensity',
  'roughnessMap',
  'metalnessMap',
  'emissive',
  'emissiveMap',
  'emissiveIntensity',
  'alphaMap',
  'clearcoat',
  'clearcoatMap',
  'clearcoatRoughness',
  'clearcoatRoughnessMap',
  'clearcoatNormalMap',
  'clearcoatNormalScale',
  'transmission',
  'transmissionMap',
  'thickness',
  'thicknessMap',
  'ior',
  'attenuationDistance',
  'attenuationColor',
] as const;

function preserveMaterialProperties(
  source: THREE.Material & Record<string, unknown>,
  target: THREE.Material,
): void {
  const targetValues = target as unknown as Record<string, unknown>;
  for (const key of MATERIAL_PROPERTIES_TO_PRESERVE) {
    const value = source[key];
    if (value === undefined || !(key in targetValues)) continue;
    targetValues[key] =
      value instanceof THREE.Color ||
      value instanceof THREE.Vector2 ||
      value instanceof THREE.Vector3 ||
      value instanceof THREE.Vector4
        ? value.clone()
        : value;
  }
}
