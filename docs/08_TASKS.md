# 08. Phased Implementation Roadmap & Master Task Checklist

**Product:** EchoForge 3D  
**Timeline:** 12 Weeks (3 Months)  
**Execution Standard:** Test-Driven Development (TDD) with automated skill triggers & model weight pre-caching

---

## Autonomous Skill Triggering Rule:
The agent MUST automatically consult the **Skill Trigger Matrix in `AGENTS.md`** before beginning any task. For example, before beginning Task 1.1, the agent must execute `01. grill-me` and `03. writing-plans` without waiting for manual user instruction.

---

## Phase 0: Environment Scaffolding, CLI Skill Installation & Model Pre-Caching (Week 1)

- [ ] **Task 0.1: Project Directory Tree & Folder Scaffolding**
  - **Goal:** Create the complete project folder hierarchy and base configuration files.
  - **Exact Actions:**
    - Execute shell command:
      ```bash
      mkdir -p src/app src/components/ui src/components/viewport src/components/canvas
      mkdir -p src/lib src/workers backend/services backend/scripts backend/tests
      mkdir -p docs/plans .audit
      ```
    - Create root `tsconfig.json` with strict mode enabled:
      ```json
      {
        "compilerOptions": {
          "target": "ES2022",
          "lib": ["dom", "dom.iterable", "esnext"],
          "allowJs": true,
          "skipLibCheck": true,
          "strict": true,
          "noEmit": true,
          "esModuleInterop": true,
          "module": "esnext",
          "moduleResolution": "bundler",
          "resolveJsonModule": true,
          "isolatedModules": true,
          "jsx": "preserve",
          "incremental": true,
          "plugins": [{ "name": "next" }],
          "paths": { "@/*": ["./src/*"] }
        },
        "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        "exclude": ["node_modules"]
      }
      ```
    - Create `next.config.js` with WebAssembly and WebGPU experimental flags enabled.
  - **Automated Skills:** `01. grill-me`, `03. writing-plans`
  - **Verification:** Directory tree matches `AGENTS.md` Section 4.

- [ ] **Task 0.2: Autonomous Agent Skills Installation via NPX CLI**
  - **Goal:** Install and verify all 26 procedural skills from remote registries.
  - **Exact Actions:**
    - Execute the NPX package manager commands:
      ```bash
      npx -y skills add obra/superpowers --all -y
      npx -y skills add VoltAgent/awesome-design-md -y
      npx -y skills add Leonxlnx/taste-skill -y
      npx -y skills add pbakaus/impeccable -y
      npx -y skills add vercel-labs/agent-skills --all -y
      npx -y skills add microsoft/playwright-cli -y
      npx -y skills add huggingface/skills --all -y
      npx -y skills add EnzeD/r3f-skills -y
      npx -y skills add dgreenheck/webgpu-claude-skill -y
      npx -y skills add nextlevelbuilder/ui-ux-pro-max-skill -y
      npx -y skills add shadcn/ui -y
      npx -y skills add affaan-m/everything-claude-code -y
      ```
    - Run `npx -y skills list` to verify all 26 skills are active in `.agents/skills/`.
    - *Discovery & Fallback Rule:* If any remote skill fails to download, use `npx -y skills find "<query>"` to locate it online. If unresolvable, extract the skill from `echoforge_3d_master_skills_library.md`.
  - **Verification:** `npx -y skills list` returns exit code 0 with all skills registered.

- [ ] **Task 0.3: Install Codebase Dependencies & GPU Environment Audit**
  - **Goal:** Install frontend npm packages and backend Python requirements.
  - **Exact Actions:**
    - Initialize `package.json` with dependencies:
      - `next@15.0.0`, `react@19.0.0`, `react-dom@19.0.0`, `three@0.170.0`, `@react-three/fiber@8.17.10`, `@react-three/drei@9.117.0`, `@react-three/rapier@1.5.0`, `zustand@5.0.0`, `idb-keyval@6.2.1`, `@huggingface/transformers@3.0.2`, `kokoro-js@1.1.0`, `lucide-react@0.454.0`, `react-resizable-panels@2.1.6`, `tailwind-merge@2.5.4`, `clsx@2.1.1`.
    - Run `pnpm install`.
    - Create `backend/requirements.txt`:
      ```text
      fastapi==0.115.0
      uvicorn[standard]==0.32.0
      torch==2.5.0
      torchvision==0.20.0
      diffusers==0.31.0
      transformers==4.46.0
      accelerate==1.0.1
      trimesh==4.5.1
      pyvista==0.44.1
      audiocraft==1.3.0
      slowapi==0.1.9
      pydantic==2.9.2
      huggingface_hub==0.26.1
      pytest==8.3.3
      ```
    - Run `pip install -r backend/requirements.txt`.
    - Execute CUDA check: `python -c "import torch; print('CUDA Available:', torch.cuda.is_available(), 'Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"`
  - **Verification:** Frontend and backend dependencies install with zero unresolved peer conflicts.

