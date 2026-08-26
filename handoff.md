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

## Work completed (2026-08-26, live-app session)

- Booted the real app (`pnpm exec next dev -p 3000` — the shell's `PORT=0` env still hijacks the port, so `-p 3000` is mandatory outside Playwright) and verified it live at 60 FPS: workstation UI, Rapier running, terrain canvas, generation panel.
- **Fixed the real-worker dev bug (previously hidden by the e2e mock seam):** `new Worker(workerUrls[id], { type: 'module' })` made webpack emit workers as raw `.ts` media assets → served as `video/mp2t` → module workers crashed (`AI: LOADING…` forever). Rewrote `workerRegistry.ts` with direct per-worker `new Worker(new URL(...))` factories; depth worker now uses `device: 'auto'`, kokoro-js uses `device: 'wasm'` (details in lessons-learned.md).
- **Verified live end-to-end in the browser:** depth-anything-v2-small loads over WASM (`AI: READY`), a brush stroke on the topo canvas produced a 16384-vert displaced terrain mesh at 60 FPS. Typecheck ✓, 84 unit tests ✓.
- **Still failing in this sandbox (not code bugs):** speech worker hits HF hub `Unauthorized access` for distil-whisper-small (network/gating — needs checking on the real dev machine); backend offline → VRAM: offline + Generate disabled (start `uvicorn backend.main:app --port 8000`); WebGPU path still unverified on a real GPU.

## Work completed (2026-08-26, live-app session — continued)

- **Fixed the black-viewport bug:** drawing on the topo canvas made the viewport go solid black. Root cause: three r185's WebGLRenderer can't compile TSL node materials without the explicit `renderer.setNodesHandler(new WebGLNodesHandler())` opt-in (from `three/addons/tsl/WebGLNodesHandler.js`) — without it, `resolveIncludes(undefined)` throws per frame and aborts the whole render after the clear. Added the opt-in via `onCreated` in `Viewport3D.tsx`. Verified: crash gone, terrain renders (bright test color proved it), grid visible, 13/13 e2e, 84 unit, typecheck green. Lesson logged.
- **Known e2e blind spot:** CUJ-01 (terrain) and other viewport e2e assert store/DOM state, not rendered pixels — this bug shipped because of that. Worth adding a pixel-level check later.

## Work completed (2026-08-26, live-app session — continued)

- **Completed the missing half of Task 2.5 — generated meshes now drop into the scene** (was: toast only, nothing visible). Verified against the DESIGN BRIEF §Generation success state ("Generated .glb mesh drops into scene") and 05_DATA_MODELS (SceneEntity store was built but unconsumed). NOT Phase 3 scope (Phase 3 has no such task).
  - `src/lib/generation/spawn.ts` + tests: `buildMeshEntity` — scales the normalized TripoSR GLB to 2m, sits it on the current terrain height, spawns at (2, 0, 0) (inside the default camera FOV).
  - `GeneratedEntityBridge` (mounted in Workstation): adds an entity on mesh success, deduped by jobId, skipped in E2E mode (mock GLB is a placeholder).
  - `SceneEntities` (in Scene): imperative GLTFLoader (data-URL safe), corrupt payloads degrade to not-rendered instead of throwing.
  - Scene Inspector in LeftDrawer now lists entities with a remove (✕) button.
  - Verified live end-to-end with the user's headshot: upload → Generate Mesh → GLB generated on GPU → mesh visible center-frame (pixel-verified) → listed in inspector. Typecheck ✓, 90 unit ✓, 13/13 e2e ✓.
- **Also this session:** black-viewport fix (WebGLNodesHandler), real-worker MIME fix, device auto/wasm fallback, backend started on :8000 (TripoSR warm, VRAM 0.8GB).

## Work completed (2026-08-26, live-app session — continued)

- **Cheap wins for mesh quality applied (at user request):** `MESH_RESOLUTION` default 192 → 256 (backend/config.py, env-overridable; gen ~7.8s vs 6.2s); viewport lighting brightened (hemisphere 1.0, directional 2.2 + cool fill light in Scene.tsx — still 60 FPS); SceneEntities now forces `vertexColors = true` on loaded GLBs with a color attribute (TripoSR GLBs carry COLOR_0 with no material — colors were possibly being dropped). Verified live: mesh renders lit + colored. **Verdict: presentation improved, but likeness unchanged — TripoSR is the quality limiter for faces** (blobby geometry, confirmed via bounds/vertex analysis). Real fix = model swap to TRELLIS / Hunyuan3D-2 (Task 2.3 already names "TripoSR / TRELLIS").

## Work completed (2026-08-26, live-app session — continued)

- **Root-caused the "ugly rock/slab" mesh problem — it was the background remover, not the model.** A chair (TripoSR's bread-and-butter) reconstructed as a flat slab (depth 0.398); fp16 and decimation both exonerated by direct fp32 + raw-mesh comparison. The hand-rolled border flood-fill in `image_utils.py` was eating light objects on white backgrounds (only 0.5–1.6% of the image survived as foreground) — explains both the chair slab AND the faceless headshot.
- **Fix: `backend/services/image_utils.py` now uses rembg (U²-Net)** — the same background-removal model TripoSR's reference pipeline uses (installed `rembg[cpu]`, authorized by user). Lazy session with cached failure → offline fallback to the old flood-fill heuristic (tests patched to force/verify each path). `U2NET_HOME` pinned to `G:\hf-cache\u2net` in `backend/config.py` so the ~170 MB model stays off C: (user's G:-drive rule; also noted in knowledge.md). Verified: chair depth 0.398 → 0.572, recognizable chair generated live through the UI (19,986 faces · 9,957 verts · 3.0s). 36/36 backend tests, 8/8 image_utils tests.
- **Honest remaining limitation:** the mesh is now a real chair but still low-poly/rough — that's TripoSR at 20k-face budget (raw 96k faces decimated). Real quality jump = TRELLIS / Hunyuan3D-2 model swap (Task 2.3 already names TripoSR / TRELLIS).

## Work completed (2026-08-26, live-app session — continued)

- **Fixed meshes spawning sideways/upside-down with floating debris** (backend `mesh_processing.py`): TripoSR outputs meshes in its tilted camera frame (height axis diagonal in X/Y — the chair's extents were [0.964, 0.921, 0.572]) and emits 15+ disconnected components. Pipeline now: sanitize → **keep_largest_component** (drops slivers + detached slabs) → **orient_upright** (PCA height axis → +Y; up/down via photo-sampled vertex colors — warm R−B tip = wood/skin up; mass heuristic tiebreak) → decimate → smooth → keep_largest again (decimation re-emits 3-vert slivers) → reground (min-y=0) → recolor → export. Bounds now world-frame so frontend spawn drops assets on terrain directly.
- **Verified:** chair now extents [0.703, 1.025, 0.573] (standing), 1 component, brown backrest up (tip R−B +14.8/+3.7); headshot also upright (skin top). 40/40 backend tests (4 new), regenerated live through the UI — screenshot shows the chair standing on the grid with no debris.
- **User question answered:** wireframe "lines" (Google Images style) are a display mode; the app renders solid shaded surfaces. A wireframe view toggle is a suggested follow-up.

## Work completed (2026-08-26, live-app session — continued)

- **Fixed the "tilted / facing the wrong direction" complaint — meshes now stand upright AND face the camera.**
  - Empirical proof of the model convention: rendered the reconstruction with TripoSR's own novel-view renderer from azimuths 0/90/180/270 and compared to the input photo — azimuth 0 (camera at +X in model space) matches best (object-pixel diff 0.202 vs 0.305 worst), so the photo-facing side is +X in raw model space.
  - Backend `orient_upright` now yaws the mesh so that side faces world **+Z** (documented convention).
  - Frontend: `facingAzimuthToward()` computes the yaw pointing +Z at the live camera; `buildMeshEntity` applies `rotation=[0, yaw, 0]`; `CameraProbe` (in Scene.tsx) mirrors the orbiting camera into module-level `cameraRef` (avoids per-frame zustand re-renders). Works with OrbitControls in editor mode and the player camera in play mode.
  - Also patched two latent fp16 dtype bugs in the vendored NeRF renderer (`nerf_renderer.py`: t_vals linspace + positions → triplane dtype) — same class as the extract-path patch; surfaced while using `render()` for the diagnostic.
  - Verified: regenerated chair spawns at (2,0,0) with yaw ≈ 0.695 rad toward the default camera (12,10,12) — the photo's 3/4 front faces the viewer. 41 backend tests, 93 frontend tests, 13/13 e2e. App running on :3000, backend on :8000.

## Session handoff checklist

- Read `knowledge.md`, `docs/lessons-learned.md`, and this file
- Expand any auto-captured "needs enrichment" lessons entries
- `git pull` if on a different machine than last session
- Check `git status --short`
- Run `pnpm typecheck` and `pnpm test` before changing behavior (once the scaffold exists)
- **Push when done:** `git add -A && git commit -m "..." && git push`
