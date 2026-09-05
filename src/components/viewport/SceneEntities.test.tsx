import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.fn();
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load = loadMock;
  },
}));
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { SceneEntities } from '@/components/viewport/SceneEntities';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

const entity: SceneEntity = {
  id: 'mesh-1',
  name: 'Broken mesh',
  type: 'mesh',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  glbUrl: 'data:application/octet-stream;base64,broken',
  physics: { colliderType: 'none', mass: 0 },
};

describe('SceneEntities asset lifecycle', () => {
  beforeEach(() => {
    useSceneStore.setState({ entities: {}, selectedEntityId: null });
    loadMock.mockReset();
    loadMock.mockImplementation((_url, _onLoad, _onProgress, onError) => {
      queueMicrotask(() => onError(new Error('Invalid GLB payload')));
    });
  });

  it('surfaces a failed GLB load with retry and remove controls', async () => {
    useSceneStore.getState().addEntity(entity);
    render(<SceneEntities />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load Broken mesh',
    );
    expect(screen.getByTestId('retry-mesh-1')).toBeInTheDocument();
    expect(screen.getByTestId('remove-mesh-1')).toBeInTheDocument();
  });

  it('retries a failed GLB load and can remove the failed entity', async () => {
    const user = userEvent.setup();
    useSceneStore.getState().addEntity(entity);
    render(<SceneEntities />);
    await screen.findByRole('alert');

    loadMock.mockImplementationOnce((_url, onLoad) => {
      onLoad({ scene: { traverse: vi.fn() } });
    });
    await user.click(screen.getByTestId('retry-mesh-1'));
    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(2));

    useSceneStore.getState().removeEntity(entity.id);
    expect(useSceneStore.getState().entities[entity.id]).toBeUndefined();
  });
});
