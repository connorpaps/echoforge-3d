# EchoForge 3D — Session Handoff

**Last updated:** 2026-08-25
**Project:** Multimodal spatial worldcrafting engine & in-browser 3D creative suite (Next.js 15 + Three.js/WebGPU frontend, FastAPI + PyTorch backend).

## Read this first

EchoForge 3D is a browser-based 3D creative suite: draw 2D topographic elevation maps, generate 3D terrain/meshes, simulate physics with Rapier3D, and get spatial HRTF audio — with ML inference (Whisper ASR, Depth Anything V2, Kokoro TTS) running in Web Workers and heavy generative models (TripoSR, SDXL-Turbo, AudioGen) queued through the backend's SequentialVRAMManager. The spec suite is `docs/01_PRD.md`–`docs/08_TASKS.md`; visual tokens live in `DESIGN.md`; the roadmap is `docs/08_TASKS.md`.

## Work completed this session (2026-08-25)

### 2. Phase 0 workspace setup + skills + dependencies + model pre-cache (this session, later)
- Installed the 14-repo skill matrix (471 skills in `.agents/skills/` + `skills-lock.json`, committed). Upstream corrections: `obras/superpowers`->`obra/superpowers`, `grill-me`->`mattpocock/skills`, `api-design`->`affaan-m/everything-claude-code`; `core.longpaths=true` set globally; `idb-state-persistence` extracted manually (upstream has an NTFS-illegal colon path); awesome-design-md has no SKILL.md (reference repo - design system lives in DESIGN.md).
- Scaffolded workspace tree (src/, backend/, docs/plans, .audit), updated .gitignore (skills now versioned; .claude/, .hf-cache/, *.tsbuildinfo ignored).
- Frontend: pnpm 11.24.0 installed globally; package.json (Next 15/React 19/three 0.170/R3F/rapier/zustand/transformers.js/tailwind v4/vitest/playwright), strict tsconfig, next.config.ts (Wasm flags), postcss+tailwind, pnpm-workspace.yaml allowBuilds. `pnpm install` + `tsc --noEmit` + Playwright chromium verified (exit 0).
- Backend: `.venv` (Python 3.11, pip 26.2.1) with pinned requirements - torch 2.5.0+cu121, torchvision, diffusers, transformers, trimesh, pyvista, fastapi, slowapi, pytest. **CUDA verified: True / RTX 2070 / 8GB VRAM.** audiocraft deferred to Phase 2 (pins torch==2.1.0, conflicts with spec stack).
- Model pre-cache: `backend/scripts/download_models.py` caches TripoSR + SDXL-Turbo (fp16-only) + SmolVLM-Instruct into `.hf-cache/` (19GB). AudioGen skipped (gated; needs HF_TOKEN).