- [ ] **Task 0.4: Backend Open-Weight Model Pre-Caching Script**
  - **Goal:** Create and execute the model pre-caching script to store ~7GB of weights locally.
  - **Exact Actions:**
    - Create `backend/scripts/download_models.py`:
      ```python
      import os
      from huggingface_hub import snapshot_download

      MODELS = [
          {"repo_id": "stabilityai/TripoSR", "allow_patterns": ["*.yaml", "*.ckpt", "*.json"]},
          {"repo_id": "stabilityai/sdxl-turbo", "allow_patterns": ["*.json", "*.safetensors", "*.txt"]},
          {"repo_id": "facebook/audiogen-medium", "allow_patterns": ["*"]},
          {"repo_id": "HuggingFaceTB/SmolVLM-Instruct", "allow_patterns": ["*.json", "*.safetensors", "*.txt"]},
      ]

      def download_all():
          print("Starting EchoForge 3D Model Pre-Caching...")
          for model in MODELS:
              print(f"Downloading {model['repo_id']}...")
              snapshot_download(
                  repo_id=model["repo_id"],
                  allow_patterns=model.get("allow_patterns"),
                  resume_download=True
              )
          print("All open-weight AI models successfully cached locally!")

      if __name__ == "__main__":
          download_all()
      ```
    - Execute: `python backend/scripts/download_models.py`.
  - **Automated Skills:** `17. api-design`, `25. pytorch-vram-queue-manager`
  - **Verification:** Script completes with zero checksum errors; weights exist in `~/.cache/huggingface/hub`.

---

## Phase 1: In-Browser Client & Core 3D Viewport (Weeks 1–4)

- [ ] **Task 1.1: Next.js 15 App Shell & Resizable Split Workstation**
  - **Goal:** Build the main studio UI with Linear + Raycast + Supabase dark glassmorphism.
  - **Exact Actions:**
    - Implement `src/app/layout.tsx` and `src/app/page.tsx`.
    - Configure Tailwind CSS v4 design tokens matching `./DESIGN.md` (Obsidian `#08090a`, frosted glass, emerald glows `#10b981`).
    - Integrate `react-resizable-panels` to build the split-view: Left drawer (25%–40% resizable) and Right 3D Viewport.
    - Add `ResizeObserver` updating camera aspect ratios on panel drag.
  - **Automated Skills:** `07. awesome-design-md`, `09. taste`, `10. impeccable`, `11. creative-studio-ui-styling`, `13. responsive-canvas-layout`, `16. vercel-react-best-practices`
  - **Verification:** `playwright-cli screenshot --filename=.audit/task1.1-layout.png` confirms visual layout matches `./DESIGN.md`.

- [ ] **Task 1.2: Dedicated Web Worker Infrastructure**
  - **Goal:** Build the non-blocking Web Worker pipeline for in-browser machine learning.
  - **Exact Actions:**
    - Create `src/workers/depth.worker.ts`, `src/workers/speech.worker.ts`, and `src/workers/tts.worker.ts`.
    - Implement message handlers using `OffscreenCanvas` and zero-copy `Transferable` `ArrayBuffer` objects.
  - **Automated Skills:** `24. transformers-js-workers`
  - **Verification:** Unit test confirms worker transfers 512x512 Float32Array in <5ms without main thread blocking.

- [ ] **Task 1.3: Client-Side Speech Recognition (Distil-Whisper)**
  - **Goal:** Implement real-time push-to-talk voice dictation.
  - **Exact Actions:**
    - Integrate `onnx-community/distil-whisper-small` in `src/workers/speech.worker.ts`.
    - Build `VoicePill.tsx` with push-to-talk (`<M>` key) and pulsing emerald recording indicator.
    - Connect `MediaRecorder` audio chunk streaming to worker.
  - **Automated Skills:** `24. transformers-js-workers`
  - **Verification:** Speaking test sentence transcribes text in <200ms.

