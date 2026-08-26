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
  audioUrl?: string; // Blob URL or cached audio buffer key
  volume?: number; // 0.0 to 1.0 for audio emitters
  falloffDistance?: number; // Inverse-square max distance
  physics: {
    colliderType: 'convexHull' | 'trimesh' | 'cuboid' | 'none';
    mass: number; // 0.0 for static terrain / fixed props
  };
  npcPersona?: string; // Persona system prompt for SmolVLM
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
  updateEntityTransform: (
    id: string,
    pos: [number, number, number],
    rot: [number, number, number],
    scale: [number, number, number],
  ) => void;
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

    updateEntityTransform: (id, position, rotation, scale) =>
      set((state) => {
        const target = state.entities[id];
        if (!target) return state;
        return {
          entities: {
            ...state.entities,
            [id]: { ...target, position, rotation, scale },
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
          history: {
            past: [...state.history.past, state.entities],
            future: newFuture,
          },
        };
      }),
  })),
);
