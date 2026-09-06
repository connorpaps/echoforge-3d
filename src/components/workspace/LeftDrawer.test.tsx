import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LeftDrawer } from '@/components/workspace/LeftDrawer';

describe('LeftDrawer', () => {
  beforeEach(() => {
    // PromptBar mounts a worker client; jsdom has no native Worker, so use
    // the deterministic mock-seam worker instead.
    process.env.NEXT_PUBLIC_E2E = 'true';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
  });

  it('starts in the creation region with the core image-to-3D controls', () => {
    render(<LeftDrawer />);
    expect(screen.getByTestId('editor-rail')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pill')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create a 3d asset/i })).toBeInTheDocument();
  });

  it('switches between creation, scene, and tools without changing the viewport workflow', async () => {
    const user = userEvent.setup();
    render(<LeftDrawer />);

    await user.click(screen.getByRole('button', { name: 'Scene' }));
    expect(screen.getByTestId('scene-tree')).toBeInTheDocument();
    expect(screen.getByText(/no objects in this scene/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByTestId('topo-canvas')).toBeInTheDocument();
    expect(screen.getByText('2D Topographic Canvas')).toBeInTheDocument();
  });
});