- [ ] **Task 1.4: 2D Topographic Canvas & Heightfield Displacement Engine**
  - **Goal:** Implement real-time 2D elevation sketching to 3D terrain mesh displacement.
  - **Exact Actions:**
    - Build `src/components/canvas/TopographicCanvas.tsx` with HTML5 2D canvas, radial gradient brush math, and radius/intensity sliders.
    - Run `onnx-community/depth-anything-v2-small` in `depth.worker.ts` debounced at 50ms.
    - Create `TerrainMesh.tsx` in Three.js with `PlaneGeometry` (128x128 segments) and TSL displacement material.
    - Integrate `@react-three/drei` `<Bvh>` for accelerated raycasting.
  - **Automated Skills:** `20. r3f-scene-architecture`, `21. webgpu-threejs-tsl`, `23. 2d-topographic-brush-canvas`
  - **Verification:** Drawing strokes on 2D canvas displaces 3D terrain geometry in <100ms.

- [ ] **Task 1.5: Rapier3D Wasm Physics & First-Person Controller**
  - **Goal:** Enable WASD character locomotion across displaced terrain with gravity and collisions.
  - **Exact Actions:**
    - Wrap Three.js viewport in `@react-three/rapier` `<Physics gravity={[0, -9.81, 0]}>`.
    - Generate `<HeightfieldCollider>` directly from terrain elevation Float32Array matrix.
    - Implement `FirstPersonController.tsx` with kinematic character controller, mouse-look, and WASD locomotion.
    - Map `<Tab>` key to toggle between Editor Orbit Mode and First-Person Mode.
  - **Automated Skills:** `25. rapier3d-physics-controller`
  - **Verification:** Pressing `<Tab>` engages pointer lock; character walks and jumps on terrain without falling through floor.

---

## Phase 2: Backend AI Microservice & Optimization (Weeks 5–8)

- [ ] **Task 2.1: FastAPI Gateway Server & Security Configuration**
  - **Goal:** Build the Python backend microservice with CORS and rate-limiting.
  - **Exact Actions:**
    - Implement `backend/main.py` with Uvicorn, health check route (`GET /health`), and SlowAPI rate limiting.
    - Configure CORS middleware restricted to `http://localhost:3000`.
  - **Automated Skills:** `17. api-design`, `07_SECURITY_AND_ENV`
  - **Verification:** `curl http://localhost:8000/health` returns status `200 OK` with CUDA device name.

- [ ] **Task 2.2: Sequential VRAM Queue Manager**
  - **Goal:** Enforce strict sequential GPU model execution under 6.0 GB VRAM.
  - **Exact Actions:**
    - Implement `backend/services/vram_manager.py` with `SequentialVRAMManager` managing `acquire_triposr()`, `acquire_sdxl_turbo()`, and `acquire_audiogen()`.
    - Implement deterministic memory clearing (`del model`, `gc.collect()`, `torch.cuda.empty_cache()`, `torch.cuda.ipc_collect()`).
  - **Automated Skills:** `25. pytorch-vram-queue-manager`
  - **Verification:** `pytest backend/tests/test_vram_manager.py` verifies peak VRAM remains under 6.0 GB during model swaps.

- [ ] **Task 2.3: Image-to-3D Mesh Pipeline (TripoSR)**
  - **Goal:** Generate watertight 3D `.glb` meshes from text prompts or concept images.
  - **Exact Actions:**
    - Implement `POST /api/v1/generate/mesh` running SDXL-Turbo for concept texture and TripoSR for 3D reconstruction.
    - Return asset ID, `.glb` URL, and bounding box extents.
  - **Automated Skills:** `17. api-design`, `25. pytorch-vram-queue-manager`
  - **Verification:** Endpoint returns valid `.glb` file in <3.5 seconds.

- [ ] **Task 2.4: Trimesh Decimation & Collider Baking Pipeline**
  - **Goal:** Automatically clean, decimate, and bake collision hulls for generated 3D meshes.
  - **Exact Actions:**
    - Implement `backend/services/mesh_processor.py` using `trimesh` for quadratic edge collapse decimation (<20,000 faces), Laplacian smoothing, and normal fixing.
    - Compute simplified convex hulls and export clean `.glb` files.
  - **Automated Skills:** `trimesh-gltf-pipeline`
  - **Verification:** Generated meshes load in Three.js without non-manifold errors.

- [ ] **Task 2.5: WebSocket Real-Time Progress Channel**
  - **Goal:** Stream live generation status ticks to the frontend HUD.
  - **Exact Actions:**
    - Implement `WS /ws/v1/generation-feed` broadcasting stage ticks (`DIFFUSION`, `RECONSTRUCTION`, `DECIMATION`).
    - Connect frontend loading pill to WebSocket stream.
  - **Automated Skills:** `17. api-design`
  - **Verification:** Frontend HUD displays live percentage progress during asset generation.

