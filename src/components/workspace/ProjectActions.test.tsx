import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectActions } from '@/components/workspace/ProjectActions';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { loadProject, saveProject } from '@/lib/persistence/projectPersistence';

vi.mock('@/lib/persistence/projectPersistence', () => ({
  loadProject: vi.fn(),
  saveProject: vi.fn(),
}));

describe('ProjectActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSceneStore.setState({
      entities: { one: { id: 'one', name: 'One', type: 'mesh', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], physics: { colliderType: 'none', mass: 0 } } },
      selectedEntityId: 'one',
      terrainHeightmap: new Float32Array([1]),
      history: { past: [{ one: {} as never }], future: [{ one: {} as never }] },
    });
  });

  it('exposes accessible save, load, and new project actions with success feedback', async () => {
    vi.mocked(saveProject).mockResolvedValue(undefined);
    render(<ProjectActions />);
    expect(screen.getByRole('button', { name: 'Save Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Project' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Project saved'));
    expect(saveProject).toHaveBeenCalled();
  });

  it('loads the scene and clears undo history, while New Project clears all state', async () => {
    vi.mocked(loadProject).mockResolvedValue({ entities: {}, terrainHeightmap: null });
    render(<ProjectActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Project' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Project loaded'));
    expect(useSceneStore.getState().history).toEqual({ past: [], future: [] });

    fireEvent.click(screen.getByRole('button', { name: 'New Project' }));
    expect(useSceneStore.getState().entities).toEqual({});
    expect(useSceneStore.getState().terrainHeightmap).toBeNull();
    expect(useSceneStore.getState().history).toEqual({ past: [], future: [] });
  });
});
