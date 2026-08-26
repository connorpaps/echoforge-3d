# Phase 2 Backend AI Microservice Plan — EchoForge 3D

**Date:** 2026-08-26
**Status:** ✅ COMPLETE — executed 2026-08-26 (all tasks verified exit 0)
**Spec source:** `docs/08_TASKS.md` Phase 2 (Tasks 2.1–2.5), `docs/04_API_CONTRACTS.md`, `docs/02_DESIGN_BRIEF.md`

---

## Scope

Phase 2 delivers the FastAPI generative backend and its frontend wiring: a
serialized VRAM queue manager, TripoSR image-to-mesh, SDXL-Turbo text-to-texture,
mesh decimation/collider baking, a WebSocket progress channel, and the
generation UI (upload → shimmer → toast) with a live VRAM meter.

**Approved decisions:** ship both TripoSR and SDXL-Turbo; generation via button +
image upload; in-process queue (no external broker); TRELLIS deferred (Linux-only,
≥16 GB VRAM requirement vs this machine's 8 GB RTX 2070).

## Task execution

| Task | Deliverable | Commit(s) | Gates |
| :-- | :-- | :-- | :-- |
| 2.1 | FastAPI app + CORS + `GET /health` (CUDA device + VRAM) + pytest infra | `5a1fcda` | 35 unit ✓ |
| 2.2 | `SequentialVRAMManager` (serial, evict `del model`+gc+empty_cache+ipc_collect, <6 GB peak) | `5a1fcda` | 35 unit incl. CUDA peak test ✓ |
| 2.3 | TripoSR mesh endpoint (vendored tsr, torchmcubes shim, fp16, chunked) + SDXL-Turbo endpoint (model CPU offload) | `5a1fcda` | live GPU verify ✓ |
| 2.4 | Mesh pipeline: decimation ≤20k faces, Laplacian, normal fix, hulls, bounds, GLB | `5a1fcda` | 35 unit + live GLB ✓ |
| 2.5 | WebSocket progress channel + frontend generation UI (upload, emerald shimmer, VRAM meter, glass toasts) | `5b1a2c3` | 84 unit + 13 e2e ✓ |

Final suite: **typecheck exit 0 · lint exit 0 · 35 backend tests · 84 frontend
tests · 13 e2e tests (serial, ~35s)**. Live GPU verification: mesh extract ~3s
(was ~200s), SDXL 512² generation ~10s with peak VRAM 5.3 GB.

## Deviations & root-caused fixes

### 1. SDXL-Turbo "hang" = allocator thrash, not a deadlock
The fp16 pipeline is ~6.6 GB of weights (UNet 4.9 GB) leaving <1 GB headroom on
an 8 GB card, so a single 1-step job thrashed for 40s+. **Fix:**
`enable_model_cpu_offload()` + VAE slicing/tiling → peak 5.3 GB, ~10s at 512².

### 2. diffusers 0.31 legacy callback breakage
`callback` required `callback_steps` (else `i % callback_steps` → NoneType) and
changed signature to `(step, timestep, latents)`. **Fix:** use the modern
`callback_on_step_end` hook.

### 3. TripoSR fp16 dtype mismatches
The vendored triplane renderer mixed fp32 grid vertices with the fp16 decoder.
**Fix:** three casts in `backend/vendor/tsr/system.py` (image input, grid
vertices, MC output).

### 4. torchmcubes unavailable on Windows (no MSVC)
**Fix:** `backend/shims/torchmcubes_stub.py` prefers PyMCubes (C++ wheel) and
falls back to skimage; resolution default 192 + fp16 took extraction from ~200s
to ~3s.

### 5. HF cache relocation (user-reported C: exhaustion)
40.8 GB HF cache + pip/npm/playwright caches lived on C:. Moved to G: with
persistent env/config (`HF_HOME`, pip/npm cache-dir, `PLAYWRIGHT_BROWSERS_PATH`);
C: freed 5.8 GB → 60.9 GB. Windows HF caches store snapshots as symlinks —
robocopy dereferences them into real files (gemma refs repaired manually).
