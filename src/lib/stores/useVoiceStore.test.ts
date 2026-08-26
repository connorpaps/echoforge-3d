import { beforeEach, describe, expect, it } from 'vitest';
import { useVoiceStore } from '@/lib/stores/useVoiceStore';

describe('useVoiceStore', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'idle', transcript: '', error: null });
  });

  it('tracks the full state machine', () => {
    const s = useVoiceStore.getState();
    s.setStatus('listening');
    expect(useVoiceStore.getState().status).toBe('listening');
    s.setStatus('transcribing');
    expect(useVoiceStore.getState().status).toBe('transcribing');
    s.setStatus('executed');
    expect(useVoiceStore.getState().status).toBe('executed');
    s.setStatus('idle');
    expect(useVoiceStore.getState().status).toBe('idle');
  });

  it('stores the transcript and errors', () => {
    useVoiceStore.getState().setTranscript('place a bonfire on the hill');
    expect(useVoiceStore.getState().transcript).toBe(
      'place a bonfire on the hill',
    );

    useVoiceStore.getState().setError('mic denied');
    expect(useVoiceStore.getState().error).toBe('mic denied');
  });

  it('reset returns to the idle state', () => {
    useVoiceStore.getState().setStatus('error');
    useVoiceStore.getState().setTranscript('x');
    useVoiceStore.getState().setError('boom');
    useVoiceStore.getState().reset();
    const s = useVoiceStore.getState();
    expect(s.status).toBe('idle');
    expect(s.transcript).toBe('');
    expect(s.error).toBeNull();
  });
});
