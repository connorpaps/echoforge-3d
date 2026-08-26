import { render, screen } from '@testing-library/react';
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

  it('renders the topo canvas, voice pill, and inspector stubs', () => {
    render(<LeftDrawer />);
    expect(screen.getByTestId('topo-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pill')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
    expect(screen.getByText('Scene Inspector')).toBeInTheDocument();
    expect(screen.getByText('2D Topographic Canvas')).toBeInTheDocument();
  });
});
