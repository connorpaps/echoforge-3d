'use client';

import { TelemetryText } from '@/components/ui/TelemetryText';
import { usePlayerStore } from '@/lib/stores/usePlayerStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

export function BottomBar() {
  const fps = useUiStore((s) => s.fps);
  const frameTimeMs = useUiStore((s) => s.frameTimeMs);
  const frameTimeP95 = useUiStore((s) => s.frameTimeP95);
  const terrainVertexCount = useUiStore((s) => s.terrainVertexCount);
  const audioEmitterCount = useUiStore((s) => s.audioEmitterCount);
  const activeMode = useSceneStore((s) => s.activeMode);
  const playerPos = usePlayerStore((s) => s.position);

  return (
    <footer className="field-status flex h-8 min-w-0 shrink-0 items-center justify-between gap-3 border-t border-border-subtle bg-bg-chrome px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3 whitespace-nowrap">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-text-secondary">
          <span className="size-1.5 bg-accent-echo" aria-hidden="true" />
          Local scene
        </span>
        {activeMode === 'play' && (
          <TelemetryText data-testid="player-pos" className="text-accent-forge">
            POS: {playerPos[0].toFixed(1)}, {playerPos[1].toFixed(1)}, {playerPos[2].toFixed(1)}
          </TelemetryText>
        )}
      </div>
      <details className="group relative shrink-0">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted marker:hidden [&::-webkit-details-marker]:hidden">
          <span>Runtime</span>
          <span className="text-accent-echo">FPS: {fps > 0 ? fps : '--'}</span>
          <span className="transition-transform group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <div className="absolute bottom-6 right-0 z-30 min-w-56 border border-border-interactive bg-bg-chrome p-3 shadow-[0_8px_20px_rgba(32,37,34,0.14)]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <TelemetryText>Web Audio: 44.1kHz</TelemetryText>
            <TelemetryText data-testid="ambient-bus">Ambient: {audioEmitterCount} emitter{audioEmitterCount === 1 ? '' : 's'}</TelemetryText>
            <TelemetryText>Rapier: Running</TelemetryText>
            <TelemetryText>Frame: {frameTimeMs > 0 ? `${frameTimeMs.toFixed(1)}ms` : '--'}</TelemetryText>
            <TelemetryText>P95: {frameTimeP95 > 0 ? `${frameTimeP95.toFixed(1)}ms` : '--'}</TelemetryText>
            {terrainVertexCount > 0 && <TelemetryText className="text-accent-echo">Verts: {terrainVertexCount}</TelemetryText>}
          </div>
        </div>
      </details>
    </footer>
  );
}
