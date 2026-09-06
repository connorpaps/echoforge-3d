'use client';

import { DEFAULT_PERSONA } from '@/lib/api/npc';
import { cameraRef } from '@/lib/viewport/cameraRef';
import { useSceneStore } from '@/lib/stores/useSceneStore';

const entityGlyph: Record<string, string> = {
  mesh: '◇',
  npc: '◎',
  audio_emitter: '∿',
  terrain: '⌁',
};

export function SceneTree() {
  const entities = useSceneStore((state) => state.entities);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const addEntity = useSceneStore((state) => state.addEntity);
  const entityList = Object.values(entities);

  const addNpc = () => {
    const id = `npc-${Date.now()}`;
    addEntity({
      id,
      name: 'Guide',
      type: 'npc',
      position: [cameraRef.x, cameraRef.y, cameraRef.z],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      npcPersona: DEFAULT_PERSONA,
      npcVoice: 'af_heart',
      physics: { colliderType: 'cuboid', mass: 0 },
    });
    selectEntity(id);
  };

  return (
    <section data-testid="scene-tree" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-4">
        <div>
          <p className="field-kicker">02 / stage</p>
          <h2 className="mt-1 text-base font-medium tracking-[-0.02em] text-text-primary">Scene</h2>
        </div>
        <button
          type="button"
          data-testid="spawn-npc"
          aria-label="Add NPC"
          onClick={addNpc}
          className="border border-border-interactive px-2 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:border-accent-forge hover:text-accent-forge"
        >
          + NPC
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
          <span>Hierarchy</span>
          <span>{entityList.length.toString().padStart(2, '0')}</span>
        </div>
        {entityList.length === 0 ? (
          <div className="border-l border-accent-forge/45 py-2 pl-3 text-[11px] leading-5 text-text-muted">
            No objects in this scene. Forge a reference or add an NPC to begin staging.
          </div>
        ) : (
          <ul className="space-y-1" aria-label="Scene objects">
            {entityList.map((entity) => {
              const active = entity.id === selectedEntityId;
              return (
                <li key={entity.id}>
                  <button
                    type="button"
                    aria-label={`Select ${entity.name}`}
                    aria-pressed={active}
                    onClick={() => selectEntity(entity.id)}
                    className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left text-[11px] transition-colors ${
                      active
                        ? 'border-accent-forge/65 bg-accent-forge/10 text-text-primary'
                        : 'border-transparent text-text-secondary hover:border-border-subtle hover:bg-bg-subtle hover:text-text-primary'
                    }`}
                  >
                    <span className={active ? 'text-accent-forge' : 'text-text-muted'} aria-hidden="true">
                      {entityGlyph[entity.type] ?? '·'}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{entity.name}</span>
                    <span className="font-mono text-[9px] uppercase text-text-muted">{entity.type === 'audio_emitter' ? 'audio' : entity.type}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
