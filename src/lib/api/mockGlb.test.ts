import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildDeterministicGlbDataUrl } from '@/lib/api/mockGlb';

function decodeDataUrl(dataUrl: string): ArrayBuffer {
  const encoded = dataUrl.split(',', 2)[1];
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return bytes.buffer;
}

describe('buildDeterministicGlbDataUrl', () => {
  it('returns a parseable glTF 2.0 binary with a cube mesh', async () => {
    const dataUrl = buildDeterministicGlbDataUrl();
    expect(dataUrl).toMatch(/^data:model\/gltf-binary;base64,/);

    const bytes = new Uint8Array(decodeDataUrl(dataUrl));
    const view = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('glTF');
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(bytes.byteLength);

    const jsonLength = view.getUint32(12, true);
    const jsonType = view.getUint32(16, true);
    expect(jsonType).toBe(0x4e4f534a);
    const json = JSON.parse(
      new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)),
    ) as {
      asset: { version: string };
      meshes: Array<{
        primitives: Array<{ attributes: { POSITION: number; NORMAL: number } }>;
      }>;
      accessors: Array<{ count: number }>;
    };

    expect(json.asset.version).toBe('2.0');
    expect(json.meshes[0].primitives[0].attributes.POSITION).toBe(0);
    expect(json.meshes[0].primitives[0].attributes.NORMAL).toBe(1);
    expect(json.accessors[0].count).toBe(8);
  });

  it('loads through the same GLTFLoader used by the viewport', async () => {
    const result = await new Promise<{ scene: { children: Array<{ visible: boolean }> } }>(
      (resolve, reject) => {
        new GLTFLoader().parse(decodeDataUrl(buildDeterministicGlbDataUrl()), '', resolve, reject);
      },
    );

    expect(result.scene.children).toHaveLength(1);
    expect(result.scene.children[0].visible).toBe(true);
  });
});
