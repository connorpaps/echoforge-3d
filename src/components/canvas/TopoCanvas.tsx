'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { SectionLabel } from '@/components/ui/SectionLabel';
import {
  applyElevationBrush,
  buildHeightmap,
  clearElevation,
  invertElevation,
  isElevationBlank,
} from '@/lib/terrain/heightmap';
import { useSceneStore } from '@/lib/stores/useSceneStore';
import { useWorker } from '@/lib/workers/useWorker';
import type { DepthResult } from '@/workers/workerTypes';
import { cn } from '@/lib/utils';

const BUFFER_SIZE = 256;
const DEBOUNCE_MS = 50;

/** Rasterize the elevation buffer to grayscale ImageData for the canvas. */
function rasterizeElevation(elevation: Float32Array, size: number): ImageData {
  const image = new ImageData(size, size);
  const data = image.data;
  for (let i = 0; i < elevation.length; i++) {
    const v = Math.round(elevation[i] * 255);
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  return image;
}

/**
 * 2D topographic canvas (docs/02 §3.1): radial elevation brush painting a
 * grayscale buffer, debounced 50ms, dispatched to depth.worker which
 * returns a Float32Array heightmap for the TSL-displaced terrain mesh.
 */
export function TopoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elevationRef = useRef(new Float32Array(BUFFER_SIZE * BUFFER_SIZE));
  const drawingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brush, setBrush] = useState({ radius: 24, height: 0.8 });

  const { request, status: workerStatus } = useWorker('depth');

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return; // jsdom renders the stub without a context
    ctx.putImageData(
      rasterizeElevation(elevationRef.current, BUFFER_SIZE),
      0,
      0,
    );
  }, []);

  const dispatch = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // An empty elevation buffer (e.g., after Clear) means no terrain.
    if (isElevationBlank(elevationRef.current)) {
      useSceneStore.getState().setTerrainHeightmap(null);
      return;
    }
    try {
      const imageBitmap = await createImageBitmap(canvas);
      const result = await request<DepthResult>('ESTIMATE_DEPTH', {
        imageBitmap,
      });
      const heightmap = buildHeightmap(
        result.depth,
        result.width,
        result.height,
      );
      useSceneStore.getState().setTerrainHeightmap(heightmap);
    } catch (err) {
      console.error('[topo-canvas] depth estimation failed', err);
    }
  }, [request]);

  const scheduleDispatch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void dispatch(), DEBOUNCE_MS);
  }, [dispatch]);

  useEffect(() => {
    redraw();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [redraw]);

  const paintAt = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const cx = ((event.clientX - rect.left) / rect.width) * BUFFER_SIZE;
      const cy = ((event.clientY - rect.top) / rect.height) * BUFFER_SIZE;
      applyElevationBrush(
        elevationRef.current,
        BUFFER_SIZE,
        cx,
        cy,
        brush.radius,
        brush.height,
      );
      redraw();
      scheduleDispatch();
    },
    [brush, redraw, scheduleDispatch],
  );

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    drawingRef.current = true;
    paintAt(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawingRef.current) paintAt(event);
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const handleClear = () => {
    clearElevation(elevationRef.current);
    redraw();
    scheduleDispatch();
  };

  const handleInvert = () => {
    invertElevation(elevationRef.current);
    redraw();
    scheduleDispatch();
  };

  const aiReady = workerStatus === 'ready';
  const workerMessage =
    workerStatus === 'error'
      ? 'AI worker failed. Terrain will remain available for drawing; try refreshing to retry.'
      : aiReady
        ? 'AI worker is ready. Draw on the canvas to create terrain.'
        : 'AI worker is loading. You can draw while it prepares.';

  return (
    <div className="p-3">
      <div className="flex items-center justify-between">
        <SectionLabel>2D Topographic Canvas</SectionLabel>
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-wider',
            workerStatus === 'error'
              ? 'text-accent-danger'
              : aiReady
                ? 'text-accent-primary'
                : 'animate-pulse text-text-muted',
          )}
        >
          AI: {workerStatus === 'error' ? 'error' : aiReady ? 'ready' : 'loading…'}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        data-testid="topo-canvas"
        role="img"
        aria-label="Topographic terrain drawing surface"
        aria-describedby="topo-canvas-instructions topo-canvas-status"
        width={BUFFER_SIZE}
        height={BUFFER_SIZE}
        className="mt-2 aspect-square w-full cursor-crosshair touch-none rounded-sm border border-border-subtle bg-bg-subtle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <p id="topo-canvas-instructions" className="sr-only">
        Draw with a pointer to raise terrain. Adjust radius and height, then use
        Clear or Invert as needed.
      </p>
      <p
        id="topo-canvas-status"
        role={workerStatus === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className="sr-only"
      >
        {workerMessage}
      </p>

      <div className="mt-2 space-y-2">
        <label className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
          <span>Radius</span>
          <input
            data-testid="brush-radius"
            type="range"
            min={8}
            max={128}
            value={brush.radius}
            onChange={(e) =>
              setBrush((b) => ({ ...b, radius: Number(e.target.value) }))
            }
            className="h-1 w-28 accent-accent-primary"
          />
          <span className="w-10 text-right font-mono text-text-telemetry">
            {brush.radius}
          </span>
        </label>

        <label className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
          <span>Height</span>
          <input
            data-testid="brush-height"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={brush.height}
            onChange={(e) =>
              setBrush((b) => ({ ...b, height: Number(e.target.value) }))
            }
            className="h-1 w-28 accent-accent-primary"
          />
          <span className="w-10 text-right font-mono text-text-telemetry">
            {brush.height.toFixed(2)}
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            data-testid="clear-elevation"
            onClick={handleClear}
            className="flex-1 rounded-sm border border-border-subtle bg-bg-elevated py-1 text-[11px] text-text-secondary transition-all duration-150 hover:border-border-interactive hover:text-text-primary active:scale-[0.98]"
          >
            Clear
          </button>
          <button
            type="button"
            data-testid="invert-elevation"
            onClick={handleInvert}
            className="flex-1 rounded-sm border border-border-subtle bg-bg-elevated py-1 text-[11px] text-text-secondary transition-all duration-150 hover:border-border-interactive hover:text-text-primary active:scale-[0.98]"
          >
            Invert
          </button>
        </div>
      </div>
    </div>
  );
}
