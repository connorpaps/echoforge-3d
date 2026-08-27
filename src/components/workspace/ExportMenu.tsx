'use client';

import { useEffect, useRef, useState } from 'react';
import {
  exportGltfScene,
  exportStandaloneHtml,
} from '@/lib/export/exportScene';

/**
 * One-click engine export menu (Task 3.6 / CUJ-04): a compact dropdown on
 * the TopBar offering the fully-offline standalone HTML bundle and the
 * Godot/Unity glTF scene tree. Downloads are generated from the current
 * scene store snapshot (no live renderer access needed).
 */
export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const run = async (format: 'html' | 'gltf') => {
    if (busy) return;
    setBusy(format);
    try {
      if (format === 'html') await exportStandaloneHtml();
      else exportGltfScene();
      setOpen(false);
    } catch (error) {
      console.error('[export] failed', error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="export-btn"
        onClick={() => setOpen((o) => !o)}
        className="rounded-sm border border-accent-secondary/50 px-3 py-1 text-xs font-medium text-accent-secondary transition-all duration-150 hover:border-accent-secondary active:scale-[0.98]"
      >
        {busy ? 'Exporting…' : 'Export .GLB / Scene'}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-60 rounded-md border border-border-subtle bg-bg-surface p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <button
            type="button"
            data-testid="export-html"
            disabled={busy !== null}
            onClick={() => void run('html')}
            className="w-full rounded-sm px-2.5 py-2 text-left text-xs font-medium text-text-primary transition-all duration-150 hover:bg-bg-subtle disabled:opacity-40"
          >
            Standalone HTML
            <span className="block text-[10px] font-normal text-text-muted">
              Single offline file · opens in any browser
            </span>
          </button>
          <button
            type="button"
            data-testid="export-gltf"
            disabled={busy !== null}
            onClick={() => void run('gltf')}
            className="w-full rounded-sm px-2.5 py-2 text-left text-xs font-medium text-text-primary transition-all duration-150 hover:bg-bg-subtle disabled:opacity-40"
          >
            Godot / Unity (.gltf)
            <span className="block text-[10px] font-normal text-text-muted">
              Merged scene tree + .bin buffer
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
