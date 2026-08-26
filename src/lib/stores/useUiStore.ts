import { create } from 'zustand';

interface UiState {
  drawerCollapsed: boolean;
  fps: number;
  frameTimeMs: number;
  terrainVertexCount: number;
  toggleDrawer: () => void;
  setDrawerCollapsed: (collapsed: boolean) => void;
  setTelemetry: (fps: number, frameTimeMs: number) => void;
  setTerrainVertexCount: (count: number) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerCollapsed: false,
  fps: 0,
  frameTimeMs: 0,
  terrainVertexCount: 0,

  toggleDrawer: () => set((s) => ({ drawerCollapsed: !s.drawerCollapsed })),
  setDrawerCollapsed: (drawerCollapsed) => set({ drawerCollapsed }),
  setTelemetry: (fps, frameTimeMs) => set({ fps, frameTimeMs }),
  setTerrainVertexCount: (terrainVertexCount) => set({ terrainVertexCount }),
}));
