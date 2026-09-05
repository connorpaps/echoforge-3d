import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopoCanvas } from '@/components/canvas/TopoCanvas';

describe('TopoCanvas', () => {
  beforeEach(() => {
    // TopoCanvas mounts a worker client; jsdom has no native Worker, so use
    // the deterministic mock-seam worker instead.
    process.env.NEXT_PUBLIC_E2E = 'true';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_E2E;
  });

  it('renders the drawing surface and controls', () => {
    render(<TopoCanvas />);
    expect(screen.getByTestId('topo-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('brush-radius')).toBeInTheDocument();
    expect(screen.getByTestId('brush-height')).toBeInTheDocument();
    expect(screen.getByTestId('clear-elevation')).toBeInTheDocument();
    expect(screen.getByTestId('invert-elevation')).toBeInTheDocument();
    expect(screen.getByText('2D Topographic Canvas')).toBeInTheDocument();
  });

  it('shows the AI status chip while the worker loads', () => {
    render(<TopoCanvas />);
    expect(screen.getByText('AI: loading…')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /topographic terrain drawing surface/i })).toHaveAttribute(
      'aria-describedby',
    );
    expect(screen.getByRole('status')).toHaveTextContent(/worker is loading/i);
  });
});
