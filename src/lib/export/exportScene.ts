import * as THREE from 'three';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';
import { TERRAIN_SIZE } from '@/lib/terrain/heightmap';

/**
 * One-click engine export (Task 3.6 / CUJ-04).
 *
 * Two formats:
 *  1. **Standalone HTML** — a single offline file embedding three.core (ESM,
 *     base64) + the runtime (public/exporter/runtime.js) + the scene snapshot.
 *     Opens in any modern browser and renders terrain + entities with a
 *     gentle orbit. No network, no external files.
 *  2. **Godot / Unity (.gltf + .bin)** — all entity GLBs merged into one
 *     glTF-2.0 scene tree with per-node transforms, importable by standard
 *     game engines.
 */

export interface ExportEntity {
  name: string;
  type: SceneEntity['type'];
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  glbBase64?: string;
}

export interface SceneSnapshot {
  entities: ExportEntity[];
  terrain: { heightmap: number[]; size: number } | null;
}

export interface GltfSceneExport {
  /** glTF-2.0 JSON (scene tree with one buffer per source GLB). */
  gltf: string;
  /** Concatenated binary chunk for every merged GLB. */
  bin: Uint8Array;
}

// --- snapshot --------------------------------------------------------------------

export function collectSceneSnapshot(): SceneSnapshot {
  const { entities, terrainHeightmap } = useSceneStore.getState();
  const exportEntities: ExportEntity[] = Object.values(entities)
    .filter((e) => e.type === 'mesh' || e.type === 'npc')
    .map((e) => ({
      name: e.name,
      type: e.type,
      position: e.position,
      rotation: e.rotation,
      scale: e.scale,
      glbBase64: glbDataUrlToBase64(e.glbUrl),
    }));
  return {
    entities: exportEntities,
    terrain: terrainHeightmap
      ? { heightmap: Array.from(terrainHeightmap), size: TERRAIN_SIZE }
      : null,
  };
}

