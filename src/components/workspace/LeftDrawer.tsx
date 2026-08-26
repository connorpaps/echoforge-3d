'use client';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TopoCanvas } from '@/components/canvas/TopoCanvas';
import { GenerationPanel } from '@/components/generation/GenerationPanel';
import { PromptBar } from '@/components/workspace/PromptBar';
import { useSceneStore } from '@/lib/stores/useSceneStore';

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

      {/* Generative asset controls (Task 2.5) */}
      <GenerationPanel />

      {/* Scene entity inspector */}
      <SceneInspector />
    </aside>
  );
}

function SceneInspector() {
  const entities = useSceneStore((s) => s.entities);
  const removeEntity = useSceneStore((s) => s.removeEntity);

  return (
    <GlassPanel className="flex-1 p-3">
      <SectionLabel>Scene Inspector</SectionLabel>
      {Object.keys(entities).length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          No entities yet. Sketch terrain to begin.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {Object.values(entities).map((entity) => (
            <li
              key={entity.id}
              className="flex items-center justify-between rounded-sm border border-border-subtle bg-bg-elevated px-2 py-1.5"
            >
              <span className="text-[11px] text-text-primary">
                {entity.name}
              </span>
              <button
                type="button"
                aria-label={`Remove ${entity.name}`}
                onClick={() => removeEntity(entity.id)}
                className="text-[10px] text-text-muted transition-colors hover:text-accent-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
