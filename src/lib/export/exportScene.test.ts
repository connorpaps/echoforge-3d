import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildStandaloneHtml,
  collectSceneSnapshot,
  mergeGlbsToGltf,
  type SceneSnapshot,
} from '@/lib/export/exportScene';
import { TERRAIN_SIZE } from '@/lib/terrain/heightmap';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

/** A minimal triangle GLB (POSITION VEC3 + UNSIGNED_SHORT indices). */
function buildTriangleGlb(): string {
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 60 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  // glTF pads the JSON chunk with spaces (0x20) — NULs break JSON.parse.
  const jsonPadded = new Uint8Array(Math.ceil(jsonBytes.length / 4) * 4);
  jsonPadded.fill(0x20);
  jsonPadded.set(jsonBytes);

  const total = 20 + jsonPadded.length + 8 + 60;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  new Uint8Array(buffer, 20, jsonPadded.length).set(jsonPadded);
  const binStart = 20 + jsonPadded.length;
  view.setUint32(binStart, 60, true);
  view.setUint32(binStart + 4, 0x004e4942, true); // 'BIN\0'
  const bin = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2]);
  new Uint8Array(buffer, binStart + 8, 36).set(new Uint8Array(bin.buffer));
  new Uint8Array(buffer, binStart + 44, 6).set(new Uint8Array(indices.buffer));

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const triGlb = buildTriangleGlb();

/** A GLB with NORMAL + COLOR_0 and TWO primitives (TripoSR-shaped). */
function buildColoredGlb(): string {
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 200 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 72, target: 34962 }, // positions
      { buffer: 0, byteOffset: 72, byteLength: 72, target: 34962 }, // normals
      { buffer: 0, byteOffset: 144, byteLength: 48, target: 34962 }, // colors
      { buffer: 0, byteOffset: 192, byteLength: 6, target: 34963 }, // indices
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 6, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 6, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 6, type: 'VEC4' },
      { bufferView: 3, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [
      {
        name: 'ColoredMesh',
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
            indices: 3,
          },
          {
            attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
            indices: 3,
          },
        ],
      },
    ],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(Math.ceil(jsonBytes.length / 4) * 4);
  jsonPadded.fill(0x20);
  jsonPadded.set(jsonBytes);

  const total = 20 + jsonPadded.length + 8 + 200;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20, jsonPadded.length).set(jsonPadded);
  const binStart = 20 + jsonPadded.length;
  view.setUint32(binStart, 200, true);
  view.setUint32(binStart + 4, 0x004e4942, true);
  const bin = new Uint8Array(buffer, binStart + 8, 200);
  bin.fill(0x55); // opaque bytes; accessor count is what matters for the remap
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const coloredGlb = buildColoredGlb();

function meshEntity(overrides: Partial<SceneEntity> = {}): SceneEntity {
  return {
    id: 'm1',
    name: 'Tri',
    type: 'mesh',
    position: [1, 2, 3],
    rotation: [0, Math.PI / 2, 0],
    scale: [2, 2, 2],
    glbUrl: `data:model/gltf-binary;base64,${triGlb}`,
    physics: { colliderType: 'cuboid', mass: 0 },
    ...overrides,
  };
}

describe('collectSceneSnapshot', () => {
  beforeEach(() => {
    useSceneStore.setState({ entities: {}, terrainHeightmap: null });
  });

  it('extracts mesh entities with glb base64 + transforms', () => {
    useSceneStore.getState().addEntity(meshEntity());
    const snapshot = collectSceneSnapshot();
    expect(snapshot.entities).toHaveLength(1);
    expect(snapshot.entities[0].glbBase64).toBe(triGlb);
    expect(snapshot.entities[0].position).toEqual([1, 2, 3]);
  });

  it('serializes the terrain heightmap at the terrain grid size', () => {
    const heightmap = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    useSceneStore.setState({ terrainHeightmap: heightmap });
    const snapshot = collectSceneSnapshot();
    // Float32 precision — compare rounded to 2dp.
    expect(
      snapshot.terrain?.heightmap.map((v) => Math.round(v * 100) / 100),
    ).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(snapshot.terrain?.size).toBe(TERRAIN_SIZE);
  });
});

