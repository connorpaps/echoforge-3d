'use client';

import { KeycapBadge } from '@/components/ui/KeycapBadge';

/**
 * First-person HUD (docs/02 §3.3). The parent container is
 * pointer-events-none so 3D navigation is never blocked (DESIGN.md §6);
 * chips are decorative text, not interactive.
 */
export function CrosshairHud() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div data-testid="crosshair-hud" className="relative size-5">
        <span className="absolute left-1/2 top-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 bg-text-secondary/80" />
        <span className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-text-secondary/80" />
      </div>

      <div className="absolute bottom-6 right-6 flex items-center gap-2 rounded-sm border border-border-subtle bg-bg-surface/70 px-2.5 py-1.5 font-mono text-[10px] text-text-muted backdrop-blur-md">
        <KeycapBadge>WASD</KeycapBadge> walk
        <KeycapBadge>Space</KeycapBadge> jump
        <KeycapBadge>E</KeycapBadge> interact
        <KeycapBadge>Tab</KeycapBadge> exit
      </div>
    </div>
  );
}
