import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptySceneState } from '@/components/viewport/EmptySceneState';

describe('EmptySceneState', () => {
  it('explains the canvas and offers the primary upload action', () => {
    render(<EmptySceneState />);

    expect(screen.getByRole('heading', { name: /create your first 3d asset/i })).toBeInTheDocument();
    expect(screen.getByText(/add a reference, forge a mesh, then stage it here/i)).toBeInTheDocument();
    expect(screen.getByTestId('empty-state-upload')).toHaveAttribute(
      'for',
      'image-upload',
    );
  });
});
