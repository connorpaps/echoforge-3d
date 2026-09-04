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

## 2026-08-26 — drawing terrain turned the viewport black: WebGL renderer + TSL node material crash
- **Symptom:** after a brush stroke, the 3D viewport went solid black (grid vanished) while FPS stayed 60. Console flooded every frame with `TypeError: Cannot read properties of undefined (reading 'replace')` at `resolveIncludes` → `new WebGLProgram` → `WebGLRenderer.renderBufferDirect`. Reproduced deterministically on WebGL (SwiftShader and real GPU alike).
- **Root cause:** three r185's WebGLRenderer does NOT compile TSL node materials (`MeshStandardNodeMaterial` + `positionNode`) automatically — `_nodesHandler` is `null` unless the app opts in via `renderer.setNodesHandler(new WebGLNodesHandler())`. Without it the node builder never runs, `material.vertexShader`/`fragmentShader` are undefined, `parameters.vertexShader` is undefined, and `resolveIncludes(undefined)` throws — aborting the whole frame after the background clear (terrain draws before the grid, so the grid never renders → black). E2E never caught it because CUJ-01 asserts pipeline state (Verts: 16384 / store), not rendered pixels.
- **Fix:** `src/components/viewport/Viewport3D.tsx` — WebGL Canvas now has `onCreated={({ gl }) => gl.setNodesHandler(new WebGLNodesHandler())}`, importing `WebGLNodesHandler` from `three/addons/tsl/WebGLNodesHandler.js` (official WebGL+TSL compatibility handler; typed by @types/three 0.185.4). Verified live: crash gone, terrain mesh visibly renders (confirmed with a temporary bright test color), grid visible, 13/13 e2e + 84 unit + typecheck green.
- **Avoid in future:** any TSL/node material rendered through WebGLRenderer needs the `setNodesHandler` opt-in; the WebGPU renderer does not. Add at least one pixel-level assertion to viewport e2e — state-only assertions can pass while the frame is completely broken.
- **Status:** fixed

## 2026-08-26 — speech worker 401: spec model distil-whisper-small is gated on HF
- **Symptom:** voice dictation never initialized; the Next.js dev overlay (the "1 Issue" badge) showed `Unauthorized access to file: "https://huggingface.co/onnx-community/distil-whisper-small/resolve/main/tokenizer.json"`.
- **Root cause:** the model repo is **gated** on Hugging Face — `curl` of the resolve URL returns HTTP 401 without an authenticated account that accepted the license. In-browser transformers.js has no token, so the download is rejected. (Depth-anything-v2-small is public and works; the 404 on its tokenizer.json is normal — depth models ship no tokenizer.) The worker also hard-coded `device: 'webgpu', dtype: 'fp16'` (same fallback issue as the depth worker).
- **Fix:** `speech.worker.ts` now uses public `onnx-community/whisper-small.en` (full, non-distilled Whisper-small — accuracy on par or better; verified HTTP 200/307) with `device: 'auto', dtype: 'fp32'`. Verified live: worker downloads + initializes, no 401, overlay gone.
- **Avoid in future:** before wiring any model into an in-browser worker, verify the HF repo is public (`curl -sI https://huggingface.co/<repo>/resolve/main/...`) — gated repos need a token (which would be exposed in client JS) or a swap to a public mirror. Prefer public repos for client-side model downloads.
- **Status:** fixed

