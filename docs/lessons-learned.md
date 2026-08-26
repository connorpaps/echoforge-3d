# Lessons Learned & Error Log

**Purpose:** A permanent, structured record of mistakes, errors, gotchas, project issues, and fixes. The goal: never repeat a lesson.

## How this file stays up to date (automatic)
1. **Git hook safety net:** `.githooks/post-commit` auto-appends an "(auto-captured, needs enrichment)" placeholder for every commit whose message mentions fix/bug/error/regression/etc.
2. **Agent ritual (mandatory, immediate):** the session protocol in `knowledge.md`/`AGENTS.md` requires appending a full entry immediately whenever an error is fixed, a mistake is made, or a gotcha is discovered.
3. **Session-end sweep:** the agent expands auto-captured placeholders with root cause + "avoid in future" and removes the enrichment marker.

## Entry format
- **Symptom:** what went wrong or the error observed
- **Root cause:** why it happened
- **Fix:** what was changed to resolve it
- **Avoid in future:** the actionable rule to prevent recurrence
- **Status:** `fixed` | `workaround` | `open`

---

## 2026-08-25 — repo setup (example seeded lesson)
- **Symptom:** no git repo, no AI memory system, no GitHub remote wired up.
- **Root cause:** project started as a docs-only folder; version control and cross-session memory were never initialized.
- **Fix:** `git init -b main`, added `origin` → `https://github.com/connorpaps/echoforge-3d.git`, installed the full MEMORY_SETUP.md memory system (knowledge/handoff/lessons/activity-log, post-commit hook, setup + machine-sync + watcher scripts), and pushed the initial commit.
- **Avoid in future:** run the `knowledge.md` bootstrap check (`git config core.hooksPath`) at the start of every session, especially after cloning on a new machine.
- **Status:** fixed

## 2026-08-25 19:36 — `009b293`
**fix: mark hook and scripts executable for non-Windows clones**

  - Files:
    - .githooks/post-commit
    - scripts/machine-sync.sh
    - scripts/memory-watcher.mjs
    - scripts/setup-memory-hooks.sh
- **Symptom:** initial commit recorded the git hook and scripts as mode 100644, so the executable bit would be lost on Linux/macOS clones.
- **Root cause:** on Windows, a local `chmod +x` before the commit did not propagate the exec bit into the git index.
- **Fix:** ran `git update-index --chmod=+x` on the hook and scripts, then committed (now mode 100755).
- **Avoid in future:** after creating hook/script files, set the exec bit via `git update-index --chmod=+x` before committing (or verify with `git ls-files --stage`).
- **Status:** fixed

## 2026-08-25 — rapier heightfield wasm crash + silent fall-through (Task 1.5)
- **Symptom:** (1) every page load crashed with `RuntimeError: unreachable` inside `@dimforge/rapier3d-compat@0.19.2`; (2) after fixing the crash, the player capsule fell straight through the terrain heightfield even though the shape reported sane nrows/ncols/scale.
- **Root cause:** the dim3 wasm binding builds `DMatrix::from_vec(nrows + 1, ncols + 1, heights)` — it expects CELL counts with a `(cells+1)²` sample array (passing `size` cells + `size²` heights panics). Then two more quirks: `scale.x/z` is the FULL footprint (±0.5-normalized local grid), not per-cell width; and DMatrix column-major storage transposes the layout relative to the mesh.
- **Fix:** `src/lib/physics/rapierHeightfield.ts` — pass `width/height = size-1`, `scale.x/z = TERRAIN_WORLD_SIZE (64)`, and remap via `heightmapToPhysicsGrid` (transpose + flip). Verified with `world.debugRender()` bump probes and the CUJ-03 e2e (player walks over the hill).
- **Avoid in future:** never trust a wasm binding's documented signature — verify against the compiled Rust (docs.rs / GitHub source) AND empirically (debug render, drop tests). Also: `world.castRay` returns NaN in this build, so use solver/drop tests as ground truth.
- **Status:** fixed

## 2026-08-26 — SDXL-Turbo "hang" was allocator thrash (Task 2.3)
- **Symptom:** a 1-step SDXL-Turbo generation took 40s at 256² and appeared to hang at 512², with `torch.cuda.max_memory_reserved` peaking at 7.5 GB on an 8 GB RTX 2070.
- **Root cause:** the fp16 pipeline is ~6.6 GB of weights (UNet alone 4.9 GB), leaving <1 GB for activations + CUDA context; the caching allocator thrashed under pressure. Compounded by diffusers 0.31's legacy `callback` requiring `callback_steps` (else `i % callback_steps` → NoneType) and a changed 3-arg signature.
- **Fix:** `enable_model_cpu_offload()` + `enable_vae_slicing()` + `enable_vae_tiling()` (peak 5.3 GB, ~10s at 512²); switched to `callback_on_step_end(pipe, step, timestep, kwargs)`.
- **Avoid in future:** on ≤8 GB cards always CPU-offload SDXL-Turbo; verify the installed diffusers version's callback API before wiring progress.
- **Status:** fixed

## 2026-08-26 — TripoSR fp16 + torchmcubes unavailability (Task 2.3)
- **Symptom:** `expected scalar type Half but found Float` during TripoSR extraction; and `torchmcubes` (a hard import in the vendored pipeline) has no prebuilt wheel — its source build needs MSVC + libtorch ABI, unavailable on Windows.
- **Root cause:** the triplane renderer builds fp32 `torch.linspace` grid vertices while the decoder is fp16; the image preprocessor also emits fp32. The marching-cubes call is the only torchmcubes usage.
- **Fix:** three dtype casts patched into `backend/vendor/tsr/system.py`; `backend/shims/torchmcubes_stub.py` prefers PyMCubes (C++ wheel) with a skimage fallback and is registered in `sys.modules`. fp16 + `chunk_size=16384` + resolution 192 took extraction from ~200s to ~3s.
- **Avoid in future:** when vendoring an inference pipeline, keep a patch list in the vendor README; prefer pure-wheel backends (PyMCubes) over source-only CUDA extensions on Windows.
- **Status:** fixed
