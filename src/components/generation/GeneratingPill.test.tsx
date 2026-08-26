import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GeneratingPill } from '@/components/generation/GeneratingPill';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';

describe('GeneratingPill', () => {
  beforeEach(() => {
    useGenerationStore.getState().dismiss();
  });

  it('renders nothing while idle', () => {
    const { container } = render(<GeneratingPill />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the TripoSR label and percent during mesh generation', () => {
    useGenerationStore.setState({
      status: 'generating',
      kind: 'mesh',
      stage: 'RECONSTRUCTION',
      percent: 45,
      message: 'sampling density field',
    });
    render(<GeneratingPill />);
    expect(screen.getByTestId('generating-pill')).toBeInTheDocument();
    expect(screen.getByText('Generating mesh via TripoSR')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('sampling density field')).toBeInTheDocument();
  });

  it('shows the SDXL-Turbo label during texture generation', () => {
    useGenerationStore.setState({
      status: 'generating',
      kind: 'texture',
      stage: 'DIFFUSION',
      percent: 15,
      message: 'model loaded',
    });
    render(<GeneratingPill />);
    expect(screen.getByText('Painting texture via SDXL-Turbo')).toBeInTheDocument();
  });
});
