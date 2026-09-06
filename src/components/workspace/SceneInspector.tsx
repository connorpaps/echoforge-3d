'use client';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { DEFAULT_PERSONA } from '@/lib/api/npc';
import { cameraRef } from '@/lib/viewport/cameraRef';
import { useSceneStore, type SceneEntity } from '@/lib/stores/useSceneStore';

const AXES = ['X', 'Y', 'Z'] as const;
type TransformField = 'position' | 'rotation' | 'scale';

type TransformTuple = [number, number, number];

export function SceneInspector() {
  const entities = useSceneStore((state) => state.entities);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectedEntity = selectedEntityId ? entities[selectedEntityId] : undefined;
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const removeEntity = useSceneStore((state) => state.removeEntity);
  const renameEntity = useSceneStore((state) => state.renameEntity);
  const duplicateEntity = useSceneStore((state) => state.duplicateEntity);
  const undo = useSceneStore((state) => state.undo);
  const redo = useSceneStore((state) => state.redo);
  const updateEntityTransform = useSceneStore((state) => state.updateEntityTransform);
  const updateEntity = useSceneStore((state) => state.updateEntity);
  const canUndo = useSceneStore((state) => state.history.past.length > 0);
  const canRedo = useSceneStore((state) => state.history.future.length > 0);

  const spawnNpc = () => {
    const id = `npc-${Date.now()}`;
    useSceneStore.getState().addEntity({
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

  const updateTransform = (field: TransformField, index: number, value: number) => {
    if (!selectedEntity || !Number.isFinite(value)) return;
    const next = [...selectedEntity[field]] as TransformTuple;
    next[index] = value;
    updateEntityTransform(
      selectedEntity.id,
      field === 'position' ? next : selectedEntity.position,
      field === 'rotation' ? next : selectedEntity.rotation,
      field === 'scale' ? next : selectedEntity.scale,
    );
  };

  return (
    <section className="context-inspector h-full overflow-y-auto p-4" data-testid="scene-inspector" aria-label="Object inspector">
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

      {Object.values(entities).length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
          No objects yet. Generate a model to start editing, then select an object
          to edit its transform.
        </p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Entities</span>
            <span className="font-mono text-[10px] text-text-telemetry">
              {Object.values(entities).length}
            </span>
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {Object.values(entities).map((entity) => (
              <li key={entity.id}>
                <div
                  className={`flex items-center gap-1 rounded-sm border px-2 py-1.5 ${
                    entity.id === selectedEntityId
                      ? 'border-accent-primary/60 bg-accent-primary/10'
                      : 'border-border-subtle bg-bg-elevated'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={entity.id === selectedEntityId}
                    aria-label={`Select ${entity.name}`}
                    onClick={() => selectEntity(entity.id)}
                    className="min-w-0 flex-1 truncate text-left text-[11px] text-text-primary"
                  >
                    {entity.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${entity.name}`}
                    onClick={() => removeEntity(entity.id)}
                    className="text-[10px] text-text-muted transition-colors hover:text-accent-danger"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedEntity ? (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <label className="block text-[10px] uppercase tracking-wider text-text-muted" htmlFor="entity-name">
            Name
          </label>
          <input
            id="entity-name"
            aria-label="Entity name"
            value={selectedEntity.name}
            onChange={(event) => renameEntity(selectedEntity.id, event.target.value)}
            className="mt-1 w-full rounded-sm border border-border-subtle bg-bg-subtle px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-primary"
          />

          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              aria-label={`Duplicate ${selectedEntity.name}`}
              onClick={() => duplicateEntity(selectedEntity.id)}
              className="flex-1 rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-text-secondary hover:border-border-interactive hover:text-text-primary"
            >
              Duplicate
            </button>
            <button
              type="button"
              aria-label={`Delete ${selectedEntity.name}`}
              onClick={() => removeEntity(selectedEntity.id)}
              className="flex-1 rounded-sm border border-accent-danger/40 px-2 py-1 text-[10px] text-accent-danger hover:border-accent-danger"
            >
              Delete
            </button>
          </div>

          <div className="mt-3 space-y-2">
            <SectionLabel>Transform</SectionLabel>
            {(['position', 'rotation', 'scale'] as const).map((field) => (
              <div key={field} className="grid grid-cols-[3.5rem_repeat(3,1fr)] items-center gap-1">
                <span className="text-[10px] capitalize text-text-muted">{field}</span>
                {AXES.map((axis, index) => (
                  <input
                    key={axis}
                    aria-label={`${field[0].toUpperCase()}${field.slice(1)} ${axis}`}
                    type="number"
                    step="0.1"
                    value={selectedEntity[field][index]}
                    onChange={(event) => updateTransform(field, index, Number(event.target.value))}
                    className="min-w-0 rounded-sm border border-border-subtle bg-bg-subtle px-1.5 py-1 text-[10px] font-mono text-text-primary outline-none focus:border-accent-primary"
                  />
                ))}
              </div>
            ))}
          </div>

          {selectedEntity.type === 'audio_emitter' ? (
            <AudioEmitterControls entity={selectedEntity} updateEntity={updateEntity} />
          ) : null}
          {selectedEntity.type === 'npc' ? (
            <NpcControls entity={selectedEntity} updateEntity={updateEntity} />
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-border-subtle pt-3 text-[11px] text-text-muted">
          Select an entity to edit its name and transform.
        </p>
      )}

      <div className="mt-3 flex gap-1.5 border-t border-border-subtle pt-3">
        <button
          type="button"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={undo}
          className="flex-1 rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={redo}
          className="flex-1 rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Redo
        </button>
      </div>
    </section>
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
    <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
      <SectionLabel>Audio</SectionLabel>
      <label className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        <span>Volume</span>
        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => updateEntity(entity.id, { volume: Number(event.target.value) })}
          className="h-1 w-24 accent-accent-primary"
        />
        <span className="w-9 text-right font-mono text-text-telemetry">{volume.toFixed(2)}</span>
      </label>
      <label className="flex items-center justify-between gap-2 text-[10px] text-text-muted">
        <span>Falloff</span>
        <input
          aria-label="Falloff distance"
          type="range"
          min={5}
          max={50}
          step={1}
          value={falloff}
          onChange={(event) => updateEntity(entity.id, { falloffDistance: Number(event.target.value) })}
          className="h-1 w-24 accent-accent-cyan"
        />
        <span className="w-9 text-right font-mono text-text-telemetry">{falloff}m</span>
      </label>
    </div>
  );
}

function NpcControls({
  entity,
  updateEntity,
}: {
  entity: SceneEntity;
  updateEntity: (id: string, patch: Partial<Omit<SceneEntity, 'id'>>) => void;
}) {
  return (
    <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
      <SectionLabel>NPC Authoring</SectionLabel>
      <label className="block text-[10px] text-text-muted" htmlFor="npc-persona">
        Persona
      </label>
      <textarea
        id="npc-persona"
        aria-label="NPC persona"
        maxLength={2000}
        value={entity.npcPersona ?? DEFAULT_PERSONA}
        onChange={(event) => updateEntity(entity.id, { npcPersona: event.target.value })}
        className="min-h-16 w-full resize-y rounded-sm border border-border-subtle bg-bg-subtle px-2 py-1.5 text-[10px] leading-relaxed text-text-primary outline-none focus:border-accent-primary"
      />
      <label className="block text-[10px] text-text-muted" htmlFor="npc-voice">
        Kokoro voice ID
      </label>
      <input
        id="npc-voice"
        aria-label="NPC voice ID"
        maxLength={32}
        value={entity.npcVoice ?? 'af_heart'}
        onChange={(event) => updateEntity(entity.id, { npcVoice: event.target.value })}
        className="w-full rounded-sm border border-border-subtle bg-bg-subtle px-2 py-1.5 text-[10px] font-mono text-text-primary outline-none focus:border-accent-primary"
      />
      <p className="text-[10px] leading-relaxed text-text-muted">
        Voice IDs are validated by the Kokoro worker when speech plays.
      </p>
    </div>
  );
}