---

## Phase 3: Spatial Audio, Vision NPCs & Engine Exports (Weeks 9–12)

- [ ] **Task 3.1: AudioCraft AudioGen Backend Endpoint**
  - **Goal:** Synthesize loopable environmental sound effects from text prompts.
  - **Exact Actions:**
    - Implement `POST /api/v1/generate/audio` running `facebook/audiogen-medium`.
    - Return 10-second loopable `.wav` binary.
  - **Automated Skills:** `25. pytorch-vram-queue-manager`, `26. web-audio-spatial-hrtf`
  - **Verification:** Endpoint returns valid `.wav` file in <3.0 seconds.

- [ ] **Task 3.2: In-Browser HRTF 3D Spatial Audio Bus**
  - **Goal:** Bind 3D sound emitters to scene objects with camera-synced spatial audio.
  - **Exact Actions:**
    - Implement `src/lib/audio/spatial-audio.ts` with `SpatialAudioEngine` and `SpatialAudioEmitter` using `PannerNode` (HRTF model, inverse distance attenuation).
    - Add user-gesture autoplay unlock listener (`AudioContext.resume()`).
    - Sync listener position and orientation in Three.js `useFrame` loop.
  - **Automated Skills:** `26. web-audio-spatial-hrtf`
  - **Verification:** Moving player character away from audio emitter smoothly attenuates volume.

- [ ] **Task 3.3: Vision-Aware NPC Agent (SmolVLM)**
  - **Goal:** Enable NPC characters to visually inspect the 3D scene and produce contextual dialogue.
  - **Exact Actions:**
    - Implement `POST /api/v1/npc/dialogue` taking WebGL canvas screenshot base64 and persona prompt.
    - SmolVLM inspects image and generates dialogue recognizing nearby props.
  - **Automated Skills:** `17. api-design`, `25. pytorch-vram-queue-manager`
  - **Verification:** Approaching campfire and pressing `<E>` causes NPC to mention the campfire in dialogue.

- [ ] **Task 3.4: In-Browser Neural TTS Speech (Kokoro-82M)**
  - **Goal:** Synthesize neural NPC voice audio in-browser without server latency.
  - **Exact Actions:**
    - Integrate `onnx-community/Kokoro-82M-v1.0-ONNX` inside `tts.worker.ts`.
    - Synthesize 24 kHz audio and play through a 3D audio emitter attached to the NPC mesh.
  - **Automated Skills:** `24. transformers-js-workers`
  - **Verification:** NPC dialogue audio plays through spatial audio emitter at NPC coordinates.

- [ ] **Task 3.5: WebGPU Post-Processing (UnrealBloom & SSAO)**
  - **Goal:** Add cinematic atmosphere, glowing runes, and ambient occlusion.
  - **Exact Actions:**
    - Implement TSL post-processing pipeline in `Viewport3D.tsx` (`pass(scene, camera).pipe(bloom({ threshold: 0.85, strength: 0.6 })).pipe(fxaa())`).
  - **Automated Skills:** `21. webgpu-threejs-tsl`, `22. webgpu-postprocessing-tsl`
  - **Verification:** Glowing materials render bloom effects while maintaining 60 FPS.

- [ ] **Task 3.6: One-Click Engine Export Pipeline**
  - **Goal:** Export complete scenes as standalone HTML web bundles and Godot/Unity `.gltf` scenes.
  - **Exact Actions:**
    - Build `src/lib/export/scene-exporter.ts` packaging Three.js engine and base64 embedded GLTF assets into a single `.html` file.
    - Build `.gltf` scene tree exporter with baked colliders.
  - **Automated Skills:** `18. zustand-3d-scene-store`, `19. indexeddb-asset-cache`
  - **Verification:** Exported HTML file opens offline in any browser and renders the 3D world at 60 FPS.

- [ ] **Task 3.7: End-to-End Performance Profiling & Visual Audits**
  - **Goal:** Perform full visual regression audit and automated test verification.
  - **Exact Actions:**
    - Run `playwright-cli screenshot` across all views and verify against `./DESIGN.md`.
    - Run `pnpm test:e2e` and `pytest backend/tests`.
    - Benchmark WebGPU frame times and verify bundle size <15MB.
  - **Automated Skills:** `14. playwright-cli-visual-qa`, `15. playwright-webgl-testing`, `05. verification-before-completion`
  - **Verification:** 100% test pass rate across all 4 Critical User Journeys.
