import { create } from 'zustand';

interface UiState {
  drawerCollapsed: boolean;
  fps: number;
  frameTimeMs: number;
  terrainVertexCount: number;
  /** Shared natural-language prompt (PromptBar input + generation panel). */
  prompt: string;
  toggleDrawer: () => void;
  setDrawerCollapsed: (collapsed: boolean) => void;
  setTelemetry: (fps: number, frameTimeMs: number) => void;
  setTerrainVertexCount: (count: number) => void;
  setPrompt: (prompt: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerCollapsed: false,
  fps: 0,
  frameTimeMs: 0,
  terrainVertexCount: 0,
  prompt: '',

  toggleDrawer: () => set((s) => ({ drawerCollapsed: !s.drawerCollapsed })),
  setDrawerCollapsed: (drawerCollapsed) => set({ drawerCollapsed }),
  setTelemetry: (fps, frameTimeMs) => set({ fps, frameTimeMs }),
  setTerrainVertexCount: (terrainVertexCount) => set({ terrainVertexCount }),
  setPrompt: (prompt) => set({ prompt }),
}));
