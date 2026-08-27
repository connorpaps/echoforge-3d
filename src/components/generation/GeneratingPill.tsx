'use client';

import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import type { ProgressStage } from '@/lib/api/generate';

const stageLabel: Record<ProgressStage, string> = {
  DIFFUSION: 'Painting texture via SDXL-Turbo',
  RECONSTRUCTION: 'Generating mesh via TripoSR',
  DECIMATION: 'Optimizing mesh',
  AUDIO: 'Synthesizing ambient audio',
  NPC: 'Vision NPC',
  DONE: 'Complete',
  ERROR: 'Error',
};

const fallbackLabel = (kind: 'mesh' | 'texture' | 'audio' | null) => {
  if (kind === 'texture') return 'Painting texture via SDXL-Turbo';
  if (kind === 'audio') return 'Synthesizing ambient audio via AudioGen';
  return 'Generating mesh via TripoSR';
};

/**
 * Non-blocking generating-state HUD pill (docs/02_DESIGN_BRIEF.md §4):
 * animated emerald wireframe shimmer + live stage/percent telemetry.
 * The wrapper is pointer-events-none so the 3D viewport stays navigable.
 */
export function GeneratingPill() {
  const status = useGenerationStore((s) => s.status);
  const kind = useGenerationStore((s) => s.kind);
  const stage = useGenerationStore((s) => s.stage);
  const percent = useGenerationStore((s) => s.percent);
  const message = useGenerationStore((s) => s.message);

  if (status !== 'generating') return null;

  const label = stage ? stageLabel[stage] : fallbackLabel(kind);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center">
      <div
        data-testid="generating-pill"
        role="status"
        aria-live="polite"
        className="emerald-shimmer flex min-w-72 items-center gap-3 rounded-full border border-accent-primary/60 bg-bg-surface px-4 py-2 backdrop-blur-md"
      >
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent-primary" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-text-primary">{label}</span>
          <span className="flex items-center gap-2">
            <span className="relative h-1 w-36 overflow-hidden rounded-full bg-bg-elevated">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-accent-primary transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
              <span className="progress-sweep absolute inset-y-0 w-8 bg-accent-primary/40 blur-[2px]" />
            </span>
            <span className="font-mono text-[10px] tabular-nums text-text-telemetry">
              {percent}%
            </span>
          </span>
        </div>
      </div>
      {message ? (
        <span className="pointer-events-auto absolute top-full mt-1.5 rounded-full bg-bg-elevated/90 px-2.5 py-0.5 text-[10px] text-text-muted">
          {message}
        </span>
      ) : null}
    </div>
  );
}
