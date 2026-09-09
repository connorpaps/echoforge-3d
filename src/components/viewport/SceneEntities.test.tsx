import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.fn();
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load = loadMock;
  },
}));
vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import {
  applyGeneratedTexture,
  prepareLoadedMesh,
  SceneEntities,
} from '@/components/viewport/SceneEntities';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

const entity: SceneEntity = {
  id: 'mesh-1',
  name: 'Broken mesh',
  type: 'mesh',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  glbUrl: '/broken.glb',
  physics: { colliderType: 'none', mass: 0 },
};

describe('SceneEntities asset lifecycle', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useSceneStore.setState({ entities: {}, selectedEntityId: null });
    loadMock.mockReset();
    loadMock.mockImplementation((_url, _onLoad, _onProgress, onError) => {
      onError(new Error('Invalid GLB payload'));
    });
    const originalConsoleError = console.error.bind(console);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      const message = String(args[0]);
      if (
        message.startsWith('The tag <') ||
        message.startsWith('<') ||
        message.startsWith('Received `true`')
      ) return;
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('surfaces a failed GLB load with retry and remove controls', async () => {
    useSceneStore.getState().addEntity(entity);
    render(<SceneEntities />);
    await act(async () => {
      await Promise.resolve();
    });

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
    await act(async () => {
      await Promise.resolve();
    });
    await screen.findByRole('alert');

    loadMock.mockImplementationOnce((_url, onLoad) => {
      onLoad({ scene: new THREE.Group() });
    });
    await act(async () => {
      await user.click(screen.getByTestId('retry-mesh-1'));
    });
    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(2));

    useSceneStore.getState().removeEntity(entity.id);
    expect(useSceneStore.getState().entities[entity.id]).toBeUndefined();
  });

  it('selects a loaded entity when the mesh is clicked', async () => {
    loadMock.mockImplementationOnce((_url, onLoad) => {
      onLoad({ scene: new THREE.Group() });
    });
    useSceneStore.getState().addEntity({ ...entity, name: 'Loaded mesh' });
    render(<SceneEntities />);

    const renderedEntity = await screen.findByTestId('scene-entity-mesh-1');
    fireEvent.pointerDown(renderedEntity);

    expect(useSceneStore.getState().selectedEntityId).toBe('mesh-1');
  });

  it('applies a generated texture to every mesh material in an object', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x555555 });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
    const texture = new THREE.Texture();

    applyGeneratedTexture(root, texture);

    expect(material.map).toBe(texture);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.version).toBeGreaterThan(0);
  });

  it('normalizes imported materials for the TSL renderer path', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(geometry.attributes.position.count * 3, 3));
    const material = new THREE.MeshBasicMaterial({ color: 0x336699 });
    const mesh = new THREE.Mesh(geometry, material);
    root.add(mesh);

    prepareLoadedMesh(root);

    expect(mesh.material).not.toBe(material);
    expect((mesh.material as unknown as THREE.MeshStandardMaterial).vertexColors).toBe(true);
  });

  it('preserves important imported material properties during normalization', () => {
    const root = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      alphaTest: 0.35,
      color: 0x336699,
      metalness: 0.6,
      opacity: 0.5,
      roughness: 0.25,
      side: THREE.BackSide,
      transparent: true,
    });
    material.normalMap = new THREE.Texture();
    material.emissive.set(0x221100);
    material.emissiveMap = new THREE.Texture();
    material.aoMap = new THREE.Texture();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));

    prepareLoadedMesh(root);

    const normalized = root.children[0] as THREE.Mesh;
    const normalizedMaterial = normalized.material as unknown as THREE.MeshStandardMaterial;
    expect(normalizedMaterial.transparent).toBe(true);
    expect(normalizedMaterial.opacity).toBe(0.5);
    expect(normalizedMaterial.alphaTest).toBe(0.35);
    expect(normalizedMaterial.side).toBe(THREE.BackSide);
    expect(normalizedMaterial.normalMap).toBe(material.normalMap);
    expect(normalizedMaterial.emissiveMap).toBe(material.emissiveMap);
    expect(normalizedMaterial.aoMap).toBe(material.aoMap);
    expect(normalizedMaterial.emissive.getHex()).toBe(0x221100);
  });
});
