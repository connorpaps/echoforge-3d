'use client';

import { useRef, useState } from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { resumeAudioContext } from '@/lib/audio/spatialAudio';
import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import { useSceneStore } from '@/lib/stores/useSceneStore';
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
  const selectedEntityId = useSceneStore((s) => s.selectedEntityId);

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
    <GlassPanel className="editor-region p-4">
      <SectionLabel>Create</SectionLabel>
      <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-text-primary">
        Create a 3D asset
      </h2>
      <p className="mt-1 text-xs leading-5 text-text-secondary">
        Upload a reference image to create a model, then edit it in the viewport.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        id="image-upload"
        aria-label="Reference image upload"
        data-testid="image-upload"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <div className="mt-4 flex items-center gap-2 border border-dashed border-border-interactive bg-bg-subtle px-3 py-3 transition-all duration-150 hover:border-accent-primary/60">
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
              className="size-9 shrink-0 border border-border-subtle object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
              {imageName}
            </span>
          </>
          ) : (
            <span className="text-xs text-text-secondary">
              Upload a reference image
              <span className="mt-0.5 block text-[11px] text-text-muted">PNG, JPG, or WebP · up to 10 MB</span>
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

      <button
        type="button"
        data-testid="generate-mesh"
        disabled={!hasImage || generating}
        onClick={() => void generateMesh(prompt, imageDataUrl ?? '')}
        className="mt-3 flex min-h-11 w-full items-center justify-center border border-accent-primary bg-accent-primary px-3 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-accent-primary/90 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.99]"
      >
        Generate Mesh
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
        <button
          type="button"
          data-testid="generate-texture"
          disabled={prompt.trim().length === 0 || generating}
          onClick={() => void generateTexture(prompt, selectedEntityId)}
          className="rounded-md border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-medium text-text-secondary transition-all duration-150 hover:border-accent-secondary/50 hover:text-accent-secondary disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          Generate Texture
        </button>
        <button
          type="button"
          data-testid="generate-audio"
          disabled={prompt.trim().length === 0 || generating}
          onClick={() => {
            // The click is the user gesture that unlocks the AudioContext.
            resumeAudioContext();
            void generateAudio(prompt);
          }}
          className="rounded-md border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-medium text-text-secondary transition-all duration-150 hover:border-accent-cyan/50 hover:text-accent-cyan disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.98]"
        >
          Ambient Audio
        </button>
      </div>
    </GlassPanel>
  );
}
