'use client';

import { useRef, useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useUiStore } from '@/lib/stores/useUiStore';

/**
 * Generative asset panel (docs/02_DESIGN_BRIEF.md §4): upload a reference
 * image and press Generate Mesh (TripoSR image→3D) or Generate Texture
 * (SDXL-Turbo from the shared prompt). The panel stays interactive during
 * generation; the GPU work itself never blocks the UI.
 */
export function GenerationPanel() {
  const prompt = useUiStore((s) => s.prompt);
  const generating = useGenerationStore((s) => s.status === 'generating');
  const generateMesh = useGenerationStore((s) => s.generateMesh);
  const generateTexture = useGenerationStore((s) => s.generateTexture);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    setImageName(file.name);
  };

  const hasImage = imageDataUrl !== null;

  return (
    <GlassPanel className="p-3">
      <SectionLabel>Generate</SectionLabel>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        data-testid="image-upload"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <button
        type="button"
        data-testid="upload-button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border-subtle bg-bg-subtle px-3 py-2.5 text-left transition-all duration-150 hover:border-accent-primary/50 active:scale-[0.99]"
      >
        {hasImage ? (
          <>
            {/* client-side data-URL preview; the image optimizer cannot process it */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl ?? ''}
              alt="Reference"
              data-testid="image-preview"
              className="size-9 shrink-0 rounded-sm border border-border-subtle object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
              {imageName}
            </span>
            <span
              role="button"
              tabIndex={0}
              data-testid="clear-image"
              className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted hover:text-accent-danger"
              onClick={(event) => {
                event.stopPropagation();
                setImageDataUrl(null);
                setImageName(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Clear
            </span>
          </>
        ) : (
          <span className="text-[11px] text-text-muted">
            Upload a reference image (PNG / JPG)
          </span>
        )}
      </button>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid="generate-mesh"
          disabled={!hasImage || generating}
          onClick={() => void generateMesh(prompt, imageDataUrl ?? '')}
          className="flex-1 rounded-md border border-accent-primary/50 bg-accent-primary/10 px-3 py-1.5 text-xs font-medium text-accent-primary transition-all duration-150 hover:border-accent-primary disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          Generate Mesh
        </button>
        <button
          type="button"
          data-testid="generate-texture"
          disabled={prompt.trim().length === 0 || generating}
          onClick={() => void generateTexture(prompt)}
          className="flex-1 rounded-md border border-accent-secondary/50 bg-accent-secondary/10 px-3 py-1.5 text-xs font-medium text-accent-secondary transition-all duration-150 hover:border-accent-secondary disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          Generate Texture
        </button>
      </div>
    </GlassPanel>
  );
}
