# Project knowledge

## Project
- EchoForge 3D — a multimodal spatial worldcrafting engine and in-browser 3D creative suite.
- Tech stack: Next.js 15 (App Router), React 19, Three.js / WebGPU (TSL), React Three Fiber, Rapier3D Wasm, Web Audio API (HRTF), FastAPI, PyTorch (CUDA FP16), Transformers.js, Kokoro-82M.
- Frontend lives under `src/` (App Router pages, R3F viewport, 2D topographic canvas, Zustand stores, Web Workers). Backend is a FastAPI microservice under `backend/` (VRAM manager, trimesh decimation, model download script, tests).

## Session protocol (AI memory system)

This repo uses git-tracked files as its cross-session AI memory. **Freebuff reads this file (`knowledge.md`) automatically at the start of every session**; Cursor reads `AGENTS.md` instead. Follow this ritual every session:

- **Bootstrap check:** Verify the memory system is active — run `git config core.hooksPath`. If it is not `.githooks`, run `bash scripts/setup-memory-hooks.sh` before doing anything else. If memory files are missing but `MEMORY_SETUP.md` exists, replicate them from `MEMORY_SETUP.md`.
- **Machine sync check:** Run `bash scripts/machine-sync.sh` — detects machine swaps (via `docs/.last-machine`), re-enables hooks here, fixes old `master` clones, and pulls the latest memory files when the working tree is clean.
- **Session start:** Read `handoff.md` first (last session's work + next steps), then this file, then `docs/lessons-learned.md` (expanding any auto-captured "needs enrichment" entries), then check `git status --short`, `git log --oneline -10`, and the tail of `docs/activity-log.md` (auto-log of every commit).
- **During work:** Log non-obvious decisions, new commands, and gotchas into this file as they are discovered. **After fixing an error, making a mistake, or finding a gotcha, append a structured entry to `docs/lessons-learned.md` immediately** (Symptom / Root cause / Fix / Avoid in future / Status) — the post-commit hook auto-captures fix/error commits as placeholders, but the agent must not rely on that alone. **After completing a substantial change, append a brief "Work completed" note to `handoff.md` immediately — do not wait for session end.**
- **Session end:** Append a date-stamped "Work completed" section to `handoff.md` (what changed, why, validation run). Update this file with any new rules/commands/architecture facts. **Review `docs/lessons-learned.md` and expand any auto-captured placeholder entries** (root cause + avoid-in-future, then remove the marker). Keep the memory files lean (< ~200 lines); prune stale content.
- **Wrap-up signals:** If the user says the session is ending (e.g. "wrap up", "done for today", "that's all", "update the handoff"), update `handoff.md` + this file **even if not explicitly asked** — do not wait to be told.
- Update `AGENTS.md` only when a rule must also bind Cursor/other tools — this file stays the single source of truth.

**Automatic memory (no input needed):** a git `post-commit` hook (`.githooks/post-commit`) appends every commit to `docs/activity-log.md` and auto-captures fix/error commits into `docs/lessons-learned.md`; `node scripts/memory-watcher.mjs` (optional) logs every file save to `docs/activity-watch.log` (gitignored). These are mechanical records — the agent still owns writing the *why* into `handoff.md`/this file.

## Commands
- Install (frontend): `pnpm install` (pnpm 11; allowBuilds config lives in `pnpm-workspace.yaml`)
- Install (backend, venv): `python -m venv .venv && .venv/Scripts/python.exe -m pip install -r backend/requirements.txt` (Windows: `.venv/Scripts/python.exe`; POSIX: `.venv/bin/python`)
- **CUDA torch:** PyPI defaults to CPU wheels — install CUDA builds from `--index-url https://download.pytorch.org/whl/cu121` (see note in backend/requirements.txt)
- Model pre-cache: `.venv/Scripts/python.exe backend/scripts/download_models.py` (cache defaults to project-local `.hf-cache/`, override via HF_HOME; AudioGen requires HF_TOKEN)
- Development (frontend): `pnpm dev` (Next.js on http://localhost:3000)
- Development (backend): `uvicorn backend.main:app --reload --port 8000`
- Test (frontend): `pnpm test`
- Test (backend): `pytest backend/tests`
- E2E: `pnpm test:e2e` (Playwright WebGL/WebGPU runner — **strictly serial, workers:1**; parallel SwiftShader instances freeze the machine)
- E2E dev server: port is pinned (`-p 3000`) in `playwright.config.ts` because the shell env sets `PORT=0` (Next picks a random port and Playwright's probe hangs)
- Typecheck/lint: `pnpm typecheck` / `pnpm lint`
- Build: `pnpm build`
- Download AI model weights: `python backend/scripts/download_models.py`

## Architecture and behavior
- **Source of truth:** consult `docs/01_PRD.md` through `docs/08_TASKS.md` before writing new features; visual tokens live in `DESIGN.md`; the task roadmap is `docs/08_TASKS.md`.
- 14-repo skill matrix installed (471 skills) in `.agents/skills/` — committed to git; reinstall/restore via `skills-lock.json` (`npx skills experimental_install`). AGENTS.md §3 routes tasks to specific skills.
- `.claude/` (per-agent symlinks) and `.hf-cache/` are gitignored; `.agents/` IS versioned.
- Frontend uses `pnpm`, not `npm`.
- Machine learning inference in the browser runs in dedicated Web Workers (never the main thread).
- Backend heavy models route through `SequentialVRAMManager`; never load multiple heavy PyTorch models concurrently on CUDA.
- Raw 3D mesh outputs are decimated to <20,000 faces and get convex collision hulls baked via `trimesh` before client transmission.

## Constraints and gotchas
- **Zero unvetted dependencies:** never run `npm install`/`pip install` for packages not in `docs/03_TECH_SPEC.md` without developer authorization.
- **VRAM budget:** stop and audit if backend CUDA allocation exceeds 6.0 GB.
- **Design adherence:** all UI must match `DESIGN.md`; no generic AI purple gradients or pure `#000000` backgrounds.
- **Diagnose first:** log root cause before patching; 3 consecutive identical build/test failures = stop and report.
- Never commit secrets (`.env` files). Never hand-edit `node_modules`, `.next/`, or other build output.

## Rapier heightfield (verified against `@dimforge/rapier3d-compat@0.19.2`)

The dim3 wasm `heightfield` binding differs from the documented API in three ways. All three were root-caused and verified empirically (drop tests + `world.debugRender()` probes) during Task 1.5 — `src/lib/physics/rapierHeightfield.ts` encodes the correct usage:
- **Cell counts, not sample counts:** the binding builds `DMatrix::from_vec(nrows + 1, ncols + 1, heights)`, so pass `width/height = cells` and a `(cells+1)²` heights array. Passing sample counts traps the wasm module (`RuntimeError: unreachable`) and crashes the page.
- **Full-extent scale:** the local grid is normalized to ±0.5, so `scale.x/z` = the whole footprint (e.g. `TERRAIN_WORLD_SIZE = 64`), NOT per-cell width. Per-cell scale silently collapses the terrain to a 1×1 patch and everything falls through.
- **Transposed layout:** DMatrix column-major construction makes rapier place `heights[i * ncols + j]` at world (x = i, z = j), while the terrain mesh places `heightmap[z * size + x]` at (x, z = size-1-z). `heightmapToPhysicsGrid` remaps mesh→rapier layout.
- `world.castRay` returns NaN in this compat build even against a cuboid — do not use it for gameplay queries until rapier is upgraded and re-verified. Use drop tests / solver contacts as ground truth.
- `@react-three/rapier`'s `scaleColliderArgs` has a bug for heightfields (`s.x *= scale.x/y/z`), harmless while body scale is (1,1,1).
- **C: drive is 100% full (137MB free)** on this machine — keep big downloads (HF cache, node_modules, venv) on G: and flag disk pressure early. Stale 40GB HF cache at `C:/Users/Conno/.cache/huggingface`.
- **HF cache on Windows without Developer Mode:** symlinks unsupported — huggingface_hub falls back to copies (degraded, uses ~2x space; warning is benign). Enable Developer Mode to avoid it.
- **audiocraft==1.3.0 pins torch==2.1.0** — conflicts with the spec's torch 2.5.0; install with `--no-deps` + runtime extras when AudioGen integration lands (Phase 2).
- **sdxl-turbo repo ships fp32 + fp16** — pre-cache fetches only `*.fp16.safetensors` (spec loads `variant="fp16"`).

## Phase 2 backend + generation UI (verified 2026-08-26)

- **SDXL-Turbo on 8 GB VRAM:** the fp16 pipeline is ~6.6 GB of weights (UNet
  4.9 GB), so plain `.to(cuda)` thrashes — a 1-step job takes 40s+. Always use
  `pipe.enable_model_cpu_offload()` + `enable_vae_slicing()` + `enable_vae_tiling()`
  (peak ~5.3 GB, ~10s at 512²). `backend/services/sdxl_service.py` encodes this.
- **diffusers 0.31 callback changes:** legacy `callback` requires `callback_steps`
  and the signature dropped the `pipe` arg (now `(step, timestep, latents)`).
  Prefer `callback_on_step_end(pipe, step, timestep, kwargs)`.
- **TripoSR fp16:** the vendored renderer mixes fp32 `torch.linspace` grid
  vertices with the decoder — cast image input + grid vertices + MC output to the
  model dtype (patched in `backend/vendor/tsr/system.py`). fp16 + `chunk_size
  16384` + resolution 192 + PyMCubes: extract ~3s (was ~200s at fp32/256/skimage).
- **torchmcubes is source-only (MSVC+libtorch ABI):** use `PyMCubes` (C++ wheel)
  or skimage via `backend/shims/torchmcubes_stub.py`; register it in `sys.modules`
  before importing the vendored `tsr` package.
- **Backend packaging:** `backend` is a real package (`__init__.py`); tests run
  via `backend/pytest.ini` with `pythonpath = ..` (project root). Vendored code
  lives in `backend/vendor/` (see README there for the patch list).
- **Cache relocation:** HF cache → `G:\hf-cache` (persistent `HF_HOME`), pip →
  `G:\pip-cache`, npm → `G:\npm-cache`, Playwright → `G:\ms-playwright`
  (`PLAYWRIGHT_BROWSERS_PATH`). Windows HF caches store snapshots as symlinks;
  robocopy dereferences them — verify snapshot files landed and repair dangling
  refs (copy blob → snapshot path) after a move.
- **E2E generation mock seam:** `src/lib/api/generate.ts` gates on
  `isE2EMode()` (from `workerRegistry`) and drives a scripted progress timeline
  through an in-process bus so the shimmer/toast UI is e2e-testable with no GPU.
