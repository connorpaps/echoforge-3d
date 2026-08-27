'use client';

import { useGenerationStore } from '@/lib/stores/useGenerationStore';
import type { AudioResult, MeshResult, TextureResult } from '@/lib/api/generate';

/**
 * Floating glass toasts (docs/02_DESIGN_BRIEF.md §4):
 *  - Error: bottom-right, red hairline border, dismiss + retry.
 *  - Success: bottom-right, emerald hairline border, result summary.
 */
export function ResultToast() {
  const status = useGenerationStore((s) => s.status);
  const kind = useGenerationStore((s) => s.kind);
  const result = useGenerationStore((s) => s.result);
  const errorMessage = useGenerationStore((s) => s.errorMessage);
  const retry = useGenerationStore((s) => s.retry);
  const dismiss = useGenerationStore((s) => s.dismiss);

  if (status === 'error') {
    return (
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
        <div
          data-testid="error-toast"
          role="alert"
          className="pointer-events-auto w-80 rounded-md border border-accent-danger/60 bg-bg-surface p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-accent-danger" />
            <p className="text-xs font-semibold text-text-primary">
              Generation failed
            </p>
          </div>
          <p className="mt-1.5 break-words text-[11px] leading-relaxed text-text-secondary">
            {errorMessage ?? 'Unknown error'}
          </p>
          <div className="mt-2.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-sm border border-border-subtle px-2.5 py-1 text-[11px] text-text-secondary transition-all duration-150 hover:border-border-interactive hover:text-text-primary active:scale-[0.98]"
            >
              Dismiss
            </button>
            <button
              type="button"
              data-testid="retry-button"
              onClick={() => void retry()}
              className="rounded-sm border border-accent-primary/50 px-2.5 py-1 text-[11px] font-medium text-accent-primary transition-all duration-150 hover:border-accent-primary active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success' && result) {
    const title =
      kind === 'texture'
        ? 'Texture ready'
        : kind === 'audio'
          ? 'Ambient ready'
          : 'Mesh ready';
    return (
      <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
        <div
          data-testid="success-toast"
          role="status"
          className="pointer-events-auto w-80 rounded-md border border-accent-primary/50 bg-bg-surface p-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-accent-primary" />
            <p className="text-xs font-semibold text-text-primary">{title}</p>
            {kind === 'texture' ? (
              <TextureThumb result={result as TextureResult} />
            ) : null}
          </div>
          {kind === 'audio' ? (
            <AudioSummary result={result as AudioResult} />
          ) : (
            <MeshSummary result={result as MeshResult} kind={kind} />
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-sm border border-border-subtle px-2.5 py-1 text-[11px] text-text-secondary transition-all duration-150 hover:border-border-interactive hover:text-text-primary active:scale-[0.98]"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function TextureThumb({ result }: { result: TextureResult }) {
  return (
    // base64 data URL straight from the backend — not optimizable
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-testid="texture-thumb"
      src={`data:image/png;base64,${result.imageBase64}`}
      alt="Generated texture preview"
      className="ml-auto size-9 rounded-sm border border-border-subtle object-cover"
    />
  );
}

function AudioSummary({ result }: { result: AudioResult }) {
  return (
    <p className="mt-1.5 font-mono text-[11px] tabular-nums text-text-telemetry">
      {result.synthetic ? 'Procedural fallback' : 'AudioGen'} · loopable WAV
    </p>
  );
}

function MeshSummary({
  result,
  kind,
}: {
  result: MeshResult;
  kind: 'mesh' | 'texture' | 'audio' | null;
}) {
  if (kind !== 'mesh' || result.faceCount === undefined) return null;
  const seconds = (result.elapsedMs / 1000).toFixed(1);
  return (
    <p className="mt-1.5 font-mono text-[11px] tabular-nums text-text-telemetry">
      {result.faceCount.toLocaleString()} faces ·{' '}
      {result.vertexCount.toLocaleString()} verts · {seconds}s
    </p>
  );
}
