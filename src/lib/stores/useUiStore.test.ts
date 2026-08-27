import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/lib/stores/useUiStore';

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
      drawerCollapsed: false,
      fps: 0,
      frameTimeMs: 0,
      terrainVertexCount: 0,
      audioEmitterCount: 0,
      postFxEnabled: true,
      prompt: '',
    });
  });

  it('toggles the drawer and stores telemetry', () => {
    expect(useUiStore.getState().drawerCollapsed).toBe(false);
    useUiStore.getState().toggleDrawer();
    expect(useUiStore.getState().drawerCollapsed).toBe(true);

    useUiStore.getState().setTelemetry(60, 16.6);
    expect(useUiStore.getState().fps).toBe(60);
    expect(useUiStore.getState().frameTimeMs).toBe(16.6);
  });

  it('records the rolling P95 frame time', () => {
    useUiStore.getState().setFrameTimeP95(18.4);
    expect(useUiStore.getState().frameTimeP95).toBe(18.4);
  });

  it('tracks the spatial audio emitter count', () => {
    useUiStore.getState().setAudioEmitterCount(3);
    expect(useUiStore.getState().audioEmitterCount).toBe(3);
  });

  it('toggles post-processing on and off', () => {
    expect(useUiStore.getState().postFxEnabled).toBe(true);
    useUiStore.getState().togglePostFx();
    expect(useUiStore.getState().postFxEnabled).toBe(false);
    useUiStore.getState().setPostFxEnabled(true);
    expect(useUiStore.getState().postFxEnabled).toBe(true);
  });
});
