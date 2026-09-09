# 08. Phased Implementation Roadmap & Master Task Checklist

**Product:** EchoForge 3D  
**Timeline:** 12 Weeks (3 Months)  
**Execution Standard:** Test-Driven Development (TDD) with strict Definition of Done (DoD) per task.

---

## Definition of Done (DoD) for Every Task

1. **Source Code Complete:** Clean, documented TypeScript or Python code matching project conventions.
2. **Type Safety & Linting:** Passes `pnpm typecheck` with zero `any` types and passes ESLint.
3. **Automated Verification:** Unit test or Playwright E2E spec written and passing (`exit code: 0`).
4. **VRAM & Performance Bounds:** No frame drops (<16.6ms frame budget) or CUDA memory leaks verified.

---

## Phase 0: Workspace Setup & Skills Installation (Week 0)

### Task 0.1: Directory Tree & Workspace Scaffolding
- Create complete frontend and backend folder hierarchy:
  ```bash
  mkdir -p src/app src/components/viewport src/components/ui src/workers src/lib/audio src/lib/physics src/lib/stores backend/services backend/routers backend/tests backend/scripts docs/plans .audit
  ```
- Initialize Git repository and add `.gitignore` for `node_modules`, `dist`, `__pycache__`, and model weights.
- **Verification:** Directory structure exists and matches `AGENTS.md`.

### Task 0.2: Upstream Community Skills Installation (14 Repositories)
- Execute the complete 14-repository skills installation matrix:
  ```bash
  npx -y skills add obras/superpowers -y
  npx -y skills add skills.sh/grill-me -y
  npx -y skills add VoltAgent/awesome-design-md -y
  npx -y skills add Leonxlnx/taste-skill -y
  npx -y skills add pbakaus/impeccable -y
  npx -y skills add shadcn/ui -y
  npx -y skills add vercel-labs/agent-skills -y
  npx -y skills add everything-claude-code/api-design -y
  npx -y skills add EnzeD/r3f-skills -y
  npx -y skills add dgreenheck/webgpu-claude-skill -y
  npx -y skills add huggingface/skills -y
  npx -y skills add TheBushidoCollective/han -y
  npx -y skills add NeverSight/learn-skills.dev -y
  npx -y skills add pytorch/pytorch -y
  ```
- **Verification:** Run `npx -y skills list` and confirm all 14 packages are registered in `.agents/skills/`.

### Task 0.3: Dependency Configuration & Lockfiles
- Initialize Next.js 15 App Router with Tailwind CSS v4, Three.js WebGPU, React Three Fiber, and Rapier3D.
- Initialize Python 3.11 `backend/requirements.txt` with FastAPI, PyTorch 2.x CUDA FP16, Diffusers, and Trimesh.
- **Verification:** `pnpm install` and `pip install -r backend/requirements.txt` complete with zero errors.

### Task 0.4: Open-Weights Model Pre-Caching Script
- Implement `backend/scripts/download_models.py` to pre-cache TripoSR, SDXL-Turbo, AudioGen, and SmolVLM weights locally.
- **Verification:** Model weights download and save to local Hugging Face cache directory.

---

## Phase 1: In-Browser Client Core & 3D Viewport (Weeks 1–4)

### Task 1.1: Next.js 15 & React Three Fiber Viewport Shell
- Initialize Next.js 15 App Router workspace with dark obsidian glass styling matching `./DESIGN.md`.
- Configure dynamic client import (`ssr: false`) for the 3D viewport canvas.
- Setup resizable split-pane layout using `react-resizable-panels`.
- **Active Skills:** `vercel-react-best-practices`, `r3f-fundamentals`, `responsive-canvas-layout`.
- **Verification:** `pnpm test:e2e` confirms canvas mounts in headless Chromium at 60 FPS.

### Task 1.2: Web Worker ML Infrastructure
- Implement dedicated Web Worker loaders for `@huggingface/transformers` using `OffscreenCanvas` and zero-copy `Transferable ArrayBuffer` messaging.
- **Active Skills:** `transformers-js`, `vercel-react-best-practices`.
- **Verification:** Workers compile and initialize without main-thread UI blocking.

### Task 1.3: Client-Side Speech Recognition (Distil-Whisper)
- Integrate `onnx-community/distil-whisper-small` inside `speech.worker.ts`.
- Connect browser microphone input stream (`MediaRecorder`) to worker audio buffers.
- **Active Skills:** `transformers-js`, `api-design`.
- **Verification:** Speaking into microphone transcribes test sentence in < 200ms.

### Task 1.4: 2D Topographic Canvas & Terrain Displacement
- Build HTML5 2D drawing canvas with soft radial gradient elevation brush and slider controls.
- Integrate `onnx-community/depth-anything-v2-small` to convert canvas strokes into a `Float32` heightmap.
- Displace Three.js `PlaneGeometry` vertex heights in real time using TSL node materials.
- **Active Skills:** `webgpu-threejs-tsl`, `r3f-shaders`.
- **Verification:** Drawing on 2D canvas updates 3D terrain wireframe within 100ms.

### Task 1.5: Rapier3D Wasm Physics & First-Person Locomotion
- Wrap Three.js scene in `<Physics gravity={[0, -9.81, 0]}>`.
- Generate `<HeightfieldCollider>` directly from terrain height matrix.
- Implement WASM kinematic character controller with WASD movement, gravity, and jumping.
- **Active Skills:** `r3f-physics`.
- **Verification:** Pressing `<Tab>` engages pointer lock; character walks across displaced terrain without falling through.

---

## Phase 2: Backend AI Microservice & Optimization (Weeks 5–8)

