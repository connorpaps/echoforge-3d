import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface SceneEntity {
  id: string; // UUID v4
  name: string; // Display label (e.g., "Ancient Stone Pillar")
  type: 'mesh' | 'terrain' | 'audio_emitter' | 'npc';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  glbUrl?: string; // Blob URL or cached IndexedDB key
  materialUrl?: string; // Generated image texture data URL or cached asset URL
  audioUrl?: string; // Blob URL or cached audio buffer key
  volume?: number; // 0.0 to 1.0 for audio emitters
  falloffDistance?: number; // Inverse-square max distance
  physics: {
    colliderType: 'convexHull' | 'trimesh' | 'cuboid' | 'none';
    mass: number; // 0.0 for static terrain / fixed props
  };
  npcPersona?: string; // Persona system prompt for SmolVLM
  npcVoice?: string; // Kokoro-82M voice id (default 'af_heart')
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
  selectEntity: (id: string | null) => void;
  renameEntity: (id: string, name: string) => void;
  duplicateEntity: (id: string, newId?: string) => string | null;
  updateEntityTransform: (
    id: string,
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number],
  ) => void;
  /** Patch any non-id fields (volume/falloff for audio emitters, etc.). */
  updateEntity: (id: string, patch: Partial<Omit<SceneEntity, 'id'>>) => void;
  removeEntity: (id: string) => void;
  setMode: (mode: 'editor' | 'play') => void;
  setIsRecordingVoice: (recording: boolean) => void;
  setTerrainHeightmap: (heightmap: Float32Array | null) => void;
  undo: () => void;
  redo: () => void;
}

export const useSceneStore = create<SceneState>()(
  subscribeWithSelector((set) => ({
    entities: {},
    selectedEntityId: null,
    activeMode: 'editor',
    isRecordingVoice: false,
    terrainHeightmap: null,
    history: { past: [], future: [] },

    addEntity: (entity) =>
      set((state) => ({
        entities: { ...state.entities, [entity.id]: entity },
        history: {
          past: [...state.history.past.slice(-50), state.entities],
          future: [],
        },
      })),

    selectEntity: (id) =>
      set((state) => ({
        selectedEntityId: id && state.entities[id] ? id : null,
      })),

    renameEntity: (id, name) =>
      set((state) => {
        const target = state.entities[id];
        const nextName = name.trim();
        if (!target || nextName.length === 0 || target.name === nextName) {
          return state;
        }
        return {
          entities: {
            ...state.entities,
            [id]: { ...target, name: nextName },
          },
          history: {
            past: [...state.history.past.slice(-50), state.entities],
            future: [],
          },
        };
      }),

    duplicateEntity: (id, requestedId) => {
      let duplicateId: string | null = null;
      set((state) => {
        const target = state.entities[id];
        if (!target) return state;
        const generatedId =
          globalThis.crypto?.randomUUID?.() ?? `${id}-copy-${Date.now()}`;
        const nextId = requestedId ?? generatedId;
        if (state.entities[nextId]) return state;
        duplicateId = nextId;
        const duplicate: SceneEntity = {
          ...target,
          id: nextId,
          name: `${target.name} copy`,
          position: [...target.position],
          rotation: [...target.rotation],
          scale: [...target.scale],
          physics: { ...target.physics },
        };
        return {
          entities: { ...state.entities, [nextId]: duplicate },
          selectedEntityId: nextId,
          history: {
            past: [...state.history.past.slice(-50), state.entities],
            future: [],
          },
        };
      });
      return duplicateId;
    },

    updateEntityTransform: (id, position, rotation, scale) =>
      set((state) => {
        const target = state.entities[id];
        if (!target) return state;
        const unchanged =
          target.position.every((value, index) => value === position[index]) &&
          target.rotation.every((value, index) => value === rotation[index]) &&
          target.scale.every((value, index) => value === scale[index]);
        if (unchanged) return state;
        return {
          entities: {
            ...state.entities,
            [id]: { ...target, position, rotation, scale },
          },
          history: {
            past: [...state.history.past.slice(-50), state.entities],
            future: [],
          },
        };
      }),

    updateEntity: (id, patch) =>
      set((state) => {
        const target = state.entities[id];
        if (!target) return state;
        if (Object.keys(patch).length === 0) return state;
        return {
          entities: {
            ...state.entities,
            [id]: { ...target, ...patch },
          },
          history: {
            past: [...state.history.past.slice(-50), state.entities],
            future: [],
          },
        };
      }),

    removeEntity: (id) =>
      set((state) => {
        const nextEntities = { ...state.entities };
        delete nextEntities[id];
        return {
          entities: nextEntities,
          selectedEntityId:
            state.selectedEntityId === id ? null : state.selectedEntityId,
          history: {
            past: [...state.history.past.slice(-50), state.entities],
            future: [],
          },
        };
      }),

    setMode: (activeMode) => set({ activeMode }),
    setIsRecordingVoice: (isRecordingVoice) => set({ isRecordingVoice }),
    setTerrainHeightmap: (terrainHeightmap) => set({ terrainHeightmap }),

    undo: () =>
      set((state) => {
        if (state.history.past.length === 0) return state;
        const previous = state.history.past[state.history.past.length - 1];
        const newPast = state.history.past.slice(0, -1);
        return {
          entities: previous,
          selectedEntityId:
            state.selectedEntityId && previous[state.selectedEntityId]
              ? state.selectedEntityId
              : null,
          history: {
            past: newPast,
            future: [state.entities, ...state.history.future.slice(0, 50)],
          },
        };
      }),

    redo: () =>
      set((state) => {
        if (state.history.future.length === 0) return state;
        const next = state.history.future[0];
        const newFuture = state.history.future.slice(1);
        return {
          entities: next,
          selectedEntityId:
            state.selectedEntityId && next[state.selectedEntityId]
              ? state.selectedEntityId
              : null,
          history: {
            past: [...state.history.past, state.entities],
            future: newFuture,
          },
        };
      }),
  })),
);
