'use client';

import { useEffect, useState } from 'react';
import { GeneratingPill } from '@/components/generation/GeneratingPill';
import { GeneratedAudioBridge } from '@/components/generation/GeneratedAudioBridge';
import { GeneratedEntityBridge } from '@/components/generation/GeneratedEntityBridge';
import { ResultToast } from '@/components/generation/ResultToast';
import { CrosshairHud } from '@/components/player/CrosshairHud';
import { DialogueBubble } from '@/components/workspace/DialogueBubble';
import { BottomBar } from '@/components/workspace/BottomBar';
import { LeftDrawer } from '@/components/workspace/LeftDrawer';
import { SceneInspector } from '@/components/workspace/SceneInspector';
import { TopBar } from '@/components/workspace/TopBar';
import { ViewportCanvas } from '@/components/viewport/ViewportCanvas';
import { useGlobalHotkeys } from '@/lib/hotkeys';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';
import type { SceneState } from '@/lib/stores/useSceneStore';

function ViewportStage({ activeMode }: { activeMode: SceneState['activeMode'] }) {
  return (
    <div className="relative h-full min-w-0">
      <ViewportCanvas />
      {activeMode === 'play' && <CrosshairHud />}
      {/* Spawns generated meshes into the scene on success */}
      <GeneratedEntityBridge />
      {/* Spawns generated ambient loops as HRTF emitters on success */}
      <GeneratedAudioBridge />
      {/* Non-blocking generation HUD (Task 2.5) */}
      <GeneratingPill />
      <ResultToast />
      {/* Vision-NPC dialogue overlay (Task 3.3) */}
      <DialogueBubble />
    </div>
  );
}

/**
 * Split-workstation layout (DESIGN.md §5): resizable left creation drawer
 * (25–40%) + full-bleed right viewport, bracketed by top/bottom bars.
 * Pressing Tab enters play mode and fades the drawer (docs/02 §3.3).
 */
export function Workstation() {
  useGlobalHotkeys();
  const [isCompact, setIsCompact] = useState(false);
  const activeMode = useSceneStore((s) => s.activeMode);
  const selectedEntityId = useSceneStore((s) => s.selectedEntityId);
  const drawerCollapsed = useUiStore((s) => s.drawerCollapsed);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const update = () => setIsCompact(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  const drawerHidden = activeMode === 'play' || drawerCollapsed;

  const showInspector = Boolean(selectedEntityId) && activeMode === 'editor' && !isCompact;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-canvas">
      <TopBar />
      <div
        className="editor-shell relative min-h-0 flex-1"
        data-drawer={drawerHidden ? 'hidden' : 'visible'}
        data-inspector={showInspector ? 'visible' : 'hidden'}
      >
        {isCompact ? (
          <div className="relative h-full min-h-0 min-w-0 flex-1">
            <ViewportStage activeMode={activeMode} />
            {!drawerHidden && (
              <div className="absolute inset-y-0 left-0 z-20 w-[min(86vw,320px)] border-r border-border-subtle bg-bg-surface shadow-[10px_0_24px_rgba(32,37,34,0.12)]">
                <LeftDrawer />
              </div>
            )}
          </div>
        ) : (
          <>
            {!drawerHidden && (
              <div className="min-h-0 min-w-0 overflow-hidden">
                <LeftDrawer />
              </div>
            )}
            <main className="relative min-h-0 min-w-0 overflow-hidden border-l border-border-subtle">
              <ViewportStage activeMode={activeMode} />
            </main>
            {showInspector && (
              <aside className="min-h-0 min-w-0 overflow-hidden border-l border-border-subtle bg-bg-surface">
                <SceneInspector />
              </aside>
            )}
          </>
        )}
      </div>
      <BottomBar />
    </div>
  );
}
