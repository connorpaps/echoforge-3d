import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SceneInspector } from '@/components/workspace/SceneInspector';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

const entity: SceneEntity = {
  id: 'mesh-1',
  name: 'Watchtower',
  type: 'mesh',
  position: [1, 2, 3],
  rotation: [0, 0.5, 0],
  scale: [1, 1, 1],
  physics: { colliderType: 'cuboid', mass: 0 },
};

function resetStore() {
  useSceneStore.setState({
    entities: { [entity.id]: entity },
    selectedEntityId: entity.id,
    activeMode: 'editor',
    isRecordingVoice: false,
    terrainHeightmap: null,
    history: { past: [], future: [] },
  });
}

describe('SceneInspector', () => {
  beforeEach(resetStore);

  it('shows the selected entity and commits numeric transform edits', () => {
    render(<SceneInspector />);

    expect(screen.getByDisplayValue('Watchtower')).toBeInTheDocument();
    const positionX = screen.getByRole('spinbutton', { name: 'Position X' });
    fireEvent.change(positionX, { target: { value: '7' } });

    expect(useSceneStore.getState().entities['mesh-1'].position).toEqual([7, 2, 3]);
    expect(useSceneStore.getState().history.past).toHaveLength(1);
  });

  it('selects, duplicates, deletes, and undoes entity actions', async () => {
    const user = userEvent.setup();
    render(<SceneInspector />);

    await user.click(screen.getByRole('button', { name: 'Duplicate Watchtower' }));
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(2);

    const duplicate = Object.values(useSceneStore.getState().entities).find(
      (item) => item.id !== 'mesh-1',
    );
    expect(duplicate?.name).toBe('Watchtower copy');

    const deleteButtons = screen.getAllByRole('button', {
      name: `Delete ${duplicate?.name}`,
    });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(2);
  });

  it('edits NPC persona and voice fields', () => {
    useSceneStore.setState({
      entities: {
        'npc-1': {
          ...entity,
          id: 'npc-1',
          name: 'Guide',
          type: 'npc',
          npcPersona: 'A patient historian',
          npcVoice: 'af_heart',
        },
      },
      selectedEntityId: 'npc-1',
    });
    render(<SceneInspector />);

    fireEvent.change(screen.getByRole('textbox', { name: 'NPC persona' }), {
      target: { value: 'A terse mountain guide' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'NPC voice ID' }), {
      target: { value: 'am_adam' },
    });

    expect(useSceneStore.getState().entities['npc-1'].npcPersona).toBe(
      'A terse mountain guide',
    );
    expect(useSceneStore.getState().entities['npc-1'].npcVoice).toBe('am_adam');
  });
});
