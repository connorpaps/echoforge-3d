const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;

/**
 * Small valid GLB used by hermetic browser tests. It is intentionally built
 * without a runtime 3D dependency so the fixture can load in a clean browser.
 */
export function buildDeterministicGlbDataUrl(): string {
  const positions = new Float32Array([
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5,
     0.5,  0.5, -0.5,
    -0.5,  0.5, -0.5,
    -0.5, -0.5,  0.5,
     0.5, -0.5,  0.5,
     0.5,  0.5,  0.5,
    -0.5,  0.5,  0.5,
  ]);
  const colors = new Uint8Array([
    37, 99, 235, 255,
    14, 165, 233, 255,
    16, 185, 129, 255,
    245, 158,  11, 255,
    59, 130, 246, 255,
    6,  182, 212, 255,
    34, 197,  94, 255,
    249, 115,  22, 255,
  ]);
  const normals = new Float32Array([
    -0.577, -0.577, -0.577,
     0.577, -0.577, -0.577,
     0.577,  0.577, -0.577,
    -0.577,  0.577, -0.577,
    -0.577, -0.577,  0.577,
     0.577, -0.577,  0.577,
     0.577,  0.577,  0.577,
    -0.577,  0.577,  0.577,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    4, 0, 3, 4, 3, 7,
  ]);

  const positionBytes = new Uint8Array(positions.buffer);
  const normalBytes = new Uint8Array(normals.buffer);
  const colorOffset = positionBytes.byteLength + normalBytes.byteLength;
  const indexOffset = colorOffset + colors.byteLength;
  const bin = new Uint8Array(indexOffset + indices.byteLength);
  bin.set(positionBytes, 0);
  bin.set(normalBytes, positionBytes.byteLength);
  bin.set(colors, colorOffset);
  bin.set(new Uint8Array(indices.buffer), indexOffset);

  const gltf = {
    asset: { version: '2.0', generator: 'EchoForge deterministic fixture' },
    extensionsUsed: ['KHR_materials_unlit'],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Fixture Cube' }],
    meshes: [{
      name: 'Fixture Cube',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2 },
        indices: 3,
        material: 0,
        mode: 4,
      }],
    }],
    materials: [{
      name: 'Fixture Warm Material',
      extensions: { KHR_materials_unlit: {} },
      pbrMetallicRoughness: {
        baseColorFactor: [0.92, 0.35, 0.08, 1],
        metallicFactor: 0,
        roughnessFactor: 0.72,
      },
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: 'VEC3',
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 8,
        type: 'VEC3',
      },
      {
        bufferView: 2,
        componentType: 5121,
        normalized: true,
        count: 8,
        type: 'VEC4',
      },
      { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positionBytes.byteLength, byteLength: normalBytes.byteLength, target: 34962 },
      { buffer: 0, byteOffset: colorOffset, byteLength: colors.byteLength, target: 34962 },
      { buffer: 0, byteOffset: indexOffset, byteLength: indices.byteLength, target: 34963 },
    ],
    buffers: [{ byteLength: bin.byteLength }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const paddedJson = pad(jsonBytes, 0x20);
  const paddedBin = pad(bin, 0);
  const totalLength = 12 + 8 + paddedJson.byteLength + 8 + paddedBin.byteLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  let offset = 12;
  offset = writeChunk(glb, view, offset, paddedJson, GLB_JSON_CHUNK);
  writeChunk(glb, view, offset, paddedBin, GLB_BIN_CHUNK);

  return `data:model/gltf-binary;base64,${toBase64(glb)}`;
}

function pad(bytes: Uint8Array, fill: number): Uint8Array {
  const paddedLength = Math.ceil(bytes.byteLength / 4) * 4;
  const padded = new Uint8Array(paddedLength).fill(fill);
  padded.set(bytes);
  return padded;
}

function writeChunk(
  target: Uint8Array,
  view: DataView,
  offset: number,
  payload: Uint8Array,
  type: number,
): number {
  view.setUint32(offset, payload.byteLength, true);
  view.setUint32(offset + 4, type, true);
  target.set(payload, offset + 8);
  return offset + 8 + payload.byteLength;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
