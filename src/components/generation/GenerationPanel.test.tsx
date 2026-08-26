import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { GenerationPanel } from '@/components/generation/GenerationPanel';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useUiStore } from '@/lib/stores/useUiStore';

describe('GenerationPanel', () => {
  beforeEach(() => {
    useGenerationStore.getState().dismiss();
    useUiStore.getState().setPrompt('');
  });

  it('disables Generate Mesh until an image is selected', () => {
    render(<GenerationPanel />);
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
});
