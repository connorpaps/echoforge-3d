# Phase 1 Foundation Plan — EchoForge 3D

**Date:** 2026-08-25
**Status:** ✅ COMPLETE — executed 2026-08-25 (all tasks verified exit 0)
**Spec source:** `docs/08_TASKS.md` Phase 1 (Tasks 1.1–1.5), `DESIGN.md`, `docs/03_TECH_SPEC.md`

---

## Scope

Phase 1 delivers the first renderable, interactive foundation of EchoForge 3D:
an app shell with the resizable 3D workstation, Web Worker ML infrastructure,
push-to-talk speech recognition, the 2D topographic canvas with TSL-displaced
terrain, and Rapier physics with first-person locomotion.

**Stack upgrade (developer-approved):** three `0.170 → 0.185`, R3F `8 → 9.7.0`,
drei `10.x`, rapier `2.2.0` (WebGL default; WebGPU via async `gl` factory behind
`NEXT_PUBLIC_ENABLE_WEBGPU`; all materials TSL).

## Task execution

| Task | Deliverable | Commit(s) | Gates |
| :-- | :-- | :-- | :-- |
| 1.1a | Stack upgrade to R3F 9 / three 0.185 + test tooling (eslint flat, vitest, playwright) | `da77d4e` | typecheck ✓ |
| 1.1b | App shell: design tokens, resizable workstation, viewport canvas, UI primitives, unit tests, e2e shell spec | `61b6166` | typecheck, lint, 11 unit, 3 e2e ✓ |
| 1.2 | Typed worker factory + registry + 3 ML workers (depth/speech/tts) + `useWorker` hook | `d1299c6`, `11ee798` | typecheck, lint, 19 unit ✓ |
| 1.3 | Distil-Whisper speech recognition + push-to-talk voice pill + prompt bar | `70da4d5`, +test stragglers | typecheck, 31 unit, 5 e2e ✓ |
| 1.4 | 2D topo canvas + heightmap + TSL terrain displacement (CUJ-01) | `fd2d63e` | typecheck, 45 unit, 7 e2e ✓ |
| 1.5 | Rapier heightfield collider + first-person locomotion (CUJ-03) | `4b03d5d` | typecheck, lint, 62 unit, 9 e2e ✓ |

Final suite: **typecheck exit 0 · lint exit 0 · 62 unit tests · 9 e2e tests (serial, ~25s)**.

## Deviations & root-caused fixes

### 1. `PORT=0` in the environment hijacked the dev server
Playwright's URL probe never answered because Next.js honored `PORT=0` (random
port 11187). **Fix:** pin the port explicitly in `playwright.config.ts`
(`webServer.command` uses `-p 3000`, env cleared for the server).

### 2. Worker `READY` handshake deadlock
Workers replied `READY` without echoing the requestId, so the client's `INIT`
promise never resolved and tests hung. **Fix:** `READY` carries the requestId;
the client resolves the pending `INIT` with it.

### 3. Vite worker plugin requires static URLs
A template-string `new Worker(url)` broke vitest. **Fix:** static URL registry.

### 4. E2E machine freeze (user-reported)
7 tests × parallel Chromium instances, each doing CPU-software WebGL, saturated
the machine. **Fix:** `workers: 1` (strictly serial) — now ~25s, no freeze.

### 5. Rapier heightfield wasm crash (`RuntimeError: unreachable`)
Every page load crashed inside `@dimforge/rapier3d-compat@0.19.2`'s dim3
`heightfield` binding. Root-caused against the Rust source
(`DMatrix::from_vec(nrows + 1, ncols + 1, heights)`): the binding expects
**cell counts** with a `(cells+1)²` sample grid. Passing `size` cells with
`size²` heights traps the wasm module. **Fix:** `width/height = size-1`.

### 6. Player fell through the terrain (even after the crash fix)
Three more binding quirks, all verified empirically via `world.debugRender()`:
- **Scale is full extent, not per-cell width** — the local grid is normalized
  to ±0.5, so `scale.x/z` must be `TERRAIN_WORLD_SIZE` (64), not `64/127`.
  With per-cell scale the terrain collapsed to a 1×1 patch and nothing collided.
- **DMatrix column-major construction transposes the layout** — rapier places
  `heights[i * ncols + j]` at world (x = i, z = j) while our mesh places
  `heightmap[z * size + x]` at (x, z = size-1-z). A converter
  (`heightmapToPhysicsGrid`) remaps the mesh grid onto rapier's; verified with
  off-center bump probes matching mesh positions exactly.

## Verification evidence

- `pnpm typecheck` → exit 0
- `pnpm lint` → exit 0 (eslint.config.mjs FlatCompat + ignores for `.agents/skills`)
- `pnpm test` → 62 passed
- `pnpm test:e2e` → 9 passed incl. CUJ-01 (brush → displaced terrain),
  CUJ-03 (Tab → play mode, W walks the player over the heightfield), voice
  pill mock-seam dictation, FPS ≥ 30 software-render floor
- Rapid-fire manual dev-server check: page compiles, viewport renders

## Notes for later phases

- `world.castRay` returns NaN in this compat build even against a cuboid —
  do not use it for gameplay queries without re-verifying on an upgraded rapier.
- AudioGen (Phase 2) still deferred: `audiocraft` pins `torch==2.1.0`; install
  with `--no-deps` when integrated.
- CUJ-02 (voice → topo) is implemented through the mock seam only; the real
  Depth-Anything worker path is validated in Task 2.x with real weights.
