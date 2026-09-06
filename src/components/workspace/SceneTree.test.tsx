import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SceneTree } from '@/components/workspace/SceneTree';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

const entity: SceneEntity = {
  id: 'mesh-1',
  name: 'Watchtower',
  type: 'mesh',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  physics: { colliderType: 'cuboid', mass: 0 },
};

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

describe('SceneTree', () => {
  it('explains the empty hierarchy and offers an NPC entry point', () => {
    render(<SceneTree />);

    expect(screen.getByRole('heading', { name: 'Scene' })).toBeInTheDocument();
    expect(screen.getByText(/no objects in this scene/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add NPC' })).toBeInTheDocument();
  });

  it('selects an entity from the hierarchy', async () => {
    const user = userEvent.setup();
    useSceneStore.setState({ entities: { [entity.id]: entity } });
    render(<SceneTree />);

    await user.click(screen.getByRole('button', { name: 'Select Watchtower' }));
    expect(useSceneStore.getState().selectedEntityId).toBe('mesh-1');
  });
});
