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
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-md bg-accent-secondary px-2.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(51,78,104,0.16)] transition-all duration-150 hover:bg-accent-secondary/90 active:scale-[0.98]"
      >
        {busy ? 'Exporting…' : 'Export'}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-border-subtle bg-bg-surface p-1.5 shadow-[0_16px_40px_rgba(30,41,59,0.16)] backdrop-blur-md">
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