## 2026-08-26 — real ML workers crashed in dev: MIME video/mp2t + hard-coded WebGPU
- **Symptom:** running `pnpm dev` in a real browser, `[worker:depth] initialization failed Error: Worker crashed` / "Failed to load module script: The server responded with a non-JavaScript MIME type of video/mp2t"; the `AI:` pill stuck at LOADING…, so the topo-canvas brush produced no terrain. E2E never caught it — the mock seam (NEXT_PUBLIC_E2E) bypasses real workers entirely.
- **Root cause:** webpack only compiles `new Worker(new URL(...))` when the URL expression appears DIRECTLY as the constructor argument. `workerRegistry.ts` routed through a URL map (`new Worker(workerUrls[id], { type: 'module' })`), so webpack emitted each `.ts` as a raw media asset (`.next/static/media/*.worker.<hash>.ts`), and the dev server serves `.ts` with MIME `video/mp2t` (MPEG-TS) — strict module-script MIME checks kill it. Secondary: the workers hard-coded `device: 'webgpu', dtype: 'fp16'`, which throws "The device (webgpu) does not support fp16" on any browser without WebGPU.
- **Fix:** per-worker direct factories in `workerRegistry.ts` — `new Worker(new URL('./depth.worker.ts', import.meta.url))` (classic worker; the sources only use plain ESM imports, no top-level await). Depth worker: `device: 'auto'` (WebGPU when available, WASM otherwise). kokoro-js TTS: `device: 'wasm'` ('auto' is not in its `'cpu'|'wasm'|'webgpu'` union). Verified live: workers boot, depth-anything-v2-small loads over WASM, brush stroke → 16384-vert displaced terrain, 60 FPS.
- **Avoid in future:** keep every `new Worker(new URL(...))` syntactically direct — never index a URL map inside the constructor. After adding a real path alongside an e2e mock seam, boot `pnpm dev` in a real browser once per milestone and check the console for worker init errors. Device selection must fall back to WASM unless WebGPU availability is confirmed.
- **Status:** fixed

