# Phase 0 Initialization Plan — EchoForge 3D

**Date:** 2026-08-25
**Status:** Ready for approval (execution gated on approval)
**Governing skills (installed):** `superpowers/writing-plans`, `superpowers/executing-plans`, `superpowers/verification-before-completion`, `superpowers/systematic-debugging`, `vercel-react-best-practices`, `r3f-fundamentals`, `pytorch/pytorch`, `api-design`, `transformers-js`
**Spec source:** `docs/08_TASKS.md` Phase 0 (Tasks 0.1, 0.3, 0.4), `docs/03_TECH_SPEC.md`, `docs/07_SECURITY_AND_ENV.md`

---

## 0. Context & environment (verified this session)

| Item | Value |
| :--- | :--- |
| OS / shell | Windows 10 (Git Bash / MINGW64) |
| Node / npm / corepack | v24.14.0 / 11.9.0 / 0.34.6 |
| Python / pip | 3.11.0 / 22.3.1 |
| GPU | NVIDIA RTX 2070 — 8 GB VRAM (CUDA-capable, spec Tier 2) |
| RAM / free disk | 32 GB / 699 GB |
| Git | 2.53.0, `core.longpaths=true` (set globally to fix long-path clone failures) |
| Skills installed | **471 skills / 13 repos** in `.agents/skills/` (Task 0.2 done) |

### Task 0.2 completion notes (already executed)
- 14-repo matrix installed via `npx -y skills add`. Corrections made where upstream names did not resolve:
  - `obras/superpowers` -> `obra/superpowers` (13 skills)
  - `skills.sh/grill-me` -> `mattpocock/skills` (grill-me)
  - `everything-claude-code/api-design` -> `affaan-m/everything-claude-code` (api-design)
  - `NeverSight/learn-skills.dev` -> extracted `idb-state-persistence` manually (upstream repo contains a colon path illegal on Windows NTFS)
  - `pytorch/pytorch` -> installs after enabling `core.longpaths`
  - `VoltAgent/awesome-design-md` -> **no SKILL.md exists in the repo**; per DESIGN.md / docs/02_DESIGN_BRIEF.md the design system draws from Linear + Raycast + Supabase presets. Resolution: scaffold a full `awesome-design-md` SKILL.md referencing those presets with `./DESIGN.md` as the override rulebook.
  - `Leonxlnx/taste-skill` -> installed 13 skills; upstream renamed the canonical `taste` skill (`gpt-taste`, `design-taste-frontend`, etc.). Equivalents present; AGENTS.md routing stays valid.

### Approved decisions (user-confirmed)
1. **Model pre-cache (0.4):** script includes all 4 models; **run now** for TripoSR + SDXL-Turbo + SmolVLM (~7-9 GB). AudioGen is gated (license + HF_TOKEN) -> skipped gracefully until a token is provided.
2. **awesome-design-md:** scaffold full `SKILL.md` with YAML frontmatter (Linear/Raycast/Supabase presets; DESIGN.md is the override).
3. **Skills versioning:** commit `.agents/skills/` + `skills-lock.json`; keep `.claude/` (per-agent symlinks) and `.freebuff/` gitignored.
4. **pnpm:** install globally via `npm i -g pnpm`; authorized to install any other tooling needed (Playwright browsers for visual QA).
5. **Backend env:** project venv `.venv/` (already gitignored); all pip/verification commands run through it.

---

## Task 0.1 — Workspace directory tree & .gitignore

**Governing skills:** `superpowers/executing-plans`, `superpowers/verification-before-completion`

1. Create the full Phase 0 tree (from `docs/08_TASKS.md` Task 0.1):
   ```bash
   mkdir -p src/app src/components/viewport src/components/ui src/workers \
     src/lib/audio src/lib/physics src/lib/stores \
     backend/services backend/routers backend/tests backend/scripts \
     docs/plans .audit
   ```
2. Add `.gitkeep` to each empty directory so git tracks the structure.
3. Update `.gitignore`:
   - **Remove** `.agents/` (skills are now versioned)
   - **Add** `.claude/` (per-agent symlinks, regenerable)
   - Keep existing: `node_modules/`, `.next/`, `out/`, `.env`, `.env.*` (+ `!.env.example`), `__pycache__/`, `*.py[cod]`, `.venv/`, `venv/`, `.audit/`, `docs/activity-watch.log`, `docs/.last-machine`, `.freebuff/`
4. **Verification (exit 0):**
   ```bash
   for d in src/app src/components/viewport src/components/ui src/workers src/lib/audio src/lib/physics src/lib/stores backend/services backend/routers backend/tests backend/scripts docs/plans .audit; do [ -d "$d" ] || echo "MISSING $d"; done; echo "tree OK"
   git check-ignore .claude/ .venv/
   ```

## Task 0.3 — Dependency configuration & lockfiles

**Governing skills:** `vercel-react-best-practices`, `r3f-fundamentals`, `pytorch/pytorch`, `api-design`

### 0.3a — pnpm (global install, authorized)
```bash
npm i -g pnpm
pnpm --version        # expect exit 0
```

### 0.3b — Frontend manifests (created by hand; `create-next-app` deferred so Phase 1 owns scaffolding)
Files to create:
- `package.json` — pinned dependency set from the project spec (Next 15, React 19, Three WebGPU, R3F, Rapier, Zustand, idb-keyval, transformers.js, kokoro-js, Tailwind v4, Vitest, Playwright)
- `tsconfig.json` — strict mode, `@/*` path alias, Next plugin
- `next.config.ts` — WebAssembly + server-boundary fallbacks (from `docs/03_TECH_SPEC.md` sec 2, TS flavor)
- `next-env.d.ts` — standard Next 15 reference types
- `postcss.config.mjs` + Tailwind v4 entry (minimal; token wiring is Task 1.1 per `docs/08_TASKS.md`)

