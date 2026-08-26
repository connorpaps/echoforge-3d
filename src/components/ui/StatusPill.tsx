import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'ok' | 'idle' | 'recording' | 'danger';

const toneStyles: Record<StatusTone, string> = {
  ok: 'border-accent-primary/40 text-accent-primary',
  idle: 'border-border-subtle text-text-secondary',
  recording: 'border-accent-primary text-accent-primary voice-pulse',
  danger: 'border-accent-danger/40 text-accent-danger',
};

export function StatusPill({
  tone = 'idle',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-bg-elevated px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider',
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
