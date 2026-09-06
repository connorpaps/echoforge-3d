'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, type HealthInfo } from '@/lib/api/generate';
import { TelemetryText } from '@/components/ui/TelemetryText';

const SEGMENTS = 10;

function formatGigabytes(mb: number): string {
  return (mb / 1024).toFixed(1);
}

/**
 * Telemetry-cyan VRAM meter (DESIGN.md §2.3 / docs/02_DESIGN_BRIEF.md §2):
 * polls GET /health and renders `VRAM: 4.2GB/8GB [■■■■■□□□□□]`. Falls back
 * to a muted offline readout when the backend is unreachable (dev without
 * the microservice running).
 */
export function VramMeter() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await fetchHealth();
        if (!cancelled) {
          setHealth(next);
          setOffline(false);
        }
      } catch {
        if (!cancelled) setOffline(true);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (offline || !health?.cuda?.available) {
    return <TelemetryText className="text-text-muted">VRAM: offline</TelemetryText>;
  }

  const { vramReservedMB, vramTotalMB } = health.cuda;
  const usedRatio = vramTotalMB > 0 ? vramReservedMB / vramTotalMB : 0;
  const filled = Math.round(usedRatio * SEGMENTS);
  const meshProvider = health.providers?.mesh?.selected;
  const meshLabel =
    meshProvider === 'hunyuan3d-2gp' ? 'Hunyuan3D-2GP' : meshProvider === 'triposr' ? 'TripoSR' : null;

  return (
    <div
      data-testid="vram-meter"
      className="flex items-center gap-1.5"
      title={`${health.cuda.deviceName ?? 'GPU'} — reserved ${formatGigabytes(vramReservedMB)} GB`}
    >
      <TelemetryText>
        VRAM: {formatGigabytes(vramReservedMB)}GB/{Math.round(vramTotalMB / 1024)}GB
      </TelemetryText>
      {meshLabel ? (
        <TelemetryText data-testid="mesh-provider" className="text-accent-primary">
          Mesh: {meshLabel}
        </TelemetryText>
      ) : null}
      <span
        aria-hidden
        className="flex gap-px font-mono text-[9px] leading-none text-accent-cyan"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i}>{i < filled ? '■' : '□'}</span>
        ))}
      </span>
    </div>
  );
}
