---
name: echoforge-mesh-quality
description: Improve and validate EchoForge image-to-3D mesh generation with safe model selection, VRAM-aware backends, GLB inspection, and visual QA. Use when changing TripoSR, Hunyuan3D, mesh postprocessing, generation adapters, or 3D output quality.
---

# EchoForge Mesh Quality

Use this project skill for image-to-3D work in EchoForge 3D. Combine it with the repository `AGENTS.md`, `knowledge.md`, and Hermes skills for systematic debugging and visual-generation validation.

## Source of truth and boundaries

1. Read `AGENTS.md`, `knowledge.md`, `handoff.md`, the relevant `docs/` specification, and current git status before editing.
2. Keep repository-local skills under `.agents/skills/`. Do not copy project-specific rules into Hermes-global skills.
3. Do not read or print `.env`, tokens, private uploads, or credential files.
4. Keep large model, pip, uv, and runtime caches on `G:`. The project cache convention is `G:\hf-cache`; sidecar environments belong outside the repository when their dependencies conflict.
5. Do not commit or push unless explicitly requested.

## Model-selection policy

- TRELLIS and TRELLIS.2 are not local defaults for an 8 GB RTX 2070. Official requirements are at least 16 GB and Linux-oriented for TRELLIS 1, with heavier requirements for TRELLIS.2.
- Prefer a tested, isolated Hunyuan3D-2GP sidecar when a material quality improvement is required and the machine has enough system RAM. Start with shape-only generation; treat Hunyuan texture generation as a separate, opt-in stage because it has a much higher VRAM requirement.
- Keep TripoSR as a working fallback. A model swap must not make the normal app unusable when the optional sidecar is absent.
- Record the upstream revision, model variant, license, Python/CUDA/Torch versions, cache path, VRAM peak, elapsed time, and output quality for each real comparison.
- Hunyuan3D-2GP and Tencent Hunyuan weights are non-commercial. Surface this constraint in project documentation before any public or commercial use.

## Safe integration shape

Use an adapter boundary rather than importing conflicting model stacks into the main FastAPI environment:

- Main backend owns the stable `/api/v1/generate-mesh` contract and postprocessing.
- Optional Hunyuan sidecar exposes a local HTTP endpoint and returns a GLB or raw mesh bytes.
- Main backend validates and normalizes sidecar output through the existing `mesh_processing.process_mesh` path.
- Route all main-backend heavy models through `SequentialVRAMManager`.
- Do not run TripoSR and Hunyuan inference concurrently on the same GPU. Use one configured backend per run or an explicit cross-process lock.
- If the sidecar is unavailable, either use the configured fallback or return a clear error. Never silently label a TripoSR result as Hunyuan.

## Input and preprocessing checks

For every comparison fixture, record:

- image dimensions and square-crop behavior;
- foreground occupancy and background quality;
- object orientation and visible front side;
- thin structures such as chair legs, handles, and supports;
- whether the upload has alpha;
- whether the model receives the same prepared image.

Prefer a public or synthetic fixture with a clean, isolated object. Keep the original fixture unchanged and do not upload private images to external services.

## Output validation

A successful HTTP response is not enough. For each GLB:

1. Verify the GLB magic, version, and declared length.
2. Load it with `trimesh` and assert non-empty vertices and faces.
3. Check finite vertices, face count at or below the project cap, connected components, bounds, extents, ground contact, normals, colors/materials, and detached debris.
4. Confirm the output is the requested object, not a slab, silhouette, or unrelated blob.
5. Render it in the actual EchoForge browser UI at a realistic viewport size. Inspect recognizability, proportions, orientation, material, lighting, camera framing, scale, and ground contact.
6. Check browser console and backend logs after the live generation.

Classify visual failures in this order: harness/setup, frontend presentation, preprocessing, postprocessing, then model capability. Fix the earliest failing layer first.

## Verification ladder

Run the smallest relevant check first, then expand:

```bash
# Backend contract and mesh pipeline
.venv/Scripts/python.exe -m pytest backend/tests/test_mesh_processing.py backend/tests/test_generate.py -q

# Frontend generation and scene bridge
pnpm exec vitest run src/lib/generation src/lib/api

# Static gates
pnpm run typecheck
pnpm run lint
pnpm run build

# Full suites, serial E2E only
.venv/Scripts/python.exe -m pytest backend/tests -q
pnpm run test
pnpm run test:e2e

git diff --check
git status --short --branch
```

When a GPU test is needed, verify `nvidia-smi` before and after the run. Use the repository guarded GPU scripts when available, set an explicit timeout, and kill orphaned Python workers before interpreting a hang. A clean health response does not prove model quality, and passing DOM assertions does not prove a valid rendered 3D result.

## Reusable comparison record

For each model run, save a small local record containing:

- backend and upstream revision;
- model variant and parameters;
- input fixture identifier;
- elapsed time;
- peak VRAM;
- face and vertex counts;
- extents and connected-component count;
- structural validation result;
- visual verdict and screenshot path;
- known license or deployment limitations.

Do not store secrets, private image bytes, or transient task state in this skill.
