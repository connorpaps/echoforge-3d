# EchoForge 3D: Getting Started

This guide is for a first-time local user. EchoForge is a local-first demo,
not a hosted service. It does not require an account, and it does not upload
your reference images unless you deliberately configure another service.

## What you need

### Baseline browser workstation

- Windows 10 or 11
- Node.js 20 or newer
- pnpm 9 or newer
- Python 3.11
- Git
- A modern Chromium-based browser

The terrain editor, browser workers, persistence, and export can be explored
without a CUDA GPU. Generation is substantially more useful with a compatible
NVIDIA GPU.

### Recommended local generation hardware

- NVIDIA GPU with approximately 8 GB VRAM
- 32 GB system RAM is recommended for the documented RTX 2070 workflow
- Several gigabytes of free space for model caches
- A separate Hunyuan3D-2GP environment, prepared according to that project's
  current requirements and license terms

## Install and diagnose

From the repository root:

```bash
pnpm install --frozen-lockfile
python -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
cp .env.local.example .env.local
python scripts/doctor.py
```

The doctor is read-only. It checks required tools and files, detects an
available NVIDIA GPU without printing secrets, probes the documented ports,
and reports whether the backend or optional sidecar is reachable.

If you are using PowerShell, the copy step can be written as:

```powershell
Copy-Item .env.local.example .env.local
```

Do not copy the example backend token into a real environment. `HF_TOKEN` is
server-only and must never be committed or pasted into chat.

## Start the application

The recommended launcher starts the frontend and backend together:

```bash
python scripts/start_local.py
```

Then open <http://localhost:3000>.

The launcher intentionally does not start Hunyuan3D by default. This avoids a
surprise model download and prevents multiple heavy CUDA processes from
competing for the same 8 GB GPU.

To start the separately managed Hunyuan sidecar in an environment that has
already been prepared:

```bash
python scripts/start_local.py --with-hunyuan
```

The sidecar helper reads `HUNYUAN_ROOT`, `HF_HOME`, `HUNYUAN_PORT`, and
`HUNYUAN_PROFILE` from the environment. It uses the existing
`scripts/gpu/start_hunyuan_sidecar.sh` contract and does not install anything.

Stop all services with Ctrl+C. If a port is already occupied, the launcher
fails with the port name instead of attaching to an unknown process.

## First useful walkthrough

1. Draw on the topographic canvas to create terrain.
2. Type a short prompt such as `stone watchtower`.
3. Upload a clean PNG, JPG, or WebP reference image.
4. Generate a mesh when the backend and a mesh provider are ready.
5. Use play mode to test terrain movement and physics.
6. Generate ambient audio from a prompt and check the spatial emitter.
7. Spawn an NPC and use the documented interaction key when the dialogue
   provider is available.
8. Save the local project, reload it, and test the export menu.

The left drawer's **Provider readiness** card is the source of truth for the
current runtime. It distinguishes the Hunyuan3D-2GP primary path, the active
TripoSR fallback, optional backend providers, and browser-worker capabilities.

The current release distinguishes real providers from procedural or canned
fallbacks. A fallback proves the application plumbing works; it does not prove
the quality of the corresponding model.

## Troubleshooting

### `VRAM: offline`

The frontend is running but the FastAPI backend is not reachable. Run:

```bash
python scripts/doctor.py
```

Then start the combined launcher again.

### Hunyuan is unavailable

This is expected unless the separately managed sidecar environment exists and
is healthy on `127.0.0.1:8081`. EchoForge can fall back to TripoSR when its
weights are installed and the backend is configured for `auto` mode.

### Browser models are downloading

Depth, speech recognition, and Kokoro TTS use dedicated browser workers. The
first run can download and cache model files. Keep the browser open and do not
interpret the initial loading period as a failed generation.

### Ports are busy

The documented ports are:

| Service | Port |
|---|---:|
| Frontend | 3000 |
| FastAPI backend | 8000 |
| Hunyuan sidecar | 8081 |

Stop the owning process, or use the launcher only after the ports are free.
Do not kill unrelated processes blindly.

## Verification

```bash
pnpm test
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm build
.venv/Scripts/python.exe -m pytest backend/tests -q
```

Hermetic browser tests use fixture workers and do not prove real CUDA model
quality. Real model evidence requires a deliberate local run with the provider
and hardware recorded.