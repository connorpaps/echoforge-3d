import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/generate', () => ({
  fetchHealth: vi.fn(),
}));

import { fetchHealth } from '@/lib/api/generate';
import { ProviderStatusPanel } from '@/components/workspace/ProviderStatusPanel';

const mockFetchHealth = vi.mocked(fetchHealth);

const health = {
  status: 'ok',
  vramMB: 0,
  cuda: {
    available: true,
    deviceName: 'RTX 2070',
    vramTotalMB: 8192,
    vramAllocatedMB: 0,
    vramReservedMB: 0,
    vramPeakReservedMB: 0,
  },
  providers: {
    mesh: {
      configured: 'auto' as const,
      selected: 'triposr',
      hunyuan: { available: false, mode: 'primary' },
      triposr: { mode: 'fallback' },
    },
    texture: { provider: 'sdxl-turbo', mode: 'optional' },
    audio: { provider: 'audiogen', fallback: 'procedural', mode: 'optional' },
    dialogue: { provider: 'smolvlm', fallback: 'canned', mode: 'optional' },
    speech: { provider: 'whisper-small.en', mode: 'browser-worker' },
    tts: { provider: 'kokoro', mode: 'browser-worker' },
    depth: { provider: 'depth-anything-v2-small', mode: 'browser-worker' },
  },
};

describe('ProviderStatusPanel', () => {
  beforeEach(() => {
    mockFetchHealth.mockReset();
  });

  it('shows every core provider with honest availability and fallback labels', async () => {
    mockFetchHealth.mockResolvedValue(health);

    render(<ProviderStatusPanel />);

    await waitFor(() => expect(screen.getByTestId('provider-status-panel')).toBeInTheDocument());
    expect(screen.getByText('Hunyuan3D-2GP')).toBeInTheDocument();
    expect(screen.getByText('TripoSR')).toBeInTheDocument();
    expect(screen.getByText('Active fallback')).toBeInTheDocument();
    expect(screen.getByText('SDXL-Turbo')).toBeInTheDocument();
    expect(screen.getByText('Fallback: procedural')).toBeInTheDocument();
    expect(screen.getByText('Fallback: canned')).toBeInTheDocument();
    expect(screen.getByText('Whisper')).toBeInTheDocument();
    expect(screen.getByText('Kokoro')).toBeInTheDocument();
    expect(screen.getByText('Depth Anything V2')).toBeInTheDocument();
  });
});
