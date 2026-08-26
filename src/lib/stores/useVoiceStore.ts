import { create } from 'zustand';

export type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'executed'
  | 'error';

interface VoiceState {
  status: VoiceStatus;
  transcript: string;
  error: string | null;
  setStatus: (status: VoiceStatus) => void;
  setTranscript: (transcript: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>()((set) => ({
  status: 'idle',
  transcript: '',
  error: null,

  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  setError: (error) => set({ error }),
  reset: () => set({ status: 'idle', transcript: '', error: null }),
}));
