import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { VoicePill } from '@/components/ui/VoicePill';
import { useVoiceStore } from '@/lib/stores/useVoiceStore';

describe('VoicePill', () => {
  beforeEach(() => {
    useVoiceStore.setState({ status: 'idle', transcript: '', error: null });
  });

  it('renders the idle push-to-talk hint', () => {
    render(<VoicePill />);
    const pill = screen.getByTestId('voice-pill');
    expect(pill).toHaveTextContent('Hold');
    expect(pill).toHaveTextContent('M');
  });

  it('shows the recording state with the pulse animation', () => {
    useVoiceStore.setState({ status: 'listening' });
    render(<VoicePill />);
    const pill = screen.getByTestId('voice-pill');
    expect(pill).toHaveTextContent('Recording…');
    expect(pill.className).toContain('voice-pulse');
  });

  it('shows the executed confirmation with the transcript', () => {
    useVoiceStore.setState({
      status: 'executed',
      transcript: 'place a bonfire on the hill',
    });
    render(<VoicePill />);
    expect(screen.getByTestId('voice-pill')).toHaveTextContent(
      'place a bonfire on the hill',
    );
  });

  it('shows the error state', () => {
    useVoiceStore.setState({ status: 'error' });
    render(<VoicePill />);
    expect(screen.getByTestId('voice-pill')).toHaveTextContent('Mic error');
  });
});