**Copy-ready `package.json`:**
```json
{
  "name": "echoforge-3d",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@huggingface/transformers": "^3.0.2",
    "@react-three/drei": "^9.117.0",
    "@react-three/fiber": "^8.17.10",
    "@react-three/rapier": "^1.5.0",
    "clsx": "^2.1.1",
    "idb-keyval": "^6.2.1",
    "kokoro-js": "^1.1.0",
    "lucide-react": "^0.454.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-resizable-panels": "^2.1.6",
    "tailwind-merge": "^2.5.4",
    "three": "^0.170.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/three": "^0.170.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Copy-ready `tsconfig.json` (strict):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
Install + lock:
```bash
pnpm install                       # exit 0, writes pnpm-lock.yaml
pnpm exec tsc --noEmit             # exit 0 (next-env.d.ts is a valid input)
pnpm exec playwright install chromium   # visual QA tooling (authorized)
```

### 0.3c — Backend requirements (venv)
Create `backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
torch==2.5.0
torchvision==0.20.0
diffusers==0.31.0
transformers==4.46.0
accelerate==1.0.1
trimesh==4.5.1
pyvista==0.44.1
audiocraft==1.3.0
slowapi==0.1.9
pydantic==2.9.2
huggingface_hub==0.26.1
pytest==8.3.3
```
Create `backend/.env.example` (per `docs/07_SECURITY_AND_ENV.md` sec 3.2 — committed template; real `backend/.env` stays gitignored).

Install:
```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt   # exit 0
```
CUDA verification (exit 0, prints True + RTX 2070):
```bash
.venv/Scripts/python.exe -c "import torch; print('CUDA Available:', torch.cuda.is_available(), '| Device:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
```

## Task 0.4 — Open-weights model pre-cache script

**Governing skills:** `pytorch/pytorch`, `api-design`

Create `backend/scripts/download_models.py`:
- Uses `huggingface_hub.snapshot_download` with per-model `allow_patterns`.
- Models: `stabilityai/TripoSR`, `stabilityai/sdxl-turbo`, `facebook/audiogen-medium`, `HuggingFaceTB/SmolVLM-Instruct`.
- **AudioGen is gated:** only attempted when `HF_TOKEN` is set; otherwise prints a clear skip message and continues (exit 0).
- `resume_download=True`, per-model try/except with a summary at the end (no crash on a single failure).

Run (downloads ~7-9 GB for the 3 ungated models):
```bash
.venv/Scripts/python.exe backend/scripts/download_models.py   # exit 0
```
Verification:
```bash
ls ~/.cache/huggingface/hub | grep -E "TripoSR|sdxl-turbo|SmolVLM"   # 3 cache dirs present
```

---

## STEP 3 — Execution order, verification gates & commits

Sequential, one atomic conventional commit per verified task. **Only our created files are staged — the user's uncommitted doc edits (`AGENTS.md`, `docs/03`-`docs/08`, `echoforge_3d_master_skills_library.md`) are left untouched.**

| # | Task | Verify (exit 0) | Commit |
| :-- | :-- | :-- | :-- |
| 1 | 0.1 tree + .gitignore + .gitkeep | dirs exist; `git check-ignore` hits | `chore: scaffold Phase 0 workspace tree, ignore rules, and init plan` |
| 2 | 0.2 skills commit | `npx -y skills list` shows 471 | `chore: install 14-repo agent skills and lockfile` |
| 3 | 0.3a pnpm | `pnpm --version` | (global, no repo change) |
| 4 | 0.3b frontend manifests + install | `pnpm install`; `pnpm exec tsc --noEmit` | `chore: add frontend manifests and lockfile` |
| 5 | 0.3c backend venv + requirements | pip install exit 0; CUDA True | `chore: add backend requirements and env template` |
| 6 | 0.4 script | script run exit 0; 3 HF cache dirs | `feat: add open-weights model pre-cache script` |
| 7 | Plan close-out | mark all tasks `[x]` | `docs: close out phase 0 plan` |

On any failure: `systematic-debugging` (log root cause -> research -> minimal fix) before retry; 3 consecutive identical failures = stop and report.

**Known risks / fallbacks**
- pnpm PATH: npm global prefix is `C:\Users\Conno\AppData\Roaming\npm` (user-level, no admin needed). If a fresh shell cannot find `pnpm`, add it: `export PATH="$PATH:$(npm prefix -g)"`.
- `audiocraft==1.3.0` is CONFIRMED on PyPI (audited via pip index versions this session). Fallback if resolution breaks: `pip install "audiocraft@git+https://github.com/facebookresearch/audiocraft.git"`.
- torch 2.5.0 Windows wheel bundles CUDA 12.1 — RTX 2070 compatible.
- Model download size/time (~7-9 GB) — HF `resume_download` handles interruptions.
- `pnpm typecheck` is a no-op gate until Phase 1 adds `src/` sources (Task 1.1+), per DoD note in `docs/08_TASKS.md`.

**Session-end memory ritual (after final commit):** append "Work completed" to `handoff.md`, update `knowledge.md` with new commands, expand any auto-captured lessons (post-commit hook runs automatically).