describe('mergeGlbsToGltf', () => {
  it('merges a GLB into a glTF scene tree with transforms + remapped accessors', () => {
    const snapshot: SceneSnapshot = {
      entities: [
        {
          name: 'Tri',
          type: 'mesh',
          position: [1, 2, 3],
          rotation: [0, Math.PI / 2, 0],
          scale: [2, 2, 2],
          glbBase64: triGlb,
        },
      ],
      terrain: null,
    };
    const { gltf, bin } = mergeGlbsToGltf(snapshot);
    const parsed = JSON.parse(gltf) as {
      scenes: Array<{ nodes: number[] }>;
      nodes: Array<{ translation: number[]; rotation: number[]; mesh: number }>;
      meshes: unknown[];
      accessors: Array<{ bufferView: number }>;
      buffers: Array<{ byteLength: number }>;
    };

    expect(parsed.scenes[0].nodes).toEqual([0]);
    expect(parsed.nodes[0].translation).toEqual([1, 2, 3]);
    expect(parsed.nodes[0].rotation).toHaveLength(4); // quaternion
    expect(parsed.nodes[0].rotation[0]).toBeCloseTo(0, 5);
    expect(parsed.nodes[0].rotation[3]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(parsed.meshes).toHaveLength(1);
    expect(parsed.accessors[0].bufferView).toBe(0);
    expect(parsed.buffers[0].byteLength).toBe(60);
    expect(bin.length).toBe(60);
  });

  it('remaps normals, colors, and every primitive of a multi-primitive GLB', () => {
    const snapshot: SceneSnapshot = {
      entities: [
        {
          name: 'Colored',
          type: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          glbBase64: coloredGlb,
        },
      ],
      terrain: null,
    };
    const { gltf, bin } = mergeGlbsToGltf(snapshot);
    const parsed = JSON.parse(gltf) as {
      meshes: Array<{ primitives: Array<{ attributes: Record<string, number>; indices: number }> }>;
      accessors: Array<{ bufferView: number }>;
      bufferViews: Array<{ buffer: number; byteOffset?: number }>;
    };

    // 4 accessors + 4 bufferViews, all remapped to the merged buffer.
    expect(parsed.accessors).toHaveLength(4);
    expect(parsed.bufferViews).toHaveLength(4);
    expect(parsed.bufferViews[0].buffer).toBe(0);
    expect(parsed.bufferViews[2].byteOffset).toBe(144);
    expect(parsed.meshes[0].primitives).toHaveLength(2);
    expect(parsed.meshes[0].primitives[1].attributes.NORMAL).toBe(1);
    expect(parsed.meshes[0].primitives[0].attributes.COLOR_0).toBe(2);
    expect(parsed.meshes[0].primitives[1].indices).toBe(3);
    expect(bin.length).toBe(200);
  });

  it('skips corrupt GLB payloads without failing the merge', () => {
    const snapshot: SceneSnapshot = {
      entities: [
        {
          name: 'Corrupt',
          type: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          glbBase64: 'AAAA', // decodes to 3 zero bytes → not a GLB
        },
        {
          name: 'Good',
          type: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          glbBase64: triGlb,
        },
      ],
      terrain: null,
    };
    const { gltf } = mergeGlbsToGltf(snapshot);
    const parsed = JSON.parse(gltf) as { nodes: unknown[] };
    // only the valid GLB contributes a node
    expect(parsed.nodes).toHaveLength(1);
  });
});

describe('buildStandaloneHtml', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('embeds three core, the runtime, and the scene snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/vendor/three.core.min.js') {
          return Promise.resolve(new Response('// THREE CORE'));
        }
        if (url === '/exporter/runtime.js') {
          return Promise.resolve(new Response('// RUNTIME'));
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }),
    );

    const html = await buildStandaloneHtml({ entities: [], terrain: null });
    expect(html).toContain('EchoForge 3D — Exported Scene');
    expect(html).toContain('atob("Ly8gVEhSRUUgQ09SRQ==");'); // base64 of mock three
    expect(html).toContain('scene-data');
    expect(html).toContain('// RUNTIME');
    expect(html).not.toContain('</script><script'); // scene JSON escaped
  });
});
