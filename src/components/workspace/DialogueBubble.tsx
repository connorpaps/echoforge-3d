'use client';

import { useEffect, useState } from 'react';
import { npcProximityRef } from '@/components/player/NpcInteract';
import { useDialogueStore } from '@/lib/stores/useDialogueStore';

const HINT_POLL_MS = 300;
const BUBBLE_DISMISS_MS = 8000;

/**
 * Viewport overlay for the vision-NPC dialogue (Task 3.3): a "Press E to
 * talk" hint when an NPC is in range, and a glass bubble with the NPC's
 * reply (auto-dismisses). Pointer-events-none wrapper keeps the 3D viewport
 * navigable (DESIGN.md §6).
 */
export function DialogueBubble() {
  const dialogue = useDialogueStore((s) => s.dialogue);
  const thinking = useDialogueStore((s) => s.thinking);
  const clear = useDialogueStore((s) => s.clear);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNear(npcProximityRef.id !== null);
    }, HINT_POLL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dialogue) return;
    const timer = setTimeout(clear, BUBBLE_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dialogue, clear]);

  if (dialogue) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex justify-center px-6">
        <div
          data-testid="dialogue-bubble"
          role="status"
          className="pointer-events-auto max-w-md rounded-md border border-accent-secondary/50 bg-bg-surface p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
        >
          <p className="text-xs leading-relaxed text-text-primary">
            {dialogue.text}
          </p>
          {dialogue.synthetic && (
            <p className="mt-1 text-[10px] uppercase tracking-wider text-text-muted">
              Synthetic reply
            </p>
          )}
        </div>
      </div>
    );
  }

  if (thinking) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex justify-center">
        <span className="animate-pulse rounded-full border border-accent-primary/50 bg-bg-elevated/90 px-3 py-1 text-[10px] text-text-secondary">
          Thinking…
        </span>
      </div>
    );
  }

  if (near) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex justify-center">
        <span
          data-testid="interact-hint"
          className="rounded-full border border-border-subtle bg-bg-elevated/90 px-3 py-1 text-[10px] text-text-secondary"
        >
          Press E to talk
        </span>
      </div>
    );
  }

  return null;
}