### 1. GitHub wiring + full memory system installation
- Initialized git on `main`, wired `origin` → `https://github.com/connorpaps/echoforge-3d.git`, pushed all files.
- Installed the complete MEMORY_SETUP.md cross-session memory system: `knowledge.md` (canonical, Freebuff reads this), `AGENTS.md` (merged memory protocol into existing project guide), `handoff.md` (session log), `docs/lessons-learned.md` (structured error log), `docs/activity-log.md` (auto-generated commit log).
- Plumbed `.githooks/post-commit` (auto-logs every commit + auto-captures fix/error commits into lessons), `scripts/setup-memory-hooks.sh` (idempotent enabler), `scripts/machine-sync.sh` (session-start machine-swap detection), `scripts/memory-watcher.mjs` (optional Node file-save watcher), and `.gitattributes` (LF on scripts for Windows safety).
- Created `.gitignore` covering memory logs, Freebuff local state, Node/Python artifacts.
- Enriched one auto-captured lesson from a real `fix(...)` test commit (executable bit on hook/scripts wasn't captured by git on Windows).
- All plumbing verified: hook setup clean, activity-log appended on every commit, lessons auto-capture fired on a fix commit and was enriched, skip guard prevents feedback loops, machine-sync exits 0, watcher smoke test passed, `.gitignore` catch correct.

### 3. Phase 1 foundation (this session) — COMPLETE
- **Stack upgrade (approved):** three 0.185 / R3F 9.7 / drei 10 / rapier 2.2 / react-resizable-panels. WebGL default; WebGPU via async `gl` factory behind `NEXT_PUBLIC_ENABLE_WEBGPU`; all materials TSL (`MeshStandardNodeMaterial` from `three/webgpu`).
- **App shell:** `src/app` layout/page, Tailwind v4 tokens from DESIGN.md, resizable workstation (TopBar/BottomBar/LeftDrawer + resizable viewport), UI primitives (GlassPanel, IconButton, StatusPill, KeycapBadge, TelemetryText, SectionLabel), zustand stores (scene/ui), hotkey map (Tab mode switch, M push-to-talk).
- **Worker infra:** typed `createWorkerClient`/`createWorker` factory + static URL registry + `useWorker` hook; depth/speech/tts workers (transformers.js / kokoro-js), requestId/READY handshake, zero-copy ArrayBuffers.
- **Speech (Task 1.3):** MediaRecorder audio layer, `useSpeechRecognition` hook, VoicePill + PromptBar (M = push-to-talk; mock seam via `NEXT_PUBLIC_E2E=true` fixture worker for hermitic e2e).
- **Terrain (Task 1.4):** 2D topo canvas (canvas 2D, brush/erase/clear, quantized contours), heightmap store, `heightmapTexture` DataTexture, TSL `positionNode` displacement (CUJ-01 e2e).
- **Physics (Task 1.5):** Rapier `<Physics>` + `HeightfieldCollider` + capsule `PlayerController` (camera-relative WASD, jump, grounded check from heightmap) + `FirstPersonRig` (pointer-lock look) + CrosshairHud + POS readout (CUJ-03 e2e).
- **Test infra:** `eslint.config.mjs` (FlatCompat), `vitest.config.ts` (jsdom + testing-library, jsx automatic), `playwright.config.ts` (**workers: 1 — serial, avoids machine freezes**; webServer pins `-p 3000` because env `PORT=0` hijacked the port).
- **Final gates:** typecheck ✓ lint ✓ 62 unit ✓ 9 e2e ✓ (~25s serial).
- **Rapier gotcha (see knowledge.md / lessons-learned.md):** rapier3d-compat 0.19.2 heightfield = cell counts + (cells+1)² samples + full-extent scale + transposed layout. `heightmapToPhysicsGrid` handles the remap; verified via debug-render probes.

## Current repository state

- `docs/` — static spec suite (PRD, design brief, tech spec, API contracts, data models, testing/QA, security/env, tasks)
- `AGENTS.md` — project guardrails + agent instructions + memory protocol
- `knowledge.md` — canonical project knowledge (Freebuff reads this every session)
- `DESIGN.md` — visual design token rulebook
- `.githooks/` + `scripts/` — AI memory system plumbing (post-commit auto-log, hook setup, machine sync, file watcher)
stages of Phase 0 complete: workspace tree, 471 skills, frontend manifests + lockfile, backend venv + CUDA stack, model pre-cache (19GB in .hf-cache/)
- No application code yet (src/ is skeleton .gitkeep only; backend has requirements + pre-cache script; Phase 1 starts Task 1.1)

## Validation completed this session

- `git config core.hooksPath` → `.githooks` ✅
- `bash scripts/setup-memory-hooks.sh` — all 9 memory files present ✅
- `.gitattributes` present with `*.sh text eol=lf` ✅
- `docs/activity-watch.log` and `docs/.last-machine` gitignored ✅
- `bash scripts/machine-sync.sh` — exits 0, no auto-pull (remote empty) ✅
- `node scripts/memory-watcher.mjs` — smoke test: detected and logged a file-save event ✅
- Post-commit hook: activity-log appended on every commit, lessons auto-capture fired on a `fix(...)` commit ✅
- Skip guard: committing only `docs/activity-log.md` produces zero diff ✅
- Hook/script exec bit: corrected from 100644 → 100755 in git index ✅
- `git push -u origin main` — went through (GCM) ✅
## Validation completed this session (Phase 0)

- `pnpm install` — exit 0 (594 packages, allowBuilds for esbuild/onnxruntime-node/sharp/protobufjs/unrs-resolver) ✅
- `pnpm exec tsc --noEmit` — exit 0 ✅
- `pnpm exec playwright install chromium` — exit 0 ✅
- `.venv` pip install `-r backend/requirements.txt` — exit 0 ✅
- CUDA check: `torch.cuda.is_available() == True`, device NVIDIA GeForce RTX 2070, 8.0 GB VRAM (torch 2.5.0+cu121) ✅
- Pre-cache: TripoSR ✅ / sdxl-turbo (fp16) ✅ / SmolVLM-Instruct ✅ / audiogen skipped (gated) ✅ — cache at `.hf-cache/` (19GB) ✅
- `pnpm typecheck` — passes (no src/ sources yet; gate bites from Task 1.1)
- `pnpm test` — n/a (no tests yet)

## Prioritized next steps (Phase 3)

1. Phase 3 — AudioGen endpoint (`facebook/audiogen-medium`, gated): install with `--no-deps` + runtime extras (pins torch==2.1.0); wire `/api/v1/generate-audio` + the loopable `.wav` contract.
2. Wire the real Depth-Anything worker to CUJ-02 (voice → topo → terrain) with real weights; the mock seam is e2e-tested but the real path isn't.
3. Provide HF_TOKEN (with AudioGen license accepted) to finish the pre-cache: `HF_TOKEN=... .venv/Scripts/python.exe backend/scripts/download_models.py`.
4. Before shipping: verify the WebGPU path on a real GPU (e2e runs SwiftShader software WebGL); re-check `world.castRay` on a rapier upgrade before gameplay use.
5. Backend run command now needs the relocated cache (new shells get `HF_HOME` via setx): `HF_HOME=G:\\hf-cache .venv/Scripts/python.exe -m uvicorn backend.main:app --port 8000`.

## Phase 2 delivered this session

- FastAPI microservice (`backend.main:app`): `/health`, `/api/v1/generate-mesh` (TripoSR), `/api/v1/generate-texture` (SDXL-Turbo), `/ws/progress` — all behind `SequentialVRAMManager` (serial, <6 GB peak).
- Mesh pipeline: decimation ≤20k faces, Laplacian, hulls, bounds, GLB with vertex colors.
- Frontend generation UI: image upload + generate buttons, emerald shimmer pill, glass success/error toasts, TopBar VRAM meter (Task 2.5).
- Caches relocated to G: (HF/pip/npm/playwright); C: freed 5.8 GB → 60.9 GB.

## Session handoff checklist

- Read `knowledge.md`, `docs/lessons-learned.md`, and this file
- Expand any auto-captured "needs enrichment" lessons entries
- `git pull` if on a different machine than last session
- Check `git status --short`
- Run `pnpm typecheck` and `pnpm test` before changing behavior (once the scaffold exists)
- **Push when done:** `git add -A && git commit -m "..." && git push`
