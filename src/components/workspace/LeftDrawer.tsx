'use client';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TopoCanvas } from '@/components/canvas/TopoCanvas';
import { PromptBar } from '@/components/workspace/PromptBar';

/**
 * Left creation drawer (DESIGN.md §5). The scene inspector fills in with
 * the entity store as generation lands (Phase 2+).
 */
export function LeftDrawer() {
  return (
    <aside
      data-testid="left-drawer"
      className="flex h-full flex-col gap-3 overflow-y-auto bg-bg-canvas/60 p-3"
    >
      {/* 2D Topographic Canvas (Task 1.4) */}
      <GlassPanel className="p-3">
        <TopoCanvas />
      </GlassPanel>

      {/* Voice & text prompt input (Task 1.3) */}
      <PromptBar />

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
