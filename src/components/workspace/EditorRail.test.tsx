import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorRail, type EditorTab } from '@/components/workspace/EditorRail';

describe('EditorRail', () => {
  it('exposes the three editor regions and reports tab changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(tab: EditorTab) => void>();
    render(<EditorRail activeTab="create" onChange={onChange} />);

    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Scene' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Scene' }));
    expect(onChange).toHaveBeenCalledWith('scene');
  });
});
