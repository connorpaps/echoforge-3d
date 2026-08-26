'use client';

import { KeycapBadge } from '@/components/ui/KeycapBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import { VramMeter } from '@/components/generation/VramMeter';
import { useSceneStore } from '@/lib/stores/useSceneStore';

export function TopBar() {
  const isRecording = useSceneStore((s) => s.isRecordingVoice);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-canvas/80 px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold tracking-tight text-text-primary">
          EchoForge 3D
        </h1>
        <VramMeter />
      </div>

      <div className="flex items-center gap-4">
        <StatusPill tone={isRecording ? 'recording' : 'idle'}>
          <span className="size-1.5 rounded-full bg-current" />
          Voice: {isRecording ? 'Recording' : 'Ready'}
        </StatusPill>

        <div className="hidden items-center gap-1.5 md:flex">
          <KeycapBadge>Cmd+B</KeycapBadge>
          <span className="text-[10px] text-text-muted">Drawer</span>
        </div>

        <button
          type="button"
          className="rounded-sm border border-accent-secondary/50 px-3 py-1 text-xs font-medium text-accent-secondary transition-all duration-150 hover:border-accent-secondary active:scale-[0.98]"
        >
          Export .GLB / Scene
        </button>
      </div>
    </header>
  );
}
