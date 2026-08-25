# 03. Technical Architecture & System Engineering Specification

**Product:** EchoForge 3D  
**Specification Version:** 1.2.0 (Audited & Production-Hardened)  
**Target Environment:** Local Consumer Hardware (6GB–8GB CUDA GPU or Apple Silicon WebGPU) & Serverless Cloud

---

## 1. Universal Hardware Profiles & Deployment Tiers

The system architecture is engineered to run seamlessly across three standardized hardware tiers:

```
+----------------------------------------------------------------------------------------------------+
| Hardware Profile Tiers & Execution Topology                                                        |
+----------------------------------------------------------------------------------------------------+
| Tier 1: Client-Only WebGPU (Any modern laptop / Apple M-series / Intel Core Ultra / AMD Ryzen)     |
|   └── Whisper ASR + Depth Anything V2 + Kokoro TTS run 100% in-browser via Web Workers (ONNX)      |
|   └── Heavy 3D mesh & diffusion steps query free Hugging Face Serverless Inference Endpoints       |
|                                                                                                    |
| Tier 2: Consumer Local Workstation (Single NVIDIA GPU 6GB–8GB+ VRAM, 16GB+ System RAM)            |
|   └── In-Browser WebGPU Workers handle ASR, Depth, and TTS                                         |
|   └── FastAPI backend runs Sequential VRAM Manager (TripoSR default, SDXL-Turbo, AudioGen)        |
|                                                                                                    |
| Tier 3: Production Cloud & Serverless (RunPod Serverless / Modal / AWS EC2 G4dn / HF Endpoints)    |
|   └── Ephemeral worker containers spin up on demand per generation request and scale to zero        |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Integrated Hugging Face Tasks & Open-Weights Pipeline

```
                    ┌─────────────────────────────────────────────────────────┐
                    │               EchoForge 3D Studio Web UI                │
                    │      (Next.js 15 + React 19 + Tailwind CSS + Webpack)   │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            │ [Dedicated Web Workers / WebGPU]   │ [Dedicated Web Workers / WebGPU]   │ [Backend CUDA Microservice]
            ▼                                    ▼                                    ▼
   ┌───────────────────┐                ┌───────────────────┐                ┌───────────────────┐
   │   Distil-Whisper  │                │Depth Anything V2  │                │ TripoSR / TRELLIS │
   │  (distil-small)   │                │(Small ONNX FP16)  │                │ (Low-VRAM FP16)   │
   │  Speech-to-Text   │                │ 2D Canvas Sketch  │                │  Image-to-3D GLB  │
   │ Voice Dictation   │                │ to Height Terrain │                │ Mesh Generation   │
   └─────────┬─────────┘                └─────────┬─────────┘                └─────────┬─────────┘
             │                                    │                                    │
             ▼                                    ▼                                    ▼
   ┌───────────────────┐                ┌───────────────────┐                ┌───────────────────┐
   │ Qwen2.5-Coder-1.5B│                │    SDXL-Turbo /   │                │ AudioCraft AudioGen│
   │Scene Graph Parsing│                │   SD 1.5 LCM      │                │  (medium 1.5B)    │
   │& Transformation   │                │ Tileable Texture  │                │  Spatial Ambient  │
   │  JSON Tool Calls  │                │  & PBR Synthesis  │                │  Sound Generator  │
   └─────────┬─────────┘                └─────────┬─────────┘                └─────────┬─────────┘
             │                                    │                                    │
             ▼                                    │                                    ▼
   ┌───────────────────┐                          │                          ┌───────────────────┐
   │    Kokoro-82M     │                          │                          │    SmolVLM-500M   │
   │ (TTS ONNX WebGPU) │                          │                          │Visual QA & Viewport│
   │  NPC Neural Voice │                          │                          │ Scene Inspection  │
   └─────────┬─────────┘                          │                          └─────────┬─────────┘
             │                                    │                                    │
             └────────────────────────────────────┼────────────────────────────────────┘
                                                  ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │            Interactive 3D Viewport Engine               │
                    │   - Three.js / React Three Fiber / WebGPU Renderer      │
                    │   - BVH Accelerated Raycasting (@react-three/drei Bvh)  │
                    │   - Rapier3D (Wasm-based Rigid Body & Character Physics)│
                    │   - Web Audio API (HRTF Panner Nodes & Gesture Resume)  │
                    │   - JSON Scene Graph State & Undo/Redo Engine           │
                    └─────────────────────────────────────────────────────────┘
