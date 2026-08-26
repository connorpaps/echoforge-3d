'use client';

import { TelemetryText } from '@/components/ui/TelemetryText';
import { useUiStore } from '@/lib/stores/useUiStore';

export function BottomBar() {
  const fps = useUiStore((s) => s.fps);
  const frameTimeMs = useUiStore((s) => s.frameTimeMs);
  const terrainVertexCount = useUiStore((s) => s.terrainVertexCount);

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border-subtle bg-bg-canvas/80 px-4">
      <div className="flex items-center gap-4">
        <TelemetryText>Web Audio: 44.1kHz</TelemetryText>
        <TelemetryText>Rapier: --</TelemetryText>
        {terrainVertexCount > 0 && (
          <TelemetryText className="text-accent-cyan">
            Verts: {terrainVertexCount}
          </TelemetryText>
        )}
      </div>
      <div className="flex items-center gap-4">
        <TelemetryText>
          Frame Time: {frameTimeMs > 0 ? `${frameTimeMs.toFixed(1)}ms` : '--'}
        </TelemetryText>
        <TelemetryText>FPS: {fps > 0 ? fps : '--'}</TelemetryText>
      </div>
    </footer>
  );
}
