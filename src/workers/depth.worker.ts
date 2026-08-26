import { env, pipeline } from '@huggingface/transformers';
import type { DepthResult, WorkerRequest, WorkerResponse } from './workerTypes';

env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Structural pipeline type. The full DepthEstimationPipeline class type is
 * so heavily overloaded it defeats TS's union representation at the call
 * site, so we narrow it here (no `any` involved).
 */
type DepthEstimator = (
  canvas: HTMLCanvasElement | OffscreenCanvas,
) => Promise<{
  predicted_depth: { data: Float32Array; dims: number[] };
}>;

let depthPipeline: DepthEstimator | null = null;

/**
 * Minimal worker-global typing (avoids pulling the webworker lib next to dom).
 * `Window.postMessage(message, targetOrigin)` has a different signature than
 * the worker's `postMessage(message, transfer)`, so we narrow it here.
 */
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

async function runInit(): Promise<void> {
  const instance = await pipeline(
    'depth-estimation',
    'onnx-community/depth-anything-v2-small',
    { device: 'webgpu', dtype: 'fp16' },
  );
  depthPipeline = instance as unknown as DepthEstimator;
}

async function runEstimate(payload: {
  imageBitmap?: ImageBitmap;
}): Promise<DepthResult> {
  if (!depthPipeline) throw new Error('Depth pipeline not initialized');

  const image = payload.imageBitmap;
  if (!image) throw new Error('Missing imageBitmap payload');

  // Draw the bitmap into an OffscreenCanvas (keeps rasterization off the
  // main thread) before running inference.
  const canvas = new OffscreenCanvas(image.width, image.height);
  canvas.getContext('2d')?.drawImage(image, 0, 0);

  const output = await depthPipeline(canvas);
  const predicted = output.predicted_depth;
  const [height, width] = predicted.dims;

  return {
    depth: predicted.data as Float32Array,
    width,
    height,
  };
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, requestId, payload } = event.data;
  try {
    if (type === 'INIT') {
      await runInit();
      ctx.postMessage(
        { type: 'READY', requestId } satisfies WorkerResponse,
        [],
      );
      return;
    }
    if (type === 'ESTIMATE_DEPTH') {
      const result = await runEstimate(payload as { imageBitmap?: ImageBitmap });
      // Zero-copy: transfer the depth buffer, don't clone it.
      ctx.postMessage(
        { type: 'RESULT', requestId, payload: result } satisfies WorkerResponse,
        [result.depth.buffer],
      );
      return;
    }
    ctx.postMessage({
      type: 'ERROR',
      requestId,
      error: `Unknown request type "${type}"`,
    } satisfies WorkerResponse);
  } catch (err) {
    ctx.postMessage({
      type: 'ERROR',
      requestId,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
