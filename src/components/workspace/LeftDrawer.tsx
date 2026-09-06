'use client';

import { useState } from 'react';
import { TopoCanvas } from '@/components/canvas/TopoCanvas';
import { GenerationPanel } from '@/components/generation/GenerationPanel';
import { EditorRail, type EditorTab } from '@/components/workspace/EditorRail';
import { PromptBar } from '@/components/workspace/PromptBar';
import { SceneTree } from '@/components/workspace/SceneTree';
import { ProviderStatusPanel } from '@/components/workspace/ProviderStatusPanel';

/**
 * Source and scene dock. The narrow rail switches between the three real
 * editor regions without turning the workspace into a stack of dashboards.
 */
export function LeftDrawer() {
  const [activeTab, setActiveTab] = useState<EditorTab>('create');

  return (
    <aside
      data-testid="left-drawer"
      className="flex h-full min-w-0 overflow-hidden border-r border-border-subtle bg-bg-surface"
    >
      <EditorRail activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-border-subtle px-4 py-3">
          <p className="field-kicker">EchoForge / local studio</p>
          <p className="mt-1 text-[11px] text-text-muted">
            {activeTab === 'create' ? 'Reference intake' : activeTab === 'scene' ? 'Scene hierarchy' : 'Field tools'}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'create' ? (
            <div className="space-y-4 p-4">
              <GenerationPanel />
              <PromptBar />
            </div>
          ) : activeTab === 'scene' ? (
            <SceneTree />
          ) : (
            <div className="space-y-4 p-4">
              <section className="editor-region p-3">
                <p className="field-kicker">03 / tools</p>
                <h2 className="mt-1 text-sm font-medium text-text-primary">Terrain field</h2>
                <div className="mt-3">
                  <TopoCanvas />
                </div>
              </section>
              <details className="group editor-region">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-xs font-medium text-text-primary marker:hidden [&::-webkit-details-marker]:hidden">
                  <span>System status</span>
                  <span className="font-mono text-[10px] text-text-muted transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <div className="border-t border-border-subtle p-3">
                  <ProviderStatusPanel />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