## 2026-08-26 — background-removal flood-fill ate light objects: meshes came out as slabs/blobs
- **Symptom:** every generated mesh looked like an ugly grey rock/slab — a wooden chair (bread-and-butter for TripoSR) reconstructed as a flat sheet (extents 0.936 × 0.924 × 0.397 — depth axis < half of width), and a face became a faceless blob.
- **Root cause:** the dependency-free border flood-fill in `backend/services/image_utils.py` (a stopgap for rembg, which TripoSR's own reference pipeline uses) erased the *object itself* for light subjects on white backgrounds. It walks pixels from the borders with a per-pixel tolerance chain; soft shadows and light wood grain on a white background are within tolerance, so the flood ate the whole chair — only **0.5–1.6%** of the image survived as "foreground". The model then reconstructed whatever sliver remained → degenerate slab. fp16 was exonerated (fp32 gave identical collapsed depth); decimation was exonerated (raw mesh identical to processed).
- **Fix:** `backend/services/image_utils.py` now uses **rembg (U²-Net)** as the primary background remover (lazy session, cached; fallback to the flood-fill heuristic only if rembg is unavailable — offline/no onnxruntime). Weights pinned to `U2NET_HOME = G:\hf-cache\u2net` in `backend/config.py` (knowledge.md: keep big downloads on G:). Installed `rembg[cpu]` (onnxruntime needed; base install lacks it). Verified: chair depth 0.398 → **0.572**, recognizable chair mesh (seat/back/legs) generated live through the UI.
- **Avoid in future:** never ship a hand-rolled background-removal heuristic for ML reconstruction pipelines — use the same model as the reference pipeline (rembg) from the start; the flood-fill is only a degraded offline fallback now. Also: when the vendor docs for a model's reference pipeline mention a dependency, treat that as the required dependency, not a suggestion.
- **Status:** fixed

## 2026-08-26 — generated meshes spawned sideways/upside-down with floating debris
- **Symptom:** every generated mesh loaded into the scene sideways/upside-down with "random parts" floating next to it — the chair rendered as a grey slab with detached chunks.
- **Root cause:** three separate gaps, all in the backend mesh pipeline (`mesh_processing.py`): (1) TripoSR outputs meshes in its tilted camera frame (objects lying down; vendored `utils.py` even documents the ray convention "x back, y right, z up") and nothing re-oriented them to the app's y-up world — the chair's height axis came out diagonal in X/Y; (2) TripoSR emits 15+ disconnected components (floating slivers and detached chunks like a 1,303-vert slab) that decimation never removed; (3) the flip/up-down orientation was a coin flip — the vertex-mass heuristic (47% below mid) was within noise of 50% and would have kept the chair upside down.
- **Fix:** `process_mesh` now runs — sanitize → **keep_largest_component** (drop debris) → **orient_upright** (PCA height axis → +Y; up/down decided by the baked vertex colors, which are sampled from the input photo: warm R−B at the top tip = wood/skin up; mass heuristic only as tiebreak) → decimate → smooth → sanitize → **keep_largest_component again** (decimation re-emits 3-vert slivers) → reground (min-y → 0) → recolor → export. Bounds now reported in world frame (min-y=0, x/z centered) so the frontend spawn code drops assets straight onto terrain.
- **Verified:** chair regenerated → extents [0.703, 1.025, 0.573] (height dominant on Y), feet at y=0, 1 connected component, warm backrest at top (tip R−B +14.8 vs +3.7); headshot also validated (face skin at top, R−B +20.1 vs +2.2). 40/40 backend tests (4 new for cleanup/orient), verified live through the UI.
- **Avoid in future:** never ship reconstruction-model output without (a) dropping non-largest components and (b) orienting to the app's world frame. The vendored model's "z up" camera convention is for the model's own viewers, not the app. Color-grounded orientation (photo-sampled vertex colors) beats geometric mass heuristics for up/down.
- **Status:** fixed

## 2026-08-26 — generated meshes faced the wrong way: arbitrary azimuth + TripoSR's tilted camera frame
- **Symptom:** even after standing meshes upright, they spawned "tilted and facing the wrong direction" — the photo's front of the object pointed away from the viewer.
- **Root cause:** (1) TripoSR outputs meshes in its own camera frame; the object's photo-facing side is +X in raw model space (its canonical training camera sits at azimuth 0 = +X — verified empirically by rendering the reconstruction with the model's own novel-view renderer from 4 azimuths and comparing to the input photo: azimuth 0 had the lowest object-pixel diff, 0.202 vs 0.305 worst). The upright fix (PCA height→Y) preserved that front, but the AZIMUTH around Y was whatever the PCA rotation produced — arbitrary. (2) The frontend spawned assets with rotation [0,0,0] and never considered the camera. (3) Latent bug: the vendored NeRF renderer's render path crashed in fp16 (`torch.linspace` for t_vals defaults to float32 → grid_sample dtype mismatch) — same bug class as the extract path, unfixed because the app never called `render()`.
- **Fix:** `orient_upright` now yaws the mesh so the photo-facing side (+X in raw space) faces world +Z (documented convention; frontend-agnostic). Frontend: `facingAzimuthToward(cameraX, cameraZ, spawnX, spawnZ)` computes the yaw that points +Z at the live camera; `buildMeshEntity` applies it as `rotation=[0, yaw, 0]`; a `CameraProbe` (useFrame in Scene.tsx) mirrors the orbiting camera into a module-level `cameraRef` (no zustand churn at 60 fps). Patched `nerf_renderer.py` with two EchoForge dtype casts (positions→triplane dtype, t_vals dtype).
- **Verified:** unit tests for front→+Z (backend) + yaw math (frontend); regenerated chair: front yaw = atan2(10,12) ≈ 0.695 rad toward the default camera; screenshot shows the chair facing the viewer in the photo's 3/4 pose. 41 backend tests, 93 frontend, 13/13 e2e.
- **Avoid in future:** a "stand it up" fix is incomplete without fixing the azimuth — reconstruction models have a deterministic photo-facing side; use it. When a vendored code path (e.g. `render()`) is dead code, it can still hide dtype bugs; patch consistently.
- **Status:** fixed

