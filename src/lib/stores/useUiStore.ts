import { create } from 'zustand';

interface UiState {
  drawerCollapsed: boolean;
  fps: number;
  frameTimeMs: number;
  /** Rolling P95 frame time over the last ~2s (Task 3.7 profiling). */
  frameTimeP95: number;
  terrainVertexCount: number;
  /** Live count of HRTF emitters playing in the spatial bus (Task 3.2). */
  audioEmitterCount: number;
  /** UnrealBloom/FXAA post-processing toggle (Task 3.5). */
  postFxEnabled: boolean;
  /** Shared natural-language prompt (PromptBar input + generation panel). */
  prompt: string;
  toggleDrawer: () => void;
  setDrawerCollapsed: (collapsed: boolean) => void;
  setTelemetry: (fps: number, frameTimeMs: number) => void;
  setFrameTimeP95: (frameTimeP95: number) => void;
  setTerrainVertexCount: (count: number) => void;
  setAudioEmitterCount: (count: number) => void;
  togglePostFx: () => void;
  setPostFxEnabled: (enabled: boolean) => void;
  setPrompt: (prompt: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerCollapsed: false,
  fps: 0,
  frameTimeMs: 0,
  frameTimeP95: 0,
  terrainVertexCount: 0,
  audioEmitterCount: 0,
  postFxEnabled: true,
  prompt: '',

  toggleDrawer: () => set((s) => ({ drawerCollapsed: !s.drawerCollapsed })),
  setDrawerCollapsed: (drawerCollapsed) => set({ drawerCollapsed }),
  setTelemetry: (fps, frameTimeMs) => set({ fps, frameTimeMs }),
  setFrameTimeP95: (frameTimeP95) => set({ frameTimeP95 }),
  setTerrainVertexCount: (terrainVertexCount) => set({ terrainVertexCount }),
  setAudioEmitterCount: (audioEmitterCount) => set({ audioEmitterCount }),
  togglePostFx: () => set((s) => ({ postFxEnabled: !s.postFxEnabled })),
  setPostFxEnabled: (postFxEnabled) => set({ postFxEnabled }),
  setPrompt: (prompt) => set({ prompt }),
}));
