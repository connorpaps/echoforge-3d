'use client';

import { StatusPill } from '@/components/ui/StatusPill';
import { VramMeter } from '@/components/generation/VramMeter';
import { ExportMenu } from '@/components/workspace/ExportMenu';
import { ProjectActions } from '@/components/workspace/ProjectActions';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

export function TopBar() {
  const isRecording = useSceneStore((s) => s.isRecordingVoice);
  const activeMode = useSceneStore((s) => s.activeMode);
  const setMode = useSceneStore((s) => s.setMode);
  const drawerCollapsed = useUiStore((s) => s.drawerCollapsed);
  const toggleDrawer = useUiStore((s) => s.toggleDrawer);
  const postFxEnabled = useUiStore((s) => s.postFxEnabled);
  const togglePostFx = useUiStore((s) => s.togglePostFx);

  return (
    <header className="flex h-12 min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-border-subtle bg-bg-chrome px-3 sm:px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <span className="flex size-7 items-center justify-center text-accent-forge" aria-label="EchoForge mark">
          <svg viewBox="0 0 28 28" className="size-7 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
            <path d="M4 7.5h11M4 14h8M4 20.5h11" />
            <path d="M17.5 7.5h6M20.5 14h3M17.5 20.5h6" />
            <path d="M15 4.5 12.5 7.5 15 10.5M15 17.5 12.5 20.5 15 23.5" />
          </svg>
        </span>
        <h1 className="truncate text-[13px] font-medium tracking-[-0.01em] text-text-primary">
          EchoForge 3D <span className="font-mono text-[10px] text-text-muted">/ field 01</span>
        </h1>
        <div className="hidden border-l border-border-subtle pl-3 lg:block">
          <VramMeter />
        </div>
      </div>

      <nav aria-label="Workspace mode" data-testid="workspace-mode" className="hidden items-center gap-1 border-l border-border-subtle pl-3 md:flex">
        {(['editor', 'play'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={activeMode === mode}
            onClick={() => setMode(mode)}
            className={`border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
              activeMode === mode
                ? 'border-accent-forge/55 bg-accent-forge/10 text-accent-forge'
                : 'border-transparent text-text-muted hover:border-border-subtle hover:text-text-primary'
            }`}
          >
            {mode === 'editor' ? 'Edit' : 'Play'}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-1.5 whitespace-nowrap">
        <button
          type="button"
          data-testid="drawer-toggle"
          aria-label={drawerCollapsed ? 'Show creation panel' : 'Hide creation panel'}
          aria-pressed={!drawerCollapsed}
          onClick={toggleDrawer}
          className="border border-border-interactive px-2.5 py-1.5 text-[10px] font-medium text-text-secondary transition hover:border-accent-forge/60 hover:text-accent-forge"
        >
          {drawerCollapsed ? 'Show controls' : 'Hide controls'}
        </button>
        <StatusPill className="hidden lg:inline-flex" tone={isRecording ? 'recording' : 'idle'}>
          <span className="size-1.5 rounded-full bg-current" />
          Voice: {isRecording ? 'Recording' : 'Ready'}
        </StatusPill>

        <button
          type="button"
          data-testid="fx-toggle"
          aria-pressed={postFxEnabled}
          onClick={togglePostFx}
          className="hidden border border-border-interactive px-2.5 py-1.5 text-[10px] font-medium text-text-secondary transition-all duration-150 hover:border-border-interactive hover:text-text-primary active:scale-[0.98] lg:inline-flex"
        >
          Preview FX: {postFxEnabled ? 'On' : 'Off'}
        </button>

        <ProjectActions />
        <ExportMenu />
      </div>
    </header>
  );
}
