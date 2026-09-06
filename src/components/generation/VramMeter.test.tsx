import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/generate', () => ({
  fetchHealth: vi.fn(),
}));

import { fetchHealth } from '@/lib/api/generate';
import { VramMeter } from '@/components/generation/VramMeter';

const mockFetchHealth = vi.mocked(fetchHealth);

describe('VramMeter', () => {
  beforeEach(() => {
    mockFetchHealth.mockReset();
  });

  it('shows the selected mesh provider when health reports it', async () => {
    mockFetchHealth.mockResolvedValue({
      status: 'ok',
      vramMB: 1024,
      cuda: {
        available: true,
        deviceName: 'RTX 2070',
        vramTotalMB: 8192,
        vramAllocatedMB: 512,
        vramReservedMB: 1024,
        vramPeakReservedMB: 1024,
      },
      providers: {
        mesh: {
          configured: 'auto',
          selected: 'hunyuan3d-2gp',
          hunyuan: { available: true, mode: 'primary' },
          triposr: { mode: 'fallback' },
        },
      },
    });

    render(<VramMeter />);

    await waitFor(() => expect(screen.getByTestId('mesh-provider')).toHaveTextContent('Hunyuan3D-2GP'));
  });
});
