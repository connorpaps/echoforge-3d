import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationPanel } from '@/components/generation/GenerationPanel';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useUiStore } from '@/lib/stores/useUiStore';

describe('GenerationPanel', () => {
  beforeEach(() => {
    useGenerationStore.getState().dismiss();
    useUiStore.getState().setPrompt('');
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1;
        naturalHeight = 1;
        onload: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  it('disables Generate Mesh until an image is selected', () => {
    render(<GenerationPanel />);
    expect(screen.getByRole('heading', { name: /create a 3d asset/i })).toBeInTheDocument();
    expect(screen.getByText(/upload a reference image to create a model/i)).toBeInTheDocument();
    expect(screen.getByTestId('generate-mesh')).toBeDisabled();
    expect(screen.getByTestId('generate-texture')).toBeDisabled();
  });

  it('enables Generate Texture once a prompt is typed', async () => {
    useUiStore.getState().setPrompt('ancient castle');
    render(<GenerationPanel />);
    expect(screen.getByTestId('generate-texture')).toBeEnabled();
    expect(screen.getByTestId('generate-mesh')).toBeDisabled();
  });

  it('shows a preview after selecting a file', async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    const file = new File(['png-bytes'], 'concept.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('image-upload'), file);
    expect(await screen.findByTestId('image-preview')).toBeInTheDocument();
    expect(screen.getByTestId('generate-mesh')).toBeEnabled();
  });

  it('keeps upload and clear as separate accessible controls', async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    await user.upload(
      screen.getByTestId('image-upload'),
      new File(['png'], 'concept.png', { type: 'image/png' }),
    );

    const upload = await screen.findByRole('button', { name: /upload reference image/i });
    const clear = screen.getByRole('button', { name: /clear reference image/i });
    expect(upload).toBeInTheDocument();
    expect(clear).toBeInTheDocument();
    expect(upload.contains(clear)).toBe(false);
    expect(screen.getByTestId('image-upload')).toHaveAccessibleName(/reference image/i);
  });

  it.each(['application/pdf', 'image/gif'])(
    'rejects %s uploads with a readable error',
    (type) => {
      render(<GenerationPanel />);
      fireEvent.change(screen.getByTestId('image-upload'), {
        target: { files: [new File(['bytes'], 'reference.bin', { type })] },
      });
      expect(screen.getByRole('alert')).toHaveTextContent(/unsupported file type/i);
      expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
    },
  );

  it('rejects an oversized upload with a readable error', async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    const file = new File(['bytes'], 'large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
    await user.upload(screen.getByTestId('image-upload'), file);
    expect(screen.getByRole('alert')).toHaveTextContent('file is too large');
  });

  it('rejects an image whose dimensions exceed the limit', async () => {
    const user = userEvent.setup();
    const OriginalImage = globalThis.Image;
    class OversizedImage {
      naturalWidth = 8193;
      naturalHeight = 512;
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = OversizedImage as unknown as typeof Image;
    try {
      render(<GenerationPanel />);
      await user.upload(
        screen.getByTestId('image-upload'),
        new File(['png'], 'wide.png', { type: 'image/png' }),
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'dimensions are too large',
      );
      expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
    } finally {
      globalThis.Image = OriginalImage;
    }
  });

  it('clears the selected image from the keyboard', async () => {
    const user = userEvent.setup();
    render(<GenerationPanel />);
    await user.upload(
      screen.getByTestId('image-upload'),
      new File(['png'], 'concept.png', { type: 'image/png' }),
    );
    const clear = await screen.findByTestId('clear-image');
    clear.focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
  });
});