## 2026-08-26 — TripoSR fp16 + torchmcubes unavailability (Task 2.3)
- **Symptom:** `expected scalar type Half but found Float` during TripoSR extraction; and `torchmcubes` (a hard import in the vendored pipeline) has no prebuilt wheel — its source build needs MSVC + libtorch ABI, unavailable on Windows.
- **Root cause:** the triplane renderer builds fp32 `torch.linspace` grid vertices while the decoder is fp16; the image preprocessor also emits fp32. The marching-cubes call is the only torchmcubes usage.
- **Fix:** three dtype casts patched into `backend/vendor/tsr/system.py`; `backend/shims/torchmcubes_stub.py` prefers PyMCubes (C++ wheel) with a skimage fallback and is registered in `sys.modules`. fp16 + `chunk_size=16384` + resolution 192 took extraction from ~200s to ~3s.
- **Avoid in future:** when vendoring an inference pipeline, keep a patch list in the vendor README; prefer pure-wheel backends (PyMCubes) over source-only CUDA extensions on Windows.
- **Status:** fixed


## 2026-08-26 — three r185 TSL build has no chainable bloom/ssao/fxaa nodes (Task 3.5)
- **Symptom:** the spec's `pass(scene, camera).pipe(bloom).pipe(fxaa)` WebGPU post chain couldn't be built; `import { bloom } from 'three/tsl'` didn't exist.
- **Root cause:** three 0.185's `three.tsl.js` exports `pass`/`passTexture` but NO post-processing effect nodes (`grep bloom` = 0; the chainable `.bloom()`/`.ssao()` methods landed in later releases).
- **Fix:** dual path — WebGL (default, CI-verified): `three/addons` EffectComposer + UnrealBloomPass + FXAA + OutputPass (zero new deps). WebGPU: `PostProcessing` + `pass(scene, camera)` with runtime feature-detection of `passNode.bloom()` so a future three upgrade unlocks the chain with no code change.
- **Avoid in future:** check the installed three version's TSL exports before promising chainable post nodes; feature-detect runtime APIs when the version is pinned.
- **Status:** fixed

## 2026-08-26 — R3F v9 only renders the scene when no subscriber takes render priority (Task 3.5)
- **Symptom:** risk of double-rendering the scene (composer + default gl.render) when wiring an EffectComposer.
- **Root cause:** uncertainty about fiber v9's loop semantics.
- **Fix:** verified in `node_modules/@react-three/fiber/dist/events-*.esm.js` — the loop calls `if (!state.internal.priority && state.gl.render) state.gl.render(...)`, and any `useFrame(cb, renderPriority > 0)` subscriber increments `internal.priority`. So `useFrame(() => composer.render(), 1)` takes over rendering cleanly.
- **Avoid in future:** when taking over the render loop in R3F, pass a positive renderPriority — do NOT also call gl.render manually.
- **Status:** fixed

## 2026-08-26 — GLB JSON chunks must pad with spaces, not NULs (Task 3.6)
- **Symptom:** a hand-built test GLB failed to parse in the export merge (entity silently skipped).
- **Root cause:** the JSON chunk was padded with zero bytes; `JSON.parse` rejects NUL characters. The glTF spec mandates padding with 0x20 (space).
- **Fix:** test builder pads with `0x20`; the runtime parser tolerates both.
- **Avoid in future:** any GLB authoring tooling must pad JSON chunks with spaces.
- **Status:** fixed

