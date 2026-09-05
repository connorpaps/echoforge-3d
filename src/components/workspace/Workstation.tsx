'use client';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GeneratingPill } from '@/components/generation/GeneratingPill';
import { GeneratedAudioBridge } from '@/components/generation/GeneratedAudioBridge';
import { GeneratedEntityBridge } from '@/components/generation/GeneratedEntityBridge';
import { ResultToast } from '@/components/generation/ResultToast';
import { CrosshairHud } from '@/components/player/CrosshairHud';
import { DialogueBubble } from '@/components/workspace/DialogueBubble';
import { BottomBar } from '@/components/workspace/BottomBar';
import { LeftDrawer } from '@/components/workspace/LeftDrawer';
import { TopBar } from '@/components/workspace/TopBar';
import { ViewportCanvas } from '@/components/viewport/ViewportCanvas';
import { useGlobalHotkeys } from '@/lib/hotkeys';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useUiStore } from '@/lib/stores/useUiStore';

/**
 * Split-workstation layout (DESIGN.md §5): resizable left creation drawer
 * (25–40%) + full-bleed right viewport, bracketed by top/bottom bars.
 * Pressing Tab enters play mode and fades the drawer (docs/02 §3.3).
 */
export function Workstation() {
  useGlobalHotkeys();
  const activeMode = useSceneStore((s) => s.activeMode);
  const drawerCollapsed = useUiStore((s) => s.drawerCollapsed);

  const drawerHidden = activeMode === 'play' || drawerCollapsed;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg-canvas">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="min-w-0 flex-1">
          {!drawerHidden && (
            <>
              <Panel
                defaultSize={30}
                minSize={0}
                maxSize={40}
                className="min-w-0"
              >
                <LeftDrawer />
              </Panel>
              <PanelResizeHandle className="w-px shrink-0 bg-border-subtle transition-colors hover:bg-accent-primary/50" />
            </>
          )}
          <Panel defaultSize={70} minSize={0} className="relative min-w-0">
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
          </Panel>
        </PanelGroup>
      </div>
      <BottomBar />
    </div>
  );
}
