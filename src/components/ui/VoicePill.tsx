'use client';

import type { ReactNode } from 'react';
import { KeycapBadge } from '@/components/ui/KeycapBadge';
import { useVoiceStore, type VoiceStatus } from '@/lib/stores/useVoiceStore';
import { cn } from '@/lib/utils';

const CONTENT: Record<VoiceStatus, ReactNode> = {
  idle: (
    <>
      Hold <KeycapBadge>M</KeycapBadge> to Speak
    </>
  ),
  listening: (
    <>
      <span className="size-1.5 animate-pulse rounded-full bg-accent-primary" />
      Recording…
    </>
  ),
  transcribing: <>Transcribing…</>,
  executed: <>✓ Executed</>,
  error: <>Mic error — retry</>,
};

const STYLES: Record<VoiceStatus, string> = {
  idle: 'border-border-subtle text-text-secondary',
  listening: 'border-accent-primary text-accent-primary voice-pulse',
  transcribing: 'animate-pulse border-border-subtle text-text-muted',
  executed: 'border-accent-primary/60 text-accent-primary',
  error: 'border-accent-danger/60 text-accent-danger',
};

/** Voice & prompt status pill (docs/02_DESIGN_BRIEF.md §3.2 states). */
export function VoicePill() {
  const status = useVoiceStore((s) => s.status);
  const transcript = useVoiceStore((s) => s.transcript);

  return (
    <div
      data-testid="voice-pill"
      role="status"
      aria-live="polite"
      className={cn(
        'flex h-10 items-center gap-2 rounded-md border bg-bg-elevated px-3 text-xs transition-colors duration-150',
        STYLES[status],
      )}
    >
      {status === 'executed' && transcript ? `✓ ${transcript}` : CONTENT[status]}
    </div>
  );
}
