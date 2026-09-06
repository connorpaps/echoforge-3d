'use client';

import dynamic from 'next/dynamic';
import { EmptySceneState } from '@/components/viewport/EmptySceneState';
import { useSceneStore } from '@/lib/stores/useSceneStore';

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
  const entityCount = useSceneStore((state) => Object.keys(state.entities).length);

  return (
    <div
      data-testid="viewport-3d"
      className="viewport-field relative h-full w-full overflow-hidden"
    >
      <Viewport3D />
      <div className="pointer-events-none absolute left-6 top-6 border-l-2 border-accent-forge/55 pl-3">
        <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-accent-forge">01 / viewport</span>
        <span className="mt-1 block text-xs font-medium text-text-primary">Field view</span>
        <span className="mt-0.5 hidden text-[11px] text-text-muted sm:block">Orbit to inspect · scroll to zoom</span>
      </div>
      {entityCount === 0 && <EmptySceneState />}
    </div>
  );
}