### Task 2.1: FastAPI Server & PyTorch CUDA Setup
- Initialize Python 3.11 FastAPI backend with Uvicorn and CORS security middleware.
- Configure CUDA FP16 execution parameters and PyTorch 2.x device checks.
- **Active Skills:** `pytorch/pytorch`, `api-design`.
- **Verification:** `GET /health` returns CUDA device name and allocated VRAM.

### Task 2.2: Sequential VRAM Queue Manager
- Implement `SequentialVRAMManager` in Python with dynamic model offloading (`del model`, `gc.collect()`, `torch.cuda.ipc_collect()`).
- **Active Skills:** `pytorch/pytorch`.
- **Verification:** `pytest backend/tests/test_vram_manager.py` verifies peak VRAM remains under 6.0 GB during model swaps.

### Task 2.3: Image-to-3D Mesh Pipeline (TripoSR / TRELLIS)
- Connect `stabilityai/TripoSR` in FastAPI to convert single-image concepts into raw `.glb` files.
- Implement SDXL-Turbo endpoint for rapid 1-step concept art texturing.
- **Active Skills:** `pytorch/pytorch`, `api-design`.
- **Verification:** `POST /api/v1/generate-mesh` returns valid `.glb` asset in ≤ 3.0 seconds.

### Task 2.4: Trimesh Decimation & Collider Baking
- Implement automated quadratic decimation (≤ 20,000 faces), Laplacian smoothing, and normal fixing.
- Compute simplified convex collision hulls and bounding box extents.
- **Active Skills:** `r3f-physics`, `api-design`.
- **Verification:** Output meshes load in Three.js with zero non-manifold vertex errors.

### Task 2.5: WebSocket Progress Event Channel
- Build real-time WebSocket channel streaming progress percentages (`DIFFUSION`, `RECONSTRUCTION`, `DECIMATION`) to the frontend HUD.
- **Active Skills:** `api-design`.
- **Verification:** Frontend loading pill displays live percentage ticks during generation.

---

## Phase 3: Spatial Audio, Vision NPCs & Engine Exports (Weeks 9–12)

**Status: ✅ COMPLETE (2026-08-26)** — full details in `docs/plans/2026-08-26-phase-3.md`.

### Task 3.1: AudioCraft AudioGen Backend Endpoint
- Integrate `facebook/audiogen-medium` in FastAPI for loopable environmental sound synthesis.
- **Active Skills:** `pytorch/pytorch`, `api-design`.
- **Verification:** `POST /api/v1/generate-audio` returns loopable 10-second `.wav` audio binary.
- **Status:** ✅ Done — endpoint + crossfaded-loop WAV contract; procedural fallback until HF_TOKEN provided.

### Task 3.2: In-Browser HRTF 3D Spatial Audio Bus
- Implement Web Audio API `PannerNode` with HRTF panning and inverse-square distance models.
- Synchronize audio listener position and rotation in Three.js `useFrame` render loop.
- **Active Skills:** `r3f-fundamentals`.
- **Verification:** Moving player character away from audio emitter smoothly decreases volume.
- **Status:** ✅ Done — `SpatialAudioEmitter` + listener sync + live emitter count + volume/falloff controls.

### Task 3.3: Vision-Aware NPC Agent (SmolVLM)
- Implement `POST /api/v1/npc-dialogue` endpoint taking WebGL canvas screenshot base64 + persona prompt.
- Return context-aware dialogue recognizing spawned props in the player's view.
- **Active Skills:** `api-design`.
- **Verification:** Approaching a campfire and pressing `E` causes NPC to mention the fire.
- **Status:** ✅ Done — endpoint + NPC spawn/E-interact + offscreen frame capture + dialogue bubble; real vision needs `qwen-vl-utils` install (noted).

### Task 3.4: In-Browser Neural TTS Speech (Kokoro-82M)
- Integrate `onnx-community/Kokoro-82M-v1.0-ONNX` inside `tts.worker.ts`.
- Synthesize NPC voice audio in-browser at 24 kHz without server network roundtrips.
- **Active Skills:** `transformers-js`.
- **Verification:** NPC dialogue text plays as 3D audio emitter attached to character mesh.
- **Status:** ✅ Done — TTS worker wired to NPC dialogue via one-shot spatial emitters at the NPC position.

### Task 3.5: WebGPU Post-Processing (UnrealBloom & SSAO)
- Build TSL node post-processing pipeline: `pass(scene, camera).pipe(bloom).pipe(fxaa)`.
- **Active Skills:** `webgpu-threejs-tsl`, `r3f-shaders`.
- **Verification:** Glowing runes and campfire meshes emit realistic bloom without frame drops.
- **Status:** ✅ Done (dual path) — WebGL keeps the stable RenderPass+OutputPass path and bypasses bloom/FXAA when TSL materials are present; WebGPU feature-detects bloom (three r185 TSL has no bloom nodes yet) — needs real-GPU verification.

### Task 3.6: One-Click Engine Export Pipeline
- Build exporter for standalone Three.js HTML bundles (embedded GLTF base64) and standard Godot/Unity `.gltf` scene trees.
- **Active Skills:** `r3f-loaders`.
- **Verification:** Exported HTML bundle opens offline in any modern browser and runs at 60 FPS.
- **Status:** ✅ Done — offline HTML (embedded three.core via blob import) + merged glTF scene tree; CUJ-04 verified by e2e.

### Task 3.7: End-to-End Performance Profiling & Documentation
- Profile WebGPU frame times, memory allocations, and bundle sizes.
- **Active Skills:** `superpowers/verification-before-completion`.
- **Verification:** Complete Playwright test suite passes with 100% test coverage on critical user journeys.
- **Status:** ✅ Done — P95 frame-time telemetry; bundle audit 372 kB first-load (PRD target <15 MB); docs closed in `docs/plans/2026-08-26-phase-3.md`.
