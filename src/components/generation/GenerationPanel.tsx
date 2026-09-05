'use client';

import { useRef, useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { resumeAudioContext } from '@/lib/audio/spatialAudio';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useUiStore } from '@/lib/stores/useUiStore';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

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
  const generateAudio = useGenerationStore((s) => s.generateAudio);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearImage = () => {
    setImageDataUrl(null);
    setImageName(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setUploadError('Unsupported file type. Use PNG, JPG, or WebP.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('This file is too large. Maximum size is 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth > MAX_DIMENSION || image.naturalHeight > MAX_DIMENSION) {
          setUploadError('Image dimensions are too large. Maximum is 8192 × 8192 pixels.');
          return;
        }
        setImageDataUrl(dataUrl);
        setImageName(file.name);
      };
      image.onerror = () => setUploadError('Unable to read this image.');
      image.src = dataUrl;
    };
    reader.onerror = () => setUploadError('Unable to read this file.');
    reader.readAsDataURL(file);
  };

  const hasImage = imageDataUrl !== null;

  return (
    <GlassPanel className="p-3">
      <SectionLabel>Generate</SectionLabel>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Reference image upload"
        data-testid="image-upload"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border-subtle bg-bg-subtle px-3 py-2.5 transition-all duration-150 hover:border-accent-primary/50">
        <button
          type="button"
          data-testid="upload-button"
          aria-label="Upload reference image"
          onClick={() => fileInputRef.current?.click()}
          className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.99]"
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
          </>
          ) : (
            <span className="text-[11px] text-text-muted">
              Upload a reference image (PNG / JPG / WebP)
            </span>
          )}
        </button>
        {hasImage && (
          <button
            type="button"
            data-testid="clear-image"
            aria-label="Clear reference image"
            className="shrink-0 text-[10px] uppercase tracking-wider text-text-muted hover:text-accent-danger"
            onClick={clearImage}
          >
            Clear
          </button>
        )}
      </div>

      {uploadError ? (
        <p role="alert" className="mt-1.5 text-[11px] text-accent-danger">
          {uploadError}
        </p>
      ) : null}

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

      <button
        type="button"
        data-testid="generate-audio"
        disabled={prompt.trim().length === 0 || generating}
        onClick={() => {
          // The click is the user gesture that unlocks the AudioContext.
          resumeAudioContext();
          void generateAudio(prompt);
        }}
        className="mt-2 w-full rounded-md border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1.5 text-xs font-medium text-accent-cyan transition-all duration-150 hover:border-accent-cyan disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
      >
        Generate Ambient Audio
      </button>
    </GlassPanel>
  );
}