function glbDataUrlToBase64(dataUrl?: string): string | undefined {
  if (!dataUrl) return undefined;
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

// --- standalone HTML ---------------------------------------------------------------

const fetchText = (path: string) =>
  fetch(path).then((response) => {
    if (!response.ok) throw new Error(`Failed to load ${path} (${response.status})`);
    return response.text();
  });

/**
 * Assemble the fully-offline single-file HTML bundle. three.core is embedded
 * as base64 (the minified source contains template literals, so a raw inline
 * would break) and loaded through a blob module import at runtime.
 */
export async function buildStandaloneHtml(snapshot: SceneSnapshot): Promise<string> {
  const [coreSource, runtimeSource] = await Promise.all([
    fetchText('/vendor/three.core.min.js'),
    fetchText('/exporter/runtime.js'),
  ]);
  const coreBase64 = toBase64(coreSource);
  const sceneJson = JSON.stringify(snapshot).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>EchoForge 3D — Exported Scene</title>
<style>
  html, body { margin: 0; height: 100%; background: #08090a; overflow: hidden; }
  canvas { display: block; }
  #hud { position: fixed; left: 12px; bottom: 12px; color: #34d399;
         font: 11px ui-monospace, SFMono-Regular, monospace; opacity: 0.8;
         pointer-events: none; }
</style>
</head>
<body>
<div id="hud">EchoForge 3D · exported scene</div>
<script type="module">
  const __src = atob("${coreBase64}");
  const __blob = URL.createObjectURL(
    new Blob([__src], { type: 'text/javascript' }),
  );
  const THREE = await import(__blob);
  const __sceneData = JSON.parse(
    document.getElementById('scene-data').textContent,
  );
  ${runtimeSource}
</script>
<script id="scene-data" type="application/json">${sceneJson}</script>
</body>
</html>`;
}

// --- glTF scene tree ---------------------------------------------------------------

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
}

interface GltfMesh {
  name?: string;
  primitives: GltfPrimitive[];
}

interface GltfNode {
  name?: string;
  mesh?: number;
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

interface GltfJson {
  asset: { version: string; generator?: string };
  scene: number;
  scenes: Array<{ nodes?: number[] }>;
  nodes: GltfNode[];
  meshes: GltfMesh[];
  bufferViews: GltfBufferView[];
  accessors: GltfAccessor[];
  buffers: Array<{ byteLength: number }>;
  materials: unknown[];
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseGlb(bytes: Uint8Array): { json: GltfJson; bin: Uint8Array } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Invalid GLB (magic)');
  const jsonLen = dv.getUint32(12, true);
  const jsonStart = 20;
  const json = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(bytes.buffer, bytes.byteOffset + jsonStart, jsonLen),
    ),
  ) as GltfJson;
  const chunk2 = jsonStart + jsonLen;
  const binLen = dv.getUint32(chunk2, true);
  const bin = new Uint8Array(bytes.buffer, bytes.byteOffset + chunk2 + 8, binLen);
  return { json, bin };
}

function eulerToQuaternion(euler: [number, number, number]): number[] {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(euler[0], euler[1], euler[2]),
  );
  return [q.x, q.y, q.z, q.w];
}

/**
 * Merge every entity GLB into a single glTF-2.0 document: one buffer per
 * source GLB (concatenated into one .bin), bufferViews/accessors remapped,
 * and a scene node per entity carrying its world transform. Materials are
 * carried over when the source defines them.
 */
export function mergeGlbsToGltf(snapshot: SceneSnapshot): GltfSceneExport {
  const gltf: GltfJson = {
    asset: { version: '2.0', generator: 'EchoForge 3D' },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    bufferViews: [],
    accessors: [],
    buffers: [],
    materials: [],
  };
  const chunks: Uint8Array[] = [];

  for (const entity of snapshot.entities) {
    if (!entity.glbBase64) continue;
    let parts: { json: GltfJson; bin: Uint8Array };
    try {
      parts = parseGlb(base64ToBytes(entity.glbBase64));
    } catch {
      continue; // corrupt payloads degrade to not-exported (like the viewer)
    }

    const bufferIndex = gltf.buffers.length;
    const bufferOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(parts.bin);
    gltf.buffers.push({ byteLength: parts.bin.length });

    const bufferViewOffset = gltf.bufferViews.length;
    for (const bv of parts.json.bufferViews ?? []) {
      gltf.bufferViews.push({
        buffer: bufferIndex,
        byteOffset: (bv.byteOffset ?? 0) + bufferOffset,
        byteLength: bv.byteLength,
      });
    }

    const accessorOffset = gltf.accessors.length;
    for (const acc of parts.json.accessors ?? []) {
      gltf.accessors.push({
        ...acc,
        bufferView:
          acc.bufferView !== undefined
            ? acc.bufferView + bufferViewOffset
            : undefined,
      });
    }

    const meshOffset = gltf.meshes.length;
    for (const meshDef of parts.json.meshes ?? []) {
      const primitives: GltfPrimitive[] = (meshDef.primitives ?? []).map(
        (prim) => {
          const attributes: Record<string, number> = {};
          for (const [semantic, index] of Object.entries(prim.attributes)) {
            attributes[semantic] = index + accessorOffset;
          }
          const next: GltfPrimitive = { attributes };
          if (prim.indices !== undefined) {
            next.indices = prim.indices + accessorOffset;
          }
          const sourceMaterial = parts.json.materials?.[prim.material ?? -1];
          if (sourceMaterial) {
            next.material = gltf.materials.push(sourceMaterial) - 1;
          }
          return next;
        },
      );
      gltf.meshes.push({ name: meshDef.name ?? entity.name, primitives });
    }

    gltf.nodes.push({
      name: entity.name,
      mesh: meshOffset,
      translation: entity.position,
      rotation: eulerToQuaternion(entity.rotation),
      scale: entity.scale,
    });
    gltf.scenes?.[0]?.nodes?.push(gltf.nodes.length - 1);
  }

  const bin = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    bin.set(chunk, offset);
    offset += chunk.length;
  }

  return { gltf: JSON.stringify(gltf), bin };
}

// --- downloads --------------------------------------------------------------------

export function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Kick off a standalone-HTML download for the current scene. */
export async function exportStandaloneHtml(): Promise<void> {
  const html = await buildStandaloneHtml(collectSceneSnapshot());
  downloadText('echoforge-scene.html', html);
}

/** Kick off .gltf + .bin downloads for the current scene (Godot/Unity). */
export function exportGltfScene(): void {
  const { gltf, bin } = mergeGlbsToGltf(collectSceneSnapshot());
  downloadText('echoforge-scene.gltf', gltf);
  downloadBlob(
    'echoforge-scene.bin',
    new Blob([new Uint8Array(bin)], { type: 'application/octet-stream' }),
  );
}

function toBase64(source: string): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < source.length; i += CHUNK) {
    const slice = source.slice(i, i + CHUNK);
    const bytes = new Uint8Array(slice.length);
    for (let k = 0; k < slice.length; k++) bytes[k] = slice.charCodeAt(k);
    binary += String.fromCharCode(...bytes);
  }
  return btoa(binary);
}
