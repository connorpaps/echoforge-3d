import { beforeEach, describe, expect, it } from 'vitest';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

function makeEntity(overrides: Partial<SceneEntity> = {}): SceneEntity {
  return {
    id: '1',
    name: 'Test Pillar',
    type: 'mesh',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    physics: { colliderType: 'cuboid', mass: 0 },
    ...overrides,
  };
}

describe('useSceneStore', () => {
  beforeEach(() => {
    useSceneStore.setState({
      entities: {},
      selectedEntityId: null,
      activeMode: 'editor',
      isRecordingVoice: false,
      terrainHeightmap: null,
      history: { past: [], future: [] },
    });
  });

  it('adds an entity and snapshots history', () => {
    useSceneStore.getState().addEntity(makeEntity());
    const state = useSceneStore.getState();
    expect(Object.keys(state.entities)).toHaveLength(1);
    expect(state.history.past).toHaveLength(1);
  });

  it('updates an entity transform', () => {
    useSceneStore.getState().addEntity(makeEntity());
    useSceneStore
      .getState()
      .updateEntityTransform('1', [1, 2, 3], [0, 0, 0], [2, 2, 2]);
    const entity = useSceneStore.getState().entities['1'];
    expect(entity.position).toEqual([1, 2, 3]);
    expect(entity.scale).toEqual([2, 2, 2]);
  });

  it('removes an entity and clears its selection', () => {
    useSceneStore.getState().addEntity(makeEntity());
    useSceneStore.setState({ selectedEntityId: '1' });
    useSceneStore.getState().removeEntity('1');
    expect(useSceneStore.getState().entities['1']).toBeUndefined();
    expect(useSceneStore.getState().selectedEntityId).toBeNull();
  });

  it('undo / redo round-trips entity changes', () => {
    useSceneStore.getState().addEntity(makeEntity({ id: 'a' }));
    useSceneStore.getState().addEntity(makeEntity({ id: 'b' }));
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(2);

    useSceneStore.getState().undo();
    expect(useSceneStore.getState().entities['b']).toBeUndefined();

    useSceneStore.getState().redo();
    expect(useSceneStore.getState().entities['b']).toBeDefined();
  });

  it('toggles mode and stores the terrain heightmap', () => {
    useSceneStore.getState().setMode('play');
    expect(useSceneStore.getState().activeMode).toBe('play');

    const hm = new Float32Array([0, 1, 2]);
    useSceneStore.getState().setTerrainHeightmap(hm);
    expect(useSceneStore.getState().terrainHeightmap).toBe(hm);
  });

  it('tracks voice recording state', () => {
    useSceneStore.getState().setIsRecordingVoice(true);
    expect(useSceneStore.getState().isRecordingVoice).toBe(true);
  });
});
