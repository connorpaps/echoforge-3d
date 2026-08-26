'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  startRecording,
  type RecordingSession,
} from '@/lib/audio/recorder';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useVoiceStore } from '@/lib/stores/useVoiceStore';
import { useWorker } from '@/lib/workers/useWorker';
import type { TranscriptionResult } from '@/workers/workerTypes';

const EXECUTED_FLASH_MS = 1600;

/**
 * Push-to-talk orchestration: hold the hotkey (M) to record, release to
 * transcribe via the speech worker. In E2E mode both the mic (fake session)
 * and the worker (fixture transcript) are deterministic.
 */
export function useSpeechRecognition() {
  const { request } = useWorker('speech');
  const sessionRef = useRef<RecordingSession | null>(null);
  const executedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useVoiceStore((s) => s.setStatus);
  const setTranscript = useVoiceStore((s) => s.setTranscript);
  const setError = useVoiceStore((s) => s.setError);

  useEffect(() => {
    return () => {
      if (executedTimerRef.current) clearTimeout(executedTimerRef.current);
      sessionRef.current?.cancel();
    };
  }, []);

  const begin = useCallback(async () => {
    if (sessionRef.current) return;
    try {
      setStatus('listening');
      useSceneStore.getState().setIsRecordingVoice(true);
      sessionRef.current = await startRecording();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
      useSceneStore.getState().setIsRecordingVoice(false);
    }
  }, [setError, setStatus]);

  const finish = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;

    try {
      setStatus('transcribing');
      const pcm = await session.stop();
      const result = await request<TranscriptionResult>('TRANSCRIBE', {
        audio: pcm,
        sampleRate: 16000,
      });
      setTranscript(result.text);
      setStatus('executed');
      if (executedTimerRef.current) clearTimeout(executedTimerRef.current);
      executedTimerRef.current = setTimeout(
        () => setStatus('idle'),
        EXECUTED_FLASH_MS,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      useSceneStore.getState().setIsRecordingVoice(false);
    }
  }, [request, setError, setStatus, setTranscript]);

  return { begin, finish };
}
