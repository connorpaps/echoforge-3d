'use client';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { KeycapBadge } from '@/components/ui/KeycapBadge';
import { SectionLabel } from '@/components/ui/SectionLabel';

/**
 * Left creation drawer (DESIGN.md §5). Task 1.3 replaces the voice-pill
 * stub; Task 1.4 replaces the topo-canvas stub; the scene inspector fills
 * in with the entity store as generation lands (Phase 2+).
 */
export function LeftDrawer() {
  return (
    <aside
      data-testid="left-drawer"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-bg-canvas/60 p-3"
    >
      {/* 2D Topographic Canvas — stub, wired in Task 1.4 */}
      <GlassPanel className="p-3">
        <SectionLabel>2D Topographic Canvas</SectionLabel>
        <div
          data-testid="topo-canvas"
          className="mt-2 aspect-square w-full rounded-sm border border-dashed border-border-subtle bg-bg-subtle"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          Sketch terrain or press <KeycapBadge>M</KeycapBadge> to speak.
        </p>
      </GlassPanel>

      {/* Voice & text prompt input — stub, wired in Task 1.3 */}
      <GlassPanel className="p-3">
        <SectionLabel>Prompt</SectionLabel>
        <div
          data-testid="voice-pill"
          className="mt-2 flex h-10 items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated px-3 text-xs text-text-secondary"
        >
          Hold <KeycapBadge>M</KeycapBadge> to Speak
        </div>
      </GlassPanel>

      {/* Scene entity inspector */}
      <GlassPanel className="flex-1 p-3">
        <SectionLabel>Scene Inspector</SectionLabel>
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          No entities yet. Sketch terrain to begin.
        </p>
      </GlassPanel>
    </aside>
  );
}
