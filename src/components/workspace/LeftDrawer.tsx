'use client';

import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TopoCanvas } from '@/components/canvas/TopoCanvas';
import { GenerationPanel } from '@/components/generation/GenerationPanel';
import { PromptBar } from '@/components/workspace/PromptBar';
import { DEFAULT_PERSONA } from '@/lib/api/npc';
import {
  useSceneStore,
  type SceneEntity,
} from '@/lib/stores/useSceneStore';
import { cameraRef } from '@/lib/viewport/cameraRef';

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
  const updateEntity = useSceneStore((s) => s.updateEntity);

  const spawnNpc = () => {
    useSceneStore.getState().addEntity({
      id: `npc-${Date.now()}`,
      name: 'Guide',
      type: 'npc',
      position: [cameraRef.x, cameraRef.y, cameraRef.z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      npcPersona: DEFAULT_PERSONA,
      npcVoice: 'af_heart',
      physics: { colliderType: 'cuboid', mass: 0 },
    });
  };

  return (
    <GlassPanel className="flex-1 p-3" data-testid="scene-inspector">
      <div className="flex items-center justify-between">
        <SectionLabel>Scene Inspector</SectionLabel>
        <button
          type="button"
          data-testid="spawn-npc"
          onClick={spawnNpc}
          className="rounded-sm border border-accent-secondary/40 px-2 py-0.5 text-[10px] font-medium text-accent-secondary transition-all duration-150 hover:border-accent-secondary active:scale-[0.98]"
        >
          + NPC
        </button>
      </div>
      {Object.keys(entities).length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          No entities yet. Sketch terrain to begin, upload an image or generate
          an asset, then press Tab for play mode.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {Object.values(entities).map((entity) => (
            <li
              key={entity.id}
              className="rounded-sm border border-border-subtle bg-bg-elevated px-2 py-1.5"
            >
              <div className="flex items-center justify-between">
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
              </div>
              {entity.type === 'audio_emitter' && (
                <AudioEmitterControls entity={entity} updateEntity={updateEntity} />
              )}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

function AudioEmitterControls({
  entity,
  updateEntity,
}: {
  entity: SceneEntity;
  updateEntity: (id: string, patch: Partial<Omit<SceneEntity, 'id'>>) => void;
}) {
  const volume = entity.volume ?? 0.8;
  const falloff = entity.falloffDistance ?? 15;
  return (
    <div className="mt-1.5 space-y-1">
      <label className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        <span>Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) =>
            updateEntity(entity.id, { volume: Number(e.target.value) })
          }
          className="h-1 w-24 accent-accent-primary"
        />
        <span className="w-9 text-right font-mono text-text-telemetry">
          {volume.toFixed(2)}
        </span>
      </label>
      <label className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        <span>Falloff</span>
        <input
          type="range"
          min={5}
          max={50}
          step={1}
          value={falloff}
          onChange={(e) =>
            updateEntity(entity.id, { falloffDistance: Number(e.target.value) })
          }
          className="h-1 w-24 accent-accent-cyan"
        />
        <span className="w-9 text-right font-mono text-text-telemetry">
          {falloff}m
        </span>
      </label>
    </div>
  );
}
