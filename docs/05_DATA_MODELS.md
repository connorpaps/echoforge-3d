# 05. Data Models, State Trees & IndexedDB Storage

**Product:** EchoForge 3D  
**Specification Version:** 1.2.0 (Audited & Production-Hardened)  
**Governing Skills:** `TheBushidoCollective/han` (`zustand-advanced-patterns`, `zustand-typescript`), `NeverSight/learn-skills.dev` (`idb-state-persistence`)

---

## 1. Zustand 3D Scene Graph Store

The scene graph decouples transient Three.js matrix updates from the React render tree using a flat entity map:

```typescript
// src/lib/stores/useSceneStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface SceneEntity {
  id: string;                    // UUID v4
  name: string;                  // Display label (e.g., "Ancient Stone Pillar")
  type: 'mesh' | 'terrain' | 'audio_emitter' | 'npc';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  glbUrl?: string;               // Blob URL or cached IndexedDB key
  audioUrl?: string;             // Blob URL or cached audio buffer key
  volume?: number;               // 0.0 to 1.0 for audio emitters
  falloffDistance?: number;      // Inverse-square max distance
  physics: {
    colliderType: 'convexHull' | 'trimesh' | 'cuboid' | 'none';
    mass: number;                // 0.0 for static terrain / fixed props
  };
  npcPersona?: string;           // Persona system prompt for SmolVLM
}

export interface SceneState {
  entities: Record<string, SceneEntity>;
  selectedEntityId: string | null;
  activeMode: 'editor' | 'play';
  isRecordingVoice: boolean;
  terrainHeightmap: Float32Array | null;
  history: {
    past: Array<Record<string, SceneEntity>>;
    future: Array<Record<string, SceneEntity>>;
  };

  // Actions
  addEntity: (entity: SceneEntity) => void;
  updateEntityTransform: (id: string, pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]) => void;
  removeEntity: (id: string) => void;
  setMode: (mode: 'editor' | 'play') => void;
  setTerrainHeightmap: (heightmap: Float32Array) => void;
  undo: () => void;
  redo: () => void;
}

export const useSceneStore = create<SceneState>()(
  subscribeWithSelector((set, get) => ({
    entities: {},
    selectedEntityId: null,
    activeMode: 'editor',
    isRecordingVoice: false,
    terrainHeightmap: null,
    history: { past: [], future: [] },

    addEntity: (entity) => set((state) => ({
      entities: { ...state.entities, [entity.id]: entity },
      history: {
        past: [...state.history.past.slice(-50), state.entities],
        future: []
      }
    })),

    updateEntityTransform: (id, position, rotation, scale) => set((state) => {
      const target = state.entities[id];
      if (!target) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...target, position, rotation, scale }
        }
      };
    }),

    removeEntity: (id) => set((state) => {
      const nextEntities = { ...state.entities };
      delete nextEntities[id];
      return {
        entities: nextEntities,
        selectedEntityId: state.selectedEntityId === id ? null : state.selectedEntityId,
        history: {
          past: [...state.history.past.slice(-50), state.entities],
          future: []
        }
      };
    }),

    setMode: (activeMode) => set({ activeMode }),
    setTerrainHeightmap: (terrainHeightmap) => set({ terrainHeightmap }),

    undo: () => set((state) => {
      if (state.history.past.length === 0) return state;
      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      return {
        entities: previous,
        history: {
          past: newPast,
          future: [state.entities, ...state.history.future.slice(0, 50)]
        }
      };
    }),

    redo: () => set((state) => {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);
      return {
        entities: next,
        history: {
          past: [...state.history.past, state.entities],
          future: newFuture
        }
      };
    })
  }))
);
```

---

## 2. Client-Side IndexedDB Storage Protocol (LRU 500MB Limit)

```typescript
// src/lib/stores/assetCache.ts
import { get, set, del } from 'idb-keyval';

const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500 MB LRU Limit

export async function cacheAsset(key: string, buffer: ArrayBuffer): Promise<void> {
  const metadata = { timestamp: Date.now(), size: buffer.byteLength };
  await set(`meta:${key}`, metadata);
  await set(`blob:${key}`, buffer);
}

export async function getCachedAsset(key: string): Promise<ArrayBuffer | null> {
  const data = await get(`blob:${key}`);
  if (data) {
    // Update access timestamp for LRU eviction
    await set(`meta:${key}`, { timestamp: Date.now(), size: data.byteLength });
    return data as ArrayBuffer;
  }
  return null;
}
```
