import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeftDrawer } from '@/components/workspace/LeftDrawer';

describe('LeftDrawer', () => {
  it('renders the topo canvas, voice pill, and inspector stubs', () => {
    render(<LeftDrawer />);
    expect(screen.getByTestId('topo-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pill')).toBeInTheDocument();
    expect(screen.getByText('Scene Inspector')).toBeInTheDocument();
    expect(screen.getByText('2D Topographic Canvas')).toBeInTheDocument();
  });
});
