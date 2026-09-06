'use client';

import { useEffect } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { VoicePill } from '@/components/ui/VoicePill';
import { useSpeechRecognition } from '@/lib/audio/useSpeechRecognition';
import { registerPushToTalk } from '@/lib/hotkeys';
import { useUiStore } from '@/lib/stores/useUiStore';

export function PromptBar() {
  const { begin, finish } = useSpeechRecognition();
  const prompt = useUiStore((s) => s.prompt);
  const setPrompt = useUiStore((s) => s.setPrompt);

  useEffect(() => registerPushToTalk({ begin, finish }), [begin, finish]);

  return (
    <GlassPanel className="editor-region p-3">
      <SectionLabel>Command the field</SectionLabel>
      <div className="mt-2 flex flex-col gap-2">
        <VoicePill />
        <input
          data-testid="prompt-input"
          type="text"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Describe a material, soundscape, or NPC voice…"
          className="h-10 border border-border-subtle bg-bg-elevated px-3 text-xs text-text-primary placeholder:text-text-muted focus:border-border-focus focus:outline-none"
        />
      </div>
    </GlassPanel>
  );
}
