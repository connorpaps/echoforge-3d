# EchoForge 3D

<div align="center">

### Local-first AI worldbuilding for the browser

Turn a reference image into a usable 3D asset, sketch terrain, add spatial interactions, and export a portable scene. EchoForge combines browser-based 3D rendering with a locally orchestrated GPU generation pipeline built for an 8 GB RTX 2070.

[![CI](https://github.com/connorpaps/echoforge-3d/actions/workflows/ci.yml/badge.svg)](https://github.com/connorpaps/echoforge-3d/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-148%20frontend%20%7C%2089%20backend-0f766e)](https://github.com/connorpaps/echoforge-3d)
[![License](https://img.shields.io/badge/license-MIT-10b981.svg)](LICENSE)

</div>

> **Portfolio project:** a local-first multimodal 3D workstation demonstrating GPU orchestration, browser 3D, physics, spatial audio, persistence, and production-minded validation in one coherent application.

![EchoForge 3D Hunyuan3D bishop turntable](docs/assets/bishop-turntable.gif)

*Verified local render of a Hunyuan3D-2GP output after EchoForge mesh processing. The turntable shows the full GLB asset and its validation metadata; it is not a claim of perfect single-image reconstruction.*

![EchoForge live Hunyuan3D workflow](docs/assets/echoforge-hunyuan-live.png)

*Live 1440×900 workstation capture: a synthetic chair fixture went through Hunyuan3D-2GP, entered the scene, and reached the mesh-ready state. FX is disabled in this evidence frame so the dark vertex-colored mesh remains readable; the fixture is intentionally synthetic and not user data.*

## Why this project is worth opening

EchoForge is not just a prompt box around an API. It solves the difficult parts around AI-generated 3D:

- **GPU-constrained orchestration:** heavyweight models are serialized through a VRAM manager instead of competing for an 8 GB card.
- **Asset quality control:** generated meshes are sanitized, oriented, grounded, decimated, collision-processed, shaded, and exported as GLB.
- **Real interactive output:** the result enters a React Three Fiber scene with terrain, Rapier physics, spatial audio, NPC dialogue, and first-person movement.
- **Resilient local UX:** uploads are validated, failed GLBs expose retry/remove actions, projects persist locally, and provider failures have explicit fallback behavior.
- **Visible runtime truth:** the workstation provider panel reports the selected mesh provider, optional model paths, browser workers, and active fallbacks from the local health endpoint.
- **Honest capability boundaries:** optional, experimental, synthetic, and hardware-dependent paths are documented instead of being presented as equal-quality production features.

## Product loop

```text
Reference image
      ↓
Validated upload → Hunyuan3D-2GP or TripoSR → mesh processing → GLB
      ↓                                                   ↓
Terrain sketch → browser 3D workstation ← Save / Load project
      ↓                                                   ↓
Play mode, physics, audio, NPC dialogue             Standalone export
```

## Engineering highlights

| Area | Implementation |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| 3D runtime | React Three Fiber, Three.js, WebGL2, experimental WebGPU path |
| Physics | Rapier3D heightfield terrain and first-person movement |
| Mesh generation | Hunyuan3D-2GP sidecar with TripoSR fallback |
| GPU safety | `SequentialVRAMManager`, one heavy model at a time, watchdog deadlines |
| Mesh processing | Component cleanup, orientation, grounding, decimation, normals, colors, collision hulls, GLB validation |
| Browser ML | Dedicated workers for depth, speech transcription, and Kokoro TTS |
| Persistence | Versioned scene snapshots plus IndexedDB-backed local assets |
| Backend | FastAPI, structured routes, progress WebSocket, input limits, safe errors, rate limits |
| Export | Standalone HTML and GLTF-compatible scene output |

## Verified results

The current local verification baseline is:

- **148 frontend unit tests** across 32 test files
- **89 backend tests** using the project Python environment
- **21/21 Playwright journeys** using the hermetic fixture-backed browser mode
- TypeScript typecheck, ESLint, production build, YAML validation, and `git diff --check` passing
- Real chair and bishop generation outputs previously validated for connected geometry, watertightness, grounding, normals, colors, and the 20,000-face application cap

The automated browser suite intentionally does not claim to prove CUDA quality or perceptual reconstruction quality. Real GPU evidence is documented separately when captured.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Browser                                                     │
│ Next.js + React + R3F/Three.js                              │
│                                                             │
│  Workstation     Terrain canvas       Web Workers            │
│  Scene editor    First-person mode    Depth / speech / TTS   │
│       │                 │                    │                │
│       └─────────────── localhost:8000 REST + WS ────────────┘
│                              │
│                       FastAPI backend
│                              │
│                    SequentialVRAMManager
│                    one heavy model at a time
│             ┌────────────────┼────────────────┐
│             │                │                │
│          TripoSR         SDXL-Turbo       Audio / NPC
│          mesh fallback   textures         optional paths
│                              │
│                    optional :8081 sidecar
│                         Hunyuan3D-2GP
└─────────────────────────────────────────────────────────────┘
```

## Capability status

The maintained matrix is in [`docs/capability-matrix.md`](docs/capability-matrix.md). The short version:

- **Ready local paths:** terrain sketching, image-to-mesh plumbing, selectable scene editing, GLB export, first-person terrain interaction, local project Save/Load, and first-run diagnostics.
- **Primary quality path:** Hunyuan3D-2GP, when its separately managed sidecar and model terms are available.
- **Fallback path:** TripoSR, retained for a simpler local setup and provider resilience.
- **Optional paths:** SDXL-Turbo textures, AudioGen, SmolVLM NPC dialogue, and Kokoro browser TTS. Generated textures can be previewed, applied to a selected mesh, and persisted locally; full texture baking remains outside v1.
- **Voice scope:** push-to-talk transcription that feeds the existing prompt workflow. It is not a structured scene-command parser.
- **Not a hosted product:** authentication, tenancy, durable server jobs, and public ingress are intentionally outside this local portfolio release.

## First-run onboarding

The fastest safe path for a first-time user is:

```bash
python scripts/doctor.py
python scripts/start_local.py
```

Open <http://localhost:3000>. The left drawer includes a live provider-readiness
panel, so you can see whether Hunyuan3D-2GP is available or TripoSR is active
before starting a generation. The launcher starts the browser and FastAPI
services, but it does **not** start a heavyweight GPU model automatically.
That keeps first launch predictable and avoids competing CUDA processes.

Run the Hunyuan sidecar separately only after its model terms, environment,
and hardware requirements have been reviewed:

```bash
python scripts/start_local.py --with-hunyuan
```

The doctor reports missing tools, ports, GPU visibility, backend health, and
optional model readiness without printing environment values or credentials.
For a step-by-step explanation, see [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md).

## Run locally on Windows

### Prerequisites

- Windows 10 or 11
- Node.js 20+ and pnpm 9+
- Python 3.11
- Git
- For convincing local generation: NVIDIA GPU with compatible CUDA runtime, approximately 8 GB VRAM, and several gigabytes of model cache

### 1. Frontend dependencies

```bash
pnpm install --frozen-lockfile
cp .env.local.example .env.local
```

Keep `NEXT_PUBLIC_ENABLE_WEBGPU=false` for the stable WebGL2 path. Enable the experimental renderer only when testing a compatible browser and adapter.

### 2. Backend environment

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

For the documented CUDA 12.1 setup, install the matching PyTorch wheels for the machine before running generation:

```bash
.venv/Scripts/python.exe -m pip install torch==2.5.0 torchvision==0.20.0 --index-url https://download.pytorch.org/whl/cu121
```

Keep large model downloads on `G:` or another drive with enough space:

```bash
export HF_HOME='G:\\hf-cache'
export U2NET_HOME='G:\\hf-cache\\u2net'
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

PowerShell equivalent:

```powershell
$env:HF_HOME = 'G:\hf-cache'
$env:U2NET_HOME = 'G:\hf-cache\u2net'
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

### 3. Start the frontend

In a second terminal:

```bash
pnpm dev --hostname 127.0.0.1 -p 3000
```

Open <http://localhost:3000>. The backend health endpoint is <http://localhost:8000/health>.

For subsequent runs, prefer `python scripts/start_local.py` so the frontend
and backend use the documented ports and shut down together with Ctrl+C.

### Optional Hunyuan3D-2GP

Hunyuan runs in a separate local environment and is not redistributed by this repository. After reviewing its model terms and preparing the compatible checkout, start the sidecar on `127.0.0.1:8081` using [`scripts/gpu/start_hunyuan_sidecar.sh`](scripts/gpu/start_hunyuan_sidecar.sh). With `ECHOFORGE_MESH_BACKEND=auto`, EchoForge prefers Hunyuan when healthy and falls back to TripoSR if the sidecar becomes unavailable.

Do not run multiple uncoordinated heavy CUDA services on the same GPU.

## Verification commands

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build

.venv/Scripts/python.exe -m pytest backend/tests -q
pnpm exec playwright install chromium
pnpm test:e2e
```

CI runs frontend checks, backend tests, and hermetic Playwright on GitHub Actions. The CI browser uses SwiftShader and fixture workers, so it does not download or execute the local GPU models.

## Visual proof

The strongest evidence is a real generated artifact, presented with the validation data that matters:

![EchoForge 3D validated Hunyuan3D output](docs/assets/bishop-evidence.png)

This local RTX 2070 capture shows a Hunyuan3D-2GP bishop after orientation, grounding, mesh processing, shading, and GLB export. The artifact was validated at 20,000 faces, 10,002 vertices, one connected component, watertight geometry, `Y = 0` grounding, `NORMAL`, and `COLOR_0` attributes.

The UI workflow is also captured separately:

![EchoForge 3D workstation](docs/assets/echoforge-workspace.png)

![EchoForge 3D terrain sketch workflow](docs/assets/echoforge-terrain-sketch.gif)

The workstation and terrain captures use the hermetic fixture seam. They demonstrate the browser UI, terrain sketching, telemetry, project actions, and export surface. They do **not** stand in for a real GPU generation benchmark.

The source reference image is intentionally not redistributed because it contains a third-party stock watermark. The generated GLB render and structural metadata are included instead.

## Resume-ready summary

**EchoForge 3D, Local-first AI Worldbuilding Workstation**

- Built a Next.js and React Three Fiber 3D workstation that turns reference images into interactive GLB assets with terrain sketching, physics, spatial audio, NPC dialogue, and standalone export.
- Integrated Hunyuan3D-2GP and TripoSR behind a FastAPI service with serialized VRAM management, provider fallback, watchdog deadlines, mesh sanitation, collision processing, and a 20,000-face application cap for an 8 GB GPU.
- Added versioned IndexedDB project persistence, worker-backed browser inference, validated upload/error states, safe API errors, configurable rate limiting, job-scoped WebSocket progress, CI, and 250+ automated tests across frontend, backend, and browser journeys.

## Limitations worth stating plainly

- Single-image reconstruction cannot know hidden geometry or guarantee exact proportions and topology.
- Hunyuan3D-2GP requires a separately managed sidecar, compatible hardware, model downloads, and license review.
- CPU mode is useful for tests and API plumbing, but too slow for a convincing generation demo.
- Long-running GPU work is serialized. A second backend process or multiple workers would violate the one-GPU safety model.
- Optional texture, audio, vision, speech, and TTS features have different model, VRAM, browser, and licensing requirements.
- The default backend is suitable for a local demo, not an authenticated multi-user deployment.

## Documentation

- [`docs/capability-matrix.md`](docs/capability-matrix.md), feature readiness and caveats
- [`docs/03_TECH_SPEC.md`](docs/03_TECH_SPEC.md), architecture and runtime decisions
- [`docs/07_SECURITY_AND_ENV.md`](docs/07_SECURITY_AND_ENV.md), environment and security boundary
- [`docs/mesh-backends.md`](docs/mesh-backends.md), provider setup and behavior
- [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md), dependency and model licensing boundaries

## License

The EchoForge application source is MIT licensed. Model weights, datasets, trademarks, vendored components, and other third-party materials remain subject to their own terms. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).
