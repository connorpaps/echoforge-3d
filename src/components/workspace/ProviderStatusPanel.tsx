'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, type HealthInfo, type ProviderInfo } from '@/lib/api/generate';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';

interface ProviderRow {
  label: string;
  provider: string;
  state: string;
  tone: 'healthy' | 'fallback' | 'optional' | 'worker' | 'offline';
}

function providerName(value: string): string {
  const names: Record<string, string> = {
    'sdxl-turbo': 'SDXL-Turbo',
    audiogen: 'AudioGen',
    smolvlm: 'SmolVLM',
    'whisper-small.en': 'Whisper',
    kokoro: 'Kokoro',
    'depth-anything-v2-small': 'Depth Anything V2',
  };
  return names[value] ?? value;
}

function optionalRow(label: string, info: ProviderInfo | undefined): ProviderRow {
  return {
    label,
    provider: providerName(info?.provider ?? 'unavailable'),
    state: info?.fallback ? `Fallback: ${info.fallback}` : info?.mode === 'optional' ? 'Optional' : 'Unavailable',
    tone: info?.fallback ? 'fallback' : info?.mode === 'optional' ? 'optional' : 'offline',
  };
}

function buildRows(health: HealthInfo): ProviderRow[] {
  const mesh = health.providers?.mesh;
  const hunyuanReady = mesh?.hunyuan?.available === true;
  return [
    {
      label: 'Image to 3D',
      provider: 'Hunyuan3D-2GP',
      state: hunyuanReady ? 'Primary' : 'Unavailable',
      tone: hunyuanReady ? 'healthy' : 'offline',
    },
    {
      label: 'Mesh fallback',
      provider: 'TripoSR',
      state: hunyuanReady ? 'Standby fallback' : 'Active fallback',
      tone: 'fallback',
    },
    optionalRow('Materials', health.providers?.texture),
    optionalRow('Ambient audio', health.providers?.audio),
    optionalRow('NPC dialogue', health.providers?.dialogue),
    {
      label: 'Speech recognition',
      provider: providerName(health.providers?.speech?.provider ?? 'Whisper'),
      state: 'Browser worker',
      tone: 'worker',
    },
    {
      label: 'Text to speech',
      provider: providerName(health.providers?.tts?.provider ?? 'Kokoro'),
      state: 'Browser worker',
      tone: 'worker',
    },
    {
      label: 'Depth estimation',
      provider: providerName(health.providers?.depth?.provider ?? 'Depth Anything V2'),
      state: 'Browser worker',
      tone: 'worker',
    },
  ];
}

const toneClass: Record<ProviderRow['tone'], string> = {
  healthy: 'text-accent-primary',
  fallback: 'text-accent-warning',
  optional: 'text-text-secondary',
  worker: 'text-accent-cyan',
  offline: 'text-text-muted',
};

export function ProviderStatusPanel() {
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
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <GlassPanel data-testid="provider-status-panel" className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>Provider readiness</SectionLabel>
        <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
          {offline ? 'Offline' : health ? 'Live' : 'Loading'}
        </span>
      </div>
      {health ? (
        <div className="space-y-1.5">
          {buildRows(health).map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 text-[10px]">
              <span className="min-w-0 truncate text-text-secondary" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 text-right">
                <span className="text-text-primary">{row.provider}</span>
                <span className={`ml-1.5 font-mono uppercase tracking-wide ${toneClass[row.tone]}`}>
                  {row.state}
                </span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-text-muted">
          {offline ? 'Backend unavailable. Start the local stack to inspect providers.' : 'Reading local provider status...'}
        </p>
      )}
    </GlassPanel>
  );
}
