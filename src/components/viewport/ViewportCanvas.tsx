'use client';

import dynamic from 'next/dynamic';

const Viewport3D = dynamic(() => import('@/components/viewport/Viewport3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
      Initializing viewport…
    </div>
  ),
});

/**
 * Full-bleed 3D viewport (DESIGN.md §5). Loaded client-only (`ssr: false`)
 * so the Three.js scene never renders on the server (docs/08 Task 1.1).
 */
export function ViewportCanvas() {
  return (
    <div
      data-testid="viewport-3d"
      className="relative h-full w-full overflow-hidden bg-bg-canvas"
    >
      <Viewport3D />
    </div>
  );
}
