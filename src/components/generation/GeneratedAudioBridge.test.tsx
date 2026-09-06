import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { GeneratedAudioBridge } from '@/components/generation/GeneratedAudioBridge';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';

describe('GeneratedAudioBridge', () => {
  beforeEach(() => {
    useSceneStore.setState({
      entities: {},
      selectedEntityId: null,
      history: { past: [], future: [] },
    });
    useGenerationStore.setState({
      status: 'idle',
      kind: null,
      result: null,
    });
  });

  it('selects the newly spawned ambient loop for immediate inspector editing', async () => {
    useGenerationStore.setState({
      status: 'success',
      kind: 'audio',
      result: {
        jobId: 'audio-1',
        wavBase64: 'UklGRg==',
        elapsedMs: 10,
        synthetic: true,
      },
    });

    render(<GeneratedAudioBridge />);

    await waitFor(() => {
      expect(useSceneStore.getState().selectedEntityId).toBe('audio-audio-1');
    });
  });
});
