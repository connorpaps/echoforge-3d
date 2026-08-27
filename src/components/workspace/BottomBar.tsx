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
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border-subtle bg-bg-canvas/80 px-4">
      <div className="flex items-center gap-4">
        <TelemetryText>Web Audio: 44.1kHz</TelemetryText>
        <TelemetryText data-testid="ambient-bus">
          Ambient Bus: {audioEmitterCount} emitter{audioEmitterCount === 1 ? '' : 's'}
        </TelemetryText>
        <TelemetryText>Rapier: Running</TelemetryText>
        {terrainVertexCount > 0 && (
          <TelemetryText className="text-accent-cyan">
            Verts: {terrainVertexCount}
          </TelemetryText>
        )}
        {activeMode === 'play' && (
          <TelemetryText data-testid="player-pos" className="text-text-telemetry">
            POS: {playerPos[0].toFixed(1)}, {playerPos[1].toFixed(1)},{' '}
            {playerPos[2].toFixed(1)}
          </TelemetryText>
        )}
      </div>
      <div className="flex items-center gap-4">
        <TelemetryText>
          Frame Time: {frameTimeMs > 0 ? `${frameTimeMs.toFixed(1)}ms` : '--'}
        </TelemetryText>
        <TelemetryText>
          P95: {frameTimeP95 > 0 ? `${frameTimeP95.toFixed(1)}ms` : '--'}
        </TelemetryText>
        <TelemetryText>FPS: {fps > 0 ? fps : '--'}</TelemetryText>
      </div>
    </footer>
  );
}
