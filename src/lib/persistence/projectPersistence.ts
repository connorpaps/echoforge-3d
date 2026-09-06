import { del, get, set } from 'idb-keyval';
import type { SceneEntity, SceneState } from '@/lib/stores/useSceneStore';

export const PROJECT_VERSION = 1 as const;
const PROJECT_KEY = 'echoforge-project';

type PersistedEntity = Omit<SceneEntity, 'glbUrl' | 'materialUrl' | 'audioUrl'> & {
  glbAssetId?: string;
  materialAssetId?: string;
  audioAssetId?: string;
  glbUrl?: string;
  materialUrl?: string;
  audioUrl?: string;
};

export interface SerializableSceneSnapshot {
  version: typeof PROJECT_VERSION;
  entities: Record<string, PersistedEntity>;
  terrainHeightmap: number[] | null;
}

export interface StoredProject {
  snapshot: SerializableSceneSnapshot;
  assets: Record<string, Blob>;
}

export interface LoadedScene {
  entities: Record<string, SceneEntity>;
  terrainHeightmap: Float32Array | null;
}

const memoryStore: { project: StoredProject | null } = { project: null };

function supportsIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function readProject(): Promise<StoredProject | undefined> {
  if (!supportsIndexedDb()) return memoryStore.project ?? undefined;
  return get<StoredProject>(PROJECT_KEY);
}

async function writeProject(project: StoredProject): Promise<void> {
  if (!supportsIndexedDb()) {
    memoryStore.project = project;
    return;
  }
  await set(PROJECT_KEY, project);
}

async function removeProject(): Promise<void> {
  memoryStore.project = null;
  if (supportsIndexedDb()) await del(PROJECT_KEY);
}

async function assetFromUrl(url: string | undefined): Promise<Blob | undefined> {
  if (!url || (!url.startsWith('blob:') && !url.startsWith('data:'))) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return await response.blob();
  } catch {
    return undefined;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read asset'));
    reader.readAsDataURL(blob);
  });
}

/** Convert live scene state to JSON-safe data and separate local binary assets. */
export async function serializeSceneSnapshot(
  state: Pick<SceneState, 'entities' | 'terrainHeightmap'>,
): Promise<{ snapshot: SerializableSceneSnapshot; assets: Record<string, Blob> }> {
  const assets: Record<string, Blob> = {};
  const entities: Record<string, PersistedEntity> = {};

  await Promise.all(
    Object.values(state.entities).map(async (entity) => {
      const persisted: PersistedEntity = { ...entity };
      delete persisted.glbUrl;
      delete persisted.materialUrl;
      delete persisted.audioUrl;

      const [glb, material, audio] = await Promise.all([
        assetFromUrl(entity.glbUrl),
        assetFromUrl(entity.materialUrl),
        assetFromUrl(entity.audioUrl),
      ]);
      if (glb) {
        const id = `${entity.id}:glb`;
        assets[id] = glb;
        persisted.glbAssetId = id;
      } else if (entity.glbUrl && !entity.glbUrl.startsWith('blob:') && !entity.glbUrl.startsWith('data:')) {
        persisted.glbUrl = entity.glbUrl;
      }
      if (material) {
        const id = `${entity.id}:material`;
        assets[id] = material;
        persisted.materialAssetId = id;
      } else if (entity.materialUrl && !entity.materialUrl.startsWith('blob:') && !entity.materialUrl.startsWith('data:')) {
        persisted.materialUrl = entity.materialUrl;
      }
      if (audio) {
        const id = `${entity.id}:audio`;
        assets[id] = audio;
        persisted.audioAssetId = id;
      } else if (entity.audioUrl && !entity.audioUrl.startsWith('blob:') && !entity.audioUrl.startsWith('data:')) {
        persisted.audioUrl = entity.audioUrl;
      }
      entities[entity.id] = persisted;
    }),
  );

  return {
    snapshot: {
      version: PROJECT_VERSION,
      entities,
      terrainHeightmap: state.terrainHeightmap ? Array.from(state.terrainHeightmap) : null,
    },
    assets,
  };
}

export async function saveProject(
  state: Pick<SceneState, 'entities' | 'terrainHeightmap'>,
): Promise<void> {
  const { snapshot, assets } = await serializeSceneSnapshot(state);
  await writeProject({ snapshot, assets });
}

export async function loadProject(): Promise<LoadedScene | null> {
  const stored = await readProject();
  if (!stored) return null;
  if (stored.snapshot.version !== PROJECT_VERSION) {
    throw new Error(`Unsupported EchoForge project version: ${stored.snapshot.version}`);
  }

  const entities = Object.fromEntries(
    await Promise.all(
      Object.entries(stored.snapshot.entities).map(async ([id, persisted]) => {
        const { glbAssetId, materialAssetId, audioAssetId, ...entity } = persisted;
        const restored: SceneEntity = { ...entity };
        const glb = glbAssetId ? stored.assets[glbAssetId] : undefined;
        const material = materialAssetId ? stored.assets[materialAssetId] : undefined;
        const audio = audioAssetId ? stored.assets[audioAssetId] : undefined;
        if (glb) restored.glbUrl = await blobToDataUrl(glb);
        if (material) restored.materialUrl = await blobToDataUrl(material);
        if (audio) restored.audioUrl = await blobToDataUrl(audio);
        return [id, restored];
      }),
    ),
  );

  return {
    entities,
    terrainHeightmap: stored.snapshot.terrainHeightmap
      ? new Float32Array(stored.snapshot.terrainHeightmap)
      : null,
  };
}

export async function clearStoredProject(): Promise<void> {
  await removeProject();
}
