import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResultToast } from '@/components/generation/ResultToast';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';

describe('ResultToast', () => {
  beforeEach(() => {
    useGenerationStore.getState().dismiss();
    useSceneStore.setState({ entities: {}, selectedEntityId: null });
  });

  it('renders nothing while idle', () => {
    const { container } = render(<ResultToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the error toast with dismiss + retry', () => {
    useGenerationStore.setState({
      status: 'error',
      errorMessage: 'GPU queue saturated — retry in 3s',
    });
    render(<ResultToast />);
    expect(screen.getByTestId('error-toast')).toBeInTheDocument();
    expect(screen.getByText(/GPU queue saturated/)).toBeInTheDocument();
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('renders the mesh success toast with stats', () => {
    useGenerationStore.setState({
      status: 'success',
      kind: 'mesh',
      result: {
        jobId: 'j1',
        glbUrl: 'data:x',
        bounds: { min: [0, 0, 0], max: [1, 1, 1], center: [0, 0, 0], size: [1, 1, 1] },
        faceCount: 18763,
        vertexCount: 9412,
        glbSizeBytes: 100,
        elapsedMs: 2874,
      },
    });
    render(<ResultToast />);
    expect(screen.getByTestId('success-toast')).toBeInTheDocument();
    expect(screen.getByText('Mesh ready')).toBeInTheDocument();
    expect(screen.getByText(/18,763 faces/)).toBeInTheDocument();
  });

  it('renders the texture success toast with a preview', () => {
    useGenerationStore.setState({
      status: 'success',
      kind: 'texture',
      result: {
        jobId: 'j2',
        imageBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        seed: 42,
        elapsedMs: 1100,
      },
    });
    render(<ResultToast />);
    expect(screen.getByText('Texture ready')).toBeInTheDocument();
    expect(screen.getByTestId('texture-thumb')).toBeInTheDocument();
  });

  it('offers applying a generated texture to its captured scene target', () => {
    useSceneStore.setState({
      entities: {
        'mesh-1': {
          id: 'mesh-1',
          name: 'Tower',
          type: 'mesh',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          physics: { colliderType: 'none', mass: 0 },
        },
      },
    });
    useGenerationStore.setState({
      status: 'success',
      kind: 'texture',
      textureTargetId: 'mesh-1',
      textureApplied: false,
      result: { jobId: 'j2', imageBase64: 'AAA=', seed: 42, elapsedMs: 10 },
    });
    render(<ResultToast />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to selected object' }));
    expect(useSceneStore.getState().entities['mesh-1'].materialUrl).toBe(
      'data:image/png;base64,AAA=',
    );
  });

  it('dismiss returns the store to idle', () => {
    useGenerationStore.setState({ status: 'error', errorMessage: 'x' });
    render(<ResultToast />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(useGenerationStore.getState().status).toBe('idle');
  });

  it('retry invokes the store retry action', async () => {
    const spy = vi.spyOn(useGenerationStore.getState(), 'retry').mockResolvedValue();
    useGenerationStore.setState({ status: 'error', errorMessage: 'x' });
    render(<ResultToast />);
    fireEvent.click(screen.getByTestId('retry-button'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