## 2026-08-26 — Phase 3 live audit (GPU watchdog + SDXL hang)
- **Symptom:** `taskkill //PID $! //T //F` from Git Bash silently killed nothing; zombie python processes survived with CUDA contexts and pegged the GPU at 7.7/8 GB, making every subsequent GPU test *appear* to hang (SDXL texture, UNet repro).
- **Root cause:** three compounding Windows gotchas — (1) Git Bash `$!` is an MSYS pid, not a Windows pid, so `taskkill` misses; (2) `.venv/Scripts/python.exe` is a stub that spawns the real `C:\Users\...\Python311\python.exe`, so killing the stub can orphan the real process; (3) `wmic get ProcessId,CommandLine` returns columns alphabetically (CommandLine first) and truncates long lines, so a naive `awk '{print $1}'` grabbed the path, not the pid.
- **Fix:** `scripts/gpu/run_guarded.sh` resolves real pids via single-column `wmic process where "name='python.exe' and CommandLine like '%MARKER%'" get ProcessId` and sweeps repeatedly (the stub spawns the real python asynchronously). Added `scripts/gpu/pyprocs.ps1` for inspecting stragglers. Backend `GpuWatchdog` in `vram_manager.py` force-exits the process when a GPU job exceeds its slot deadline (hung CUDA kernels can't be cancelled from Python).
- **Avoid in future:** never trust `$!` for Windows process kills; always resolve via wmic/PowerShell by command-line marker; verify `nvidia-smi` memory is at baseline (~1–2 GB) before judging whether a GPU job is hung.
- **Status:** fixed (watchdog) + SDXL hang itself still open (see handoff RESUME POINT).

- **Symptom:** real SDXL-Turbo fp16 `/api/v1/generate-texture` on CUDA crashed with `'NoneType' object has no attribute 'pop'`.
- **Root cause:** diffusers 0.31's `callback_on_step_end` hook contract — the callback must RETURN the kwargs dict; 0.31 pops `"latents"` off the return value. Our callback returned `None`.
- **Fix:** `sdxl_service.py` `on_step_end` now returns `callback_kwargs` (the standard hook contract).
- **Avoid in future:** when using `callback_on_step_end` (or `callback_on_step_end_tensor_inputs`), always return the kwargs dict.
- **Status:** fixed.

- **Symptom:** full backend pytest suite hung forever after adding an audio WebSocket test; the mesh WS test's `receive_json()` blocked.
- **Root cause:** the new test's TestClient bound the singleton `progress_bus._loop` to its own event loop; later tests' `publish_sync` events were posted onto that stale (closed) loop and never reached the current client's queue.
- **Fix:** reset the bus between tests in `backend/tests/conftest.py` (re-create the `ProgressBus` singleton per test).
- **Avoid in future:** any test that touches `progress_bus` must not leak a loop binding into the module-level singleton; reset it in conftest.
- **Status:** fixed.


## 2026-08-26 — SDXL-Turbo "hang" was allocator thrash + zombie contamination, not a kernel bug
- **Symptom:** real SDXL-Turbo fp16 1-step texture generation never completed; GPU pegged 100% / 7.7 GB for 15+ min on an 8 GB RTX 2070.
- **Root cause (clean-GPU isolation):** the bare fp16 UNet forward completes in 0.3 s at 5.0 GB peak (`.audit/repro_unet_modes.py`). The full-resident pipeline (6.7 GB) thrashes at 7.5/8 GB when the forward's cuDNN workspace can't fit — 100% GPU, never returns. The production path (`enable_model_cpu_offload()`) runs 0 MB before gen and peaks 5.1 GB (`.audit/repro_prod.py`: 7.9 s, 512×512 PNG). The live-battery failures were orphaned/zombie backend processes holding 7.7 GB while a fresh backend thrashed against them.
- **Fix:** none needed in production — offload already engages (verified: hooks on all 4 components). Real fixes were in the battery script: cp1252 `≈` crash; WS jobId race (server publishes DURING the POST, so events arrive before `captured["job"]` — buffer until the jobId is known); 2-tuple tally unpacked as 3.
- **Avoid in future:** before judging any GPU hang, verify `nvidia-smi` memory ≈ 1–2 GB (zombies keep CUDA contexts); never run full-resident pipelines on the 8 GB card; keep the watchdog (`scripts/gpu/run_guarded.sh`) as the backstop.
- **Status:** resolved — live GPU battery 30/30, all static gates + 120 unit + 64 pytest + 21/21 e2e green.

## 2026-08-26 21:08 — `8e2426f` (auto-captured)
**fix: resolve SDXL-Turbo "hang" — allocator thrash, not a kernel bug; harden live battery**

Enriched in-place: see the full Symptom / Root cause / Fix / Avoid-in-future entry directly above ("2026-08-26 — SDXL-Turbo 'hang' was allocator thrash + zombie contamination"). This commit also carried the battery-script hardening (cp1252 `≈` crash, WS jobId race, 2-tuple tally).


## 2026-08-26 — drei Grid invisible on WebGPU (ShaderMaterial incompatibility) + WebGPU adapter gotchas
- **Symptom:** with NEXT_PUBLIC_ENABLE_WEBGPU=true on the real GPU, the scene rendered but the grid floor was gone and the console logged `THREE.NodeBuilder: Material "ShaderMaterial" is not compatible.`
- **Root cause:** drei's `<Grid>` is built on `shaderMaterial` (classic THREE.ShaderMaterial); three r185's WebGPURenderer compiles everything through NodeBuilder, has no conversion for ShaderMaterial, logs the error and substitutes an empty NodeMaterial — the mesh renders nothing.
- **Fix:** replaced with `src/components/viewport/GridFloor.tsx`, a pure-TSL grid (MeshBasicNodeMaterial with colorNode/opacityNode; world-aligned lines via `positionWorld.x/z`, `min` of the x/z fract patterns, radial fade). Renders identically on WebGL + WebGPU; pixel-verified on both.
- **WebGPU adapter gotchas (all three bit during verification):** (1) Playwright's bundled Chromium has no WebGPU adapter — use the real Chrome via `channel: 'chrome'`; (2) headless exposes no adapter and three's WebGPURenderer silently falls back to WebGL2, so the app "works" but isn't WebGPU — always check `canvas.getContext('webgpu')` is truthy; (3) `--enable-features=Vulkan,DefaultANGLEVulkan` makes `requestAdapter()` return null on Windows (Dawn tries Vulkan and fails) — pass no GPU flags, Chrome enables WebGPU by default on localhost.
- **Avoid in future:** any scene material must be a TSL node material (Mesh*NodeMaterial) or a classic material with a library conversion (LineBasicMaterial etc.) — never raw ShaderMaterial — or it silently vanishes on the WebGPU path.
- **Status:** fixed; WebGPU check 7/7, WebGL + WebGPU both pixel-verified, 120 unit + 68 pytest + 21/21 e2e green.

## 2026-08-26 21:44 — `290ce26` (auto-captured)
**feat: real SmolVLM vision path + real-GPU WebGPU verification with TSL grid fix**

  - Files:
    - backend/config.py
    - backend/requirements.txt
    - backend/services/smolvlm_service.py
    - backend/tests/test_npc.py
    - docs/lessons-learned.md
    - handoff.md
    - knowledge.md
    - scripts/gpu/webgpu-check.mjs
    - src/components/viewport/GridFloor.tsx
    - src/components/viewport/Scene.tsx
  - TODO (agent): expand with Symptom / Root cause / Fix / Avoid in future, then remove the '(auto-captured)' marker.


Enriched in-place: see the full Symptom / Root cause / Fix / Avoid-in-future entry directly above ("2026-08-26 — drei Grid invisible on WebGPU"). This commit also carried the real SmolVLM path (qwen-vl-utils, processor + AutoModelForImageTextToText) and the WebGPU adapter launch gotchas.
## 2026-08-26 — Real AudioGen under torch 2.5 (audiocraft 1.3.0)

**Symptom:** The spec's real text-to-audio model (facebook/audiogen-medium) was believed gated (needs HF_TOKEN + accepted license). Attempts to install audiocraft 1.3.0 the normal way conflict with the repo's pinned torch 2.5.0+cu121 (audiocraft pins torch==2.1.0, xformers<0.0.23, av==11.0.0).

**Root cause / facts established:**
- The model is NOT gated — verified via the HF API (`gated: false`); weights (~3.9 GB) download anonymously. The earlier handoff note was wrong.
- No xformers Windows wheel exists for torch 2.5 on the pytorch index (newest, 0.0.27, pins torch 2.4). audiocraft's DEFAULT attention backend is `'torch'` (native SDPA) — xformers is never actually called — but transformer.py imports it unconditionally, so `--no-deps` + a guarded try/except patch on the import is the clean fix (re-apply after any audiocraft reinstall).
- `AudioGen` is a wrapper ABC, not an nn.Module: `get_pretrained(repo, device=...)` (no `.eval()/.to()`). Generate via `set_generation_params(duration=...)` then `model.generate([prompt])`.

**Fix:** `backend/requirements-audiocraft.txt` documents the --no-deps install + runtime deps; `audio_service.py` drives the wrapper API directly and still degrades to the procedural synthesizer when audiocraft is missing.

**Second bug found live (10 s request):** make_loopable crossfades away the last 0.5 s, so we generate `duration + 0.5` — but AudioGen caps at max_duration=10 s and requesting more silently switches to the extended streaming continuation path, which is pathologically slow (~7 min for 10.5 s → watchdog kill). Fix: clamp the fade budget to `max_duration - duration` (10 s clips emit the raw one-shot, no crossfade). Verified: 10.00 s WAV in ~47 s.

**Open issue (see handoff RESUME POINT):** browser-driven AudioGen is ~10x slower than curl (>414 s vs 40 s for identical 500-step jobs). Pausing the viewport render loop did NOT fix it. Leading hypothesis: Chrome's GPU footprint pushes VRAM toward the 8 GB cap so AudioGen's cuDNN workspace thrashes (same mechanism as the old SDXL hang).

**Avoid in future:** (1) verify HF gating via the API before planning around a token; (2) never add an unconditional import of an optional dep — guard it; (3) respect a model's max_duration when adding a crossfade/overshoot budget; (4) for timing comparisons, keep the browser closed or instrument VRAM — a headed browser changes the GPU's available memory pool.

## 2026-08-26 23:27 — `fa71168` (auto-captured)
_Enriched in-place: see the full entry directly above ("2026-08-26 — Real AudioGen under torch 2.5"). This commit also carried the 10 s duration-clamp fix and the timing harnesses (`scripts/gpu/ui_audio_timing.mjs`, `scripts/gpu/time_audio_curl.py`). The browser-driven slowdown is logged in handoff.md as the next-session RESUME POINT._
**feat: real AudioGen end-to-end + fix 10s duration clamp; log browser-driven slowdown for next session**

  - Files:
    - backend/config.py
    - backend/requirements-audiocraft.txt
    - backend/scripts/download_models.py
    - backend/services/audio_service.py
    - backend/services/procedural_audio.py
    - handoff.md
    - scripts/gpu/live_api_battery.py
    - scripts/gpu/time_audio_curl.py
    - scripts/gpu/ui_audio_timing.mjs
  - TODO (agent): expand with Symptom / Root cause / Fix / Avoid in future, then remove the '(auto-captured, needs enrichment)' marker.

## 2026-09-04 17:04 — `87b44f8` (auto-captured, needs enrichment)
**feat(mesh): add Hunyuan3D provider and orientation fix**

  - Files:
    - .agents/skills/echoforge-mesh-quality/SKILL.md
    - backend/.env.example
    - backend/config.py
    - backend/routers/generate.py
    - backend/services/hunyuan_service.py
    - backend/services/mesh_processing.py
    - backend/tests/test_generate.py
    - backend/tests/test_hunyuan_service.py
    - backend/tests/test_mesh_processing.py
    - docs/mesh-backends.md
    - scripts/gpu/start_hunyuan_sidecar.sh
    - src/components/viewport/GridFloor.tsx
  - TODO (agent): expand with Symptom / Root cause / Fix / Avoid in future, then remove the '(auto-captured, needs enrichment)' marker.

## 2026-09-04 18:41 — `aea4b2e`
**fix(mesh): preserve shading and improve Hunyuan materials**

- **Symptom:** Hunyuan exports rendered more faceted than expected, and neutral
  geometry-only output was too orange for dark wooden references.
- **Root cause:** The final Trimesh normal cache was not touched before GLB
  export, so `NORMAL` was omitted. The default fallback color also used a
  brighter orange-brown base.
- **Fix:** Compute final vertex normals before export, switch the fallback to a
  darker walnut base, and add regression assertions for `NORMAL` and `COLOR_0`.
- **Avoid in future:** Validate exported GLB attributes and inspect a real
  generated asset, rather than relying only on mesh validity or unit tests.