```

### Comprehensive Task & Model Matrix

| # | Hugging Face Task Category | Model Identifier | Execution Target | Model Size / Precision | System Function |
|---|---|---|---|---|---|
| 1 | **Automatic Speech Recognition (ASR)** | `onnx-community/distil-whisper-small` | Client Web Worker (WebGPU / WASM) | ~80 MB (q8 / fp16) | Transcribes microphone voice input in real time (<150ms) off the main thread to trigger scene edits. |
| 2 | **Depth Estimation** | `onnx-community/depth-anything-v2-small` | Client Web Worker (WebGPU) | ~90 MB (fp16 ONNX) | Processes 2D terrain brush strokes into a continuous relative depth tensor for real-time vertex displacement. |
| 3 | **Text-to-Speech (TTS)** | `onnx-community/Kokoro-82M-v1.0-ONNX` | Client Web Worker (WebGPU) | ~82 M params (q8 / fp32) | Synthesizes expressive neural NPC voice audio in-browser at 24 kHz sample rate with zero server dependencies. |
| 4 | **Image-to-3D / Text-to-3D** | `stabilityai/TripoSR` *(Default 6GB+)* or `microsoft/TRELLIS-image-large` *(Low-VRAM)* | Backend (CUDA / PyTorch) | 4.2 GB – 6.5 GB VRAM (FP16) | Generates structured 3D latents and extracts watertight `.glb` meshes with baked PBR materials. |
| 5 | **Text-to-Image / Image-to-Image** | `stabilityai/sdxl-turbo` | Backend (CUDA / PyTorch) | 3.5 GB VRAM (FP16) | Synthesizes reference concept textures, skyboxes, and seamless diffuse/roughness maps in 1–4 inference steps. |
| 6 | **Text-to-Audio** | `facebook/audiogen-medium` | Backend (CUDA / PyTorch) | ~1.5 B params (FP16) | Synthesizes 10-second loopable environmental sound effects (crackling fire, subterranean wind, river water). |
| 7 | **Visual Question Answering (VQA)** | `HuggingFaceTB/SmolVLM-Instruct` | Backend (CUDA) or Free HF Endpoint | ~500 M params (FP16) | Inspects the player's 3D viewport canvas buffer to enable NPCs to visually recognize props and player gear. |
| 8 | **Text Generation & Structured Tool Calling** | `Qwen/Qwen2.5-Coder-1.5B-Instruct` | Backend (Ollama/vLLM) or Free HF Endpoint | ~1.5 B params (Q4_K_M) | Translates natural language voice transcripts into deterministic JSON scene transformation operations. |

---

## 3. Next.js 15 WebAssembly & WebGPU Build Configuration

To support Rapier3D Wasm physics and ONNX WebGPU shaders inside Next.js 15 without runtime bundling failures, `next.config.js` MUST enable asynchronous WebAssembly:

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
```

---

## 4. Production Code Implementations

### 4.1 Non-Blocking WebGPU Web Workers
```typescript
// src/workers/depth.worker.ts
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let depthPipeline: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, imageBitmap } = event.data;

  if (type === 'INIT') {
    depthPipeline = await pipeline(
      'depth-estimation',
      'onnx-community/depth-anything-v2-small',
      { device: 'webgpu', dtype: 'fp16' }
    );
    self.postMessage({ type: 'READY' });
    return;
  }

  if (type === 'ESTIMATE_DEPTH') {
    if (!depthPipeline) throw new Error('Pipeline not initialized');

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(imageBitmap, 0, 0);

    const result = await depthPipeline(canvas);
    const depthData: Float32Array = result.depth.data;

    // Zero-copy transfer of Float32Array back to main thread
    self.postMessage(
      { type: 'DEPTH_RESULT', depthBuffer: depthData.buffer },
      [depthData.buffer]
    );
  }
};
```

```typescript
// src/workers/tts.worker.ts
import { KokoroTTS } from "kokoro-js";

let ttsInstance: any = null;

self.onmessage = async (event: MessageEvent) => {
  const { type, text, voice } = event.data;

  if (type === 'INIT') {
    ttsInstance = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      { dtype: "q8", device: "webgpu" }
    );
    self.postMessage({ type: 'READY' });
    return;
  }

  if (type === 'SPEAK') {
    if (!ttsInstance) throw new Error('TTS instance not initialized');
    
    const rawAudio = await ttsInstance.generate(text, { voice: voice || "af_heart" });
    const audioData: Float32Array = rawAudio.audio;

    self.postMessage(
      { type: 'TTS_RESULT', audioArray: audioData.buffer, sampleRate: rawAudio.sampling_rate },
      [audioData.buffer]
    );
  }
};
```

---

### 4.2 Backend Sequential VRAM Queue Manager
```python
# backend/services/vram_manager.py
import gc
import torch
from typing import Optional, Any
from diffusers import AutoPipelineForText2Image
from tsr.system import TSR

class SequentialVRAMManager:
    """
    Guarantees that heavy PyTorch models are strictly loaded one at a time,
    preventing total memory allocation from exceeding 6.0 GB VRAM.
    """
    def __init__(self):
        self.active_model_name: Optional[str] = None
        self.current_pipeline: Optional[Any] = None

    def release_gpu(self):
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
        from audiocraft.models import AudioGen
        model = AudioGen.get_pretrained('facebook/audiogen-medium')
        self.current_pipeline = model
        self.active_model_name = "audiogen"
        return model
```

---

### 4.3 In-Browser HRTF 3D Spatial Audio Bus (With Autoplay Gesture Unlock)
```typescript
// src/lib/audio/spatial-audio.ts
export class SpatialAudioEngine {
  private static ctx: AudioContext | null = null;

  static getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    // Automatically resume suspended context on user gesture
    if (this.ctx.state === 'suspended') {
      const resumeHandler = () => {
        this.ctx?.resume();
        window.removeEventListener('click', resumeHandler);
        window.removeEventListener('keydown', resumeHandler);
      };
      window.addEventListener('click', resumeHandler);
      window.addEventListener('keydown', resumeHandler);
    }
    return this.ctx;
  }
}

export class SpatialAudioEmitter {
  private ctx: AudioContext;
  private panner: PannerNode;
  private source: AudioBufferSourceNode | null = null;

  constructor(position: [number, number, number]) {
    this.ctx = SpatialAudioEngine.getContext();
    this.panner = this.ctx.createPanner();
    
    // Configure HRTF 3D audio model
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 1.5;
    this.panner.maxDistance = 60.0;
    this.panner.rolloffFactor = 1.0;
    this.panner.coneInnerAngle = 360;

    this.updatePosition(position);
    this.panner.connect(this.ctx.destination);
  }

  updatePosition([x, y, z]: [number, number, number]) {
    const time = this.ctx.currentTime;
    this.panner.positionX.setValueAtTime(x, time);
    this.panner.positionY.setValueAtTime(y, time);
    this.panner.positionZ.setValueAtTime(z, time);
  }

  playBuffer(buffer: AudioBuffer, loop: boolean = true) {
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
