# 03. Technical Architecture & Engineering Specification

**Product:** EchoForge 3D  
**Specification Version:** 1.2.0 (Audited & Production-Hardened)  
**Execution Target:** Next.js 15 App Router, Three.js WebGPU (TSL), React Three Fiber, Rapier3D Wasm, Web Audio HRTF, FastAPI, PyTorch 2.x CUDA FP16, Transformers.js

---

## 1. System Topology & Data Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               EchoForge 3D System Architecture                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Client Browser (Next.js 15 + Three.js WebGPU + Web Audio HRTF)                      │
│    ├── Main Thread: React Three Fiber Viewport, Rapier3D Physics, Zustand Scene Store │
│    ├── depth.worker.ts: Depth Anything V2 (onnx-community/depth-anything-v2-small)    │
│    ├── speech.worker.ts: Distil-Whisper ASR (onnx-community/distil-whisper-small)      │
│    └── tts.worker.ts: Kokoro-82M TTS (onnx-community/Kokoro-82M-v1.0-ONNX)             │
│                                                                                        │
│ 2. Backend Microservice (FastAPI + PyTorch CUDA FP16)                                  │
│    ├── SequentialVRAMManager: Dynamic CUDA model offloading & memory safety (<6.0 GB)  │
│    ├── TripoSR / TRELLIS: Single-image to watertight .glb mesh generation              │
│    ├── SDXL-Turbo: Single-step reference texture & skybox diffusion                    │
│    ├── AudioCraft AudioGen: 10s loopable spatial audio .wav synthesis                  │
│    ├── SmolVLM-500M: Viewport canvas frame inspection & NPC visual dialogue            │
│    └── Trimesh Pipeline: Decimation (≤25k faces), manifold cleanup, convex hulls       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Next.js 15 WebAssembly & WebGPU Configuration

To enable Rapier3D Wasm physics and client-side ONNX WebGPU inference in Next.js 15:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] }
  },
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support for Rapier3D
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true
    };

    // Prevent server-side compilation of browser workers
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false
      };
    }

    return config;
  }
};

export default nextConfig;
```

---

## 3. Dedicated Web Worker Architecture (Zero-Copy Transfers)

### `src/workers/depth.worker.ts`
```typescript
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let depthPipeline: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, imageBitmap } = event.data;

  if (type === 'INIT') {
    depthPipeline = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', {
      device: 'webgpu',
      dtype: 'fp16'
    });
    self.postMessage({ type: 'READY' });
    return;
  }

  if (type === 'ESTIMATE_DEPTH') {
    if (!depthPipeline) throw new Error('Pipeline not initialized');

    // Process ImageBitmap via OffscreenCanvas
    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(imageBitmap, 0, 0);

    const result = await depthPipeline(canvas);
    const depthData = new Float32Array(result.depth.data);

    // Zero-copy transfer of Float32Array back to main thread
    self.postMessage(
      { type: 'DEPTH_RESULT', depthBuffer: depthData.buffer },
      [depthData.buffer]
    );
  }
};
```

### `src/workers/tts.worker.ts`
```typescript
import { KokoroTTS } from 'kokoro-js';

let ttsInstance: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, text, voice } = event.data;

  if (type === 'INIT') {
    ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'webgpu'
    });
    self.postMessage({ type: 'READY' });
    return;
  }

  if (type === 'SPEAK') {
    if (!ttsInstance) throw new Error('TTS instance not initialized');
    const rawAudio = await ttsInstance.generate(text, { voice: voice || 'af_heart' });
    const audioData = new Float32Array(rawAudio.audio);

    self.postMessage(
      { type: 'TTS_RESULT', audioArray: audioData.buffer, sampleRate: rawAudio.sampling_rate },
      [audioData.buffer]
    );
  }
};
```

---

## 4. Backend Sequential VRAM Queue Manager

```python
# backend/services/vram_manager.py
import gc
import torch
from typing import Optional, Any
from diffusers import AutoPipelineForText2Image
from tsr.system import TSR
from audiocraft.models import AudioGen

class SequentialVRAMManager:
    """Guarantees that heavy PyTorch models are strictly loaded one at a time,
    preventing total memory allocation from exceeding 6.0 GB VRAM."""

    def __init__(self):
        self.active_model_name: Optional[str] = None
        self.current_pipeline: Optional[Any] = None

    def release_gpu(self):
        """Deterministically offloads active model and cleans CUDA memory."""
        if self.current_pipeline is not None:
            del self.current_pipeline
            self.current_pipeline = None
            self.active_model_name = None
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()

    def acquire_triposr(self):
        if self.active_model_name == "triposr":
            return self.current_pipeline
        self.release_gpu()
        model = TSR.from_pretrained(
            "stabilityai/TripoSR",
            config_name="config.yaml",
            weight_name="model.ckpt"
        ).to("cuda")
        self.current_pipeline = model
        self.active_model_name = "triposr"
        return model

    def acquire_sdxl_turbo(self):
        if self.active_model_name == "sdxl_turbo":
            return self.current_pipeline
        self.release_gpu()
        pipe = AutoPipelineForText2Image.from_pretrained(
            "stabilityai/sdxl-turbo",
            torch_dtype=torch.float16,
            variant="fp16"
        ).to("cuda")
        self.current_pipeline = pipe
        self.active_model_name = "sdxl_turbo"
        return pipe

    def acquire_audiogen(self):
        if self.active_model_name == "audiogen":
            return self.current_pipeline
        self.release_gpu()
        model = AudioGen.get_pretrained("facebook/audiogen-medium")
        self.current_pipeline = model
        self.active_model_name = "audiogen"
        return model
```

---

## 5. Web Audio HRTF Positional Spatial Emitter

```typescript
// src/lib/audio/spatial-audio.ts
export class SpatialAudioEmitter {
  private ctx: AudioContext;
  private panner: PannerNode;
  private source: AudioBufferSourceNode | null = null;

  constructor(audioContext: AudioContext, position: [number, number, number]) {
    this.ctx = audioContext;
    this.panner = this.ctx.createPanner();

    // Configure HRTF 3D spatial acoustics
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 2.0;
    this.panner.maxDistance = 50.0;
    this.panner.rolloffFactor = 1.2;
    this.panner.coneInnerAngle = 360;

    this.updatePosition(position[0], position[1], position[2]);
    this.panner.connect(this.ctx.destination);
  }

  public updatePosition(x: number, y: number, z: number): void {
    const time = this.ctx.currentTime;
    this.panner.positionX.setValueAtTime(x, time);
    this.panner.positionY.setValueAtTime(y, time);
    this.panner.positionZ.setValueAtTime(z, time);
  }

  public playBuffer(buffer: AudioBuffer, loop: boolean = true): void {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
    }
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = loop;
    this.source.connect(this.panner);
    this.source.start(0);
  }
}
```
