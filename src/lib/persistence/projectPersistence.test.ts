import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneState } from '@/lib/stores/useSceneStore';
import {
  clearStoredProject,
  loadProject,
  saveProject,
  serializeSceneSnapshot,
} from '@/lib/persistence/projectPersistence';

const entity = {
  id: 'npc-1',
  name: 'Archivist',
  type: 'npc' as const,
  position: [1, 2, 3] as [number, number, number],
  rotation: [0.1, 0.2, 0.3] as [number, number, number],
  scale: [2, 2, 2] as [number, number, number],
  glbUrl: 'blob:http://localhost/live-mesh',
  audioUrl: 'blob:http://localhost/live-audio',
  volume: 0.45,
  falloffDistance: 32,
  npcPersona: 'Patient historian',
  npcVoice: 'af_heart',
  physics: { colliderType: 'convexHull' as const, mass: 4 },
};

const state = {
  entities: { [entity.id]: entity },
  selectedEntityId: entity.id,
  activeMode: 'editor' as const,
  isRecordingVoice: false,
  terrainHeightmap: new Float32Array([0, 0.25, 0.5, 1]),
} as SceneState;

describe('project persistence', () => {
  beforeEach(async () => {
    await clearStoredProject();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      blob: async () => new Blob([url.includes('audio') ? 'audio' : 'mesh']),
    })));
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((blob: Blob) => `blob:restored-${blob.size}`),
      revokeObjectURL: vi.fn(),
    });
  });

  it('serializes a versioned snapshot without persisting live blob URLs', async () => {
    const saved = await serializeSceneSnapshot(state);
    expect(saved.snapshot.version).toBe(1);
    expect(saved.snapshot.entities['npc-1']).toMatchObject({
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 2, 2],
      volume: 0.45,
      npcPersona: 'Patient historian',
      npcVoice: 'af_heart',
    });
    expect(JSON.stringify(saved.snapshot)).not.toContain('blob:http://localhost/live');
    expect(saved.snapshot.terrainHeightmap).toEqual([0, 0.25, 0.5, 1]);
    expect(Object.keys(saved.assets)).toEqual(['npc-1:glb', 'npc-1:audio']);
  });

  it('round-trips entities, transforms, audio/NPC fields, terrain, and restores asset URLs', async () => {
    await saveProject(state);
    const loaded = await loadProject();
    expect(loaded).not.toBeNull();
    expect(loaded?.entities['npc-1']).toMatchObject({
      name: 'Archivist',
      type: 'npc',
      position: [1, 2, 3],
      rotation: [0.1, 0.2, 0.3],
      scale: [2, 2, 2],
      volume: 0.45,
      falloffDistance: 32,
      npcPersona: 'Patient historian',
      npcVoice: 'af_heart',
      physics: { colliderType: 'convexHull', mass: 4 },
    });
    expect(loaded?.entities['npc-1'].glbUrl).toMatch(/^blob:restored-/);
    expect(loaded?.entities['npc-1'].audioUrl).toMatch(/^blob:restored-/);
    expect(loaded?.terrainHeightmap).toEqual(new Float32Array([0, 0.25, 0.5, 1]));
  });
});
