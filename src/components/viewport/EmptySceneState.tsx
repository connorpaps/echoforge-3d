'use client';

/**
 * First-run guidance for the viewport. The upload label intentionally points
 * at the existing reference input so the canvas and creation panel share one
 * interaction instead of maintaining two upload implementations.
 */
export function EmptySceneState() {
  return (
    <div className="pointer-events-none absolute inset-0 p-6 sm:p-8">
      <div
        data-testid="empty-scene-state"
        className="empty-scene-state pointer-events-auto absolute bottom-8 left-6 max-w-sm border-l-2 border-accent-forge/60 bg-bg-surface/90 p-5 sm:bottom-10 sm:left-8"
      >
        <p className="field-kicker text-accent-forge">Reference / forge / stage</p>
        <h2 className="mt-3 text-xl font-medium tracking-[-0.03em] text-text-primary">
          Create your first 3D asset
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          The field is clear. Add a reference, forge a mesh, then stage it here.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-border-subtle py-3 font-mono text-[9px] uppercase tracking-[0.08em] text-text-muted">
          <span className="text-accent-forge">01 Reference</span>
          <span>02 Forge</span>
          <span>03 Stage</span>
        </div>
        <label
          htmlFor="image-upload"
          data-testid="empty-state-upload"
          className="mt-4 inline-flex min-h-10 cursor-pointer items-center border border-accent-forge/60 bg-accent-forge px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-forge/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-accent-forge/40"
        >
          Add reference image
        </label>
        <p className="mt-2 text-[11px] text-text-muted">PNG, JPG, or WebP, up to 10 MB.</p>
      </div>
    </div>
  );
}
