# Project Overview & Autonomous Agent Operating Invariants

**Repository:** EchoForge 3D  
**Core Purpose:** Multimodal spatial worldcrafting engine & in-browser 3D creative suite.  
**Tech Stack:** Next.js 15 (App Router), React 19, Three.js / WebGPU (TSL), React Three Fiber, Rapier3D Wasm, Web Audio API (HRTF), FastAPI, PyTorch (CUDA FP16), Transformers.js, Kokoro-82M.

> Freebuff reads `knowledge.md` first — **keep `knowledge.md` as the single source of truth** for the AI memory system and only mirror essentials here.

---

## Memory protocol — follow every session

This repo uses git-tracked files as its cross-session AI memory. The goal: no re-explaining the project, ever. Canonical details live in `knowledge.md`; the ritual below is mirrored here because Cursor and other AGENTS.md-compatible tools read this file.

### At session start

1. Read `handoff.md` — the last session's work and the prioritized next steps.
2. Read `knowledge.md` — commands, architecture, constraints, gotchas.
3. Read `docs/lessons-learned.md` — auto-captured "needs enrichment" entries there are homework to expand with root cause + avoid-in-future.
4. Check `git status --short`, `git log --oneline -10`, and the tail of `docs/activity-log.md` (auto-log of every commit) for recent context.
5. **After completing a substantial change, append a brief "Work completed" note to `handoff.md` immediately** — do not wait for session end.

### During work — lesson capture is mandatory and immediate

Whenever you fix an error, make a mistake, discover a gotcha, or find a project issue, append a structured entry to `docs/lessons-learned.md` **right away** (Symptom / Root cause / Fix / Avoid in future / Status). Never wait for session end — a forgotten lesson is a future hour-long debug. The `.githooks/post-commit` hook auto-appends placeholder entries for fix/error commits as a safety net.

### At session end (or when a task completes)

1. Append a date-stamped **"Work completed"** section to `handoff.md` — what changed, why, and what validation ran.
2. Update `knowledge.md` with any new commands, architecture facts, constraints, or gotchas learned.
3. Review `docs/lessons-learned.md`: expand auto-captured placeholder entries and remove their "needs enrichment" markers.
4. Keep the memory files lean (< ~200 lines). Prune stale entries instead of accumulating.

### Wrap-up signals

If the user signals the session is ending (e.g. "wrap up", "done for today", "that's all", "update the handoff"), update `handoff.md` and `knowledge.md` **even if not explicitly asked** — do not wait to be told.

### Bootstrap check (auto-setup on new machines)

At session start, verify the memory system is active: run `git config core.hooksPath`. If it does **not** return `.githooks`, run `bash scripts/setup-memory-hooks.sh` before doing anything else. If memory files are missing but `MEMORY_SETUP.md` exists, replicate them from `MEMORY_SETUP.md`.

### Machine sync check (auto-catch machine swaps)

At session start, run `bash scripts/machine-sync.sh`. It detects a machine change (via `docs/.last-machine`), re-enables hooks on this machine, fixes old `master` clones, and pulls the latest memory files from `origin` — but only when the working tree is clean (it never clobbers uncommitted work). This means you can start working immediately even after switching machines; no manual `git pull` needed.

---

## 1. Non-Negotiable Engineering Guardrails

1. **Diagnose First, Patch Second:** When encountering a bug, test failure, or runtime exception, do NOT modify code immediately. First log the root cause, verify the failure mechanism, and only then apply the minimal fix (`debug-root-cause`).
2. **Non-Blocking Main Thread:** All machine learning inference in the browser (Distil-Whisper ASR, Depth Anything V2, Kokoro-82M TTS) MUST run inside dedicated Web Workers using `OffscreenCanvas` and zero-copy `Transferable` `ArrayBuffer` objects (`transformers-js-workers`).
3. **VRAM Safety Invariant:** Never load multiple heavy PyTorch models concurrently on CUDA. All generative backend tasks (TripoSR, SDXL-Turbo, AudioGen) MUST route through the `SequentialVRAMManager` with explicit garbage collection and cache clearance (`pytorch-vram-queue-manager`).
4. **Zero Unvetted Dependencies:** Never execute `npm install` or `pip install` for packages not explicitly defined in `docs/03_TECH_SPEC.md` without developer authorization.
5. **Asset Optimization Standard:** Decimate all raw 3D mesh outputs to <20,000 faces and bake convex collision hulls via `trimesh` before client transmission.
6. **Visual Design Adherence:** All UI components, colors, and layout tokens MUST strictly adhere to `./DESIGN.md`. Do not introduce generic AI purple gradients or pure black `#000000` backgrounds (`taste` / `impeccable`).

---

## 2. Autonomous Initialization & Full Environment Setup Protocol

When receiving the initial prompt to develop EchoForge 3D, the agent MUST autonomously execute this complete preparation pipeline before writing any application features [web:391][web:398]:

```
[ PHASE 0: Autonomous Environment Setup Pipeline ]
  │
  ├── 1. SCAFFOLD DIRECTORY TREE:
  │      mkdir -p src/app src/components/ui src/components/viewport src/components/canvas
  │      mkdir -p src/lib src/workers backend/services backend/scripts backend/tests
  │      mkdir -p docs/plans .audit
  │
  ├── 2. INSTALL ALL REQUIRED AGENT SKILLS VIA NPX:
  │      npx -y skills add obra/superpowers --all -y
  │      npx -y skills add VoltAgent/awesome-design-md -y
  │      npx -y skills add Leonxlnx/taste-skill -y
  │      npx -y skills add pbakaus/impeccable -y
  │      npx -y skills add vercel-labs/agent-skills --all -y
  │      npx -y skills add microsoft/playwright-cli -y
  │      npx -y skills add huggingface/skills --all -y
  │      npx -y skills add EnzeD/r3f-skills -y
  │      npx -y skills add dgreenheck/webgpu-claude-skill -y
  │      npx -y skills add nextlevelbuilder/ui-ux-pro-max-skill -y
  │      npx -y skills add shadcn/ui -y
  │      npx -y skills add affaan-m/everything-claude-code -y
  │
  ├── 3. VERIFY SKILL INSTALLATION & DISCOVERY:
  │      Run `npx -y skills list` to verify all 26 skills are registered.
  │      *Search Rule:* If a skill cannot be found, use `npx -y skills find "<keyword>"`
  │      to search the registry, or query `echoforge_3d_master_skills_library.md` for reference.
  │
  ├── 4. INSTALL CODEBASE DEPENDENCIES:
  │      Frontend: pnpm install
  │      Backend: pip install -r backend/requirements.txt
  │
  └── 5. PRE-CACHE OPEN-WEIGHT AI MODELS:
         python backend/scripts/download_models.py
```

---

## 3. Circuit-Breaker & Error Halt Protocol (When to Stop)

The agent MUST **stop execution immediately and report to the user** under any of the following conditions [web:364][web:368]:

1. **Skill Installation or Resolution Failure:** If `npx skills add` fails due to network/404 errors, attempt discovery via `npx skills find`. If still unresolvable, STOP and request user authorization [web:368].
2. **3-Strike Error Threshold:** If the same test, build, or shader compilation fails 3 consecutive times, STOP. Do not guess or hallucinate speculative fixes. Present the exact stdout/stderr logs and explain the 3 hypotheses tested [web:364][web:368].
3. **Hardware / VRAM Boundary Breach:** If backend CUDA memory allocation exceeds 6.0 GB during PyTorch execution, STOP the worker and audit the VRAM manager [web:365].
4. **TypeScript / Lint Failures:** Never proceed to the next milestone in `docs/08_TASKS.md` if `pnpm typecheck` returns errors.

---

## 4. Mandatory Project Directory Architecture

```
[ Project Root ]
├── AGENTS.md                                ◄── This file (Root Orchestrator)
├── DESIGN.md                                ◄── Visual Design Token Rulebook
├── echoforge_3d_master_skills_library.md    ◄── Reference Index of all 26 Skills
├── package.json                             ◄── Scaffolding root
├── tsconfig.json                            ◄── TypeScript config (strict: true)
├── next.config.js                           ◄── Next.js 15 WebAssembly config
│
├── docs/                                    ◄── Static Spec Suite
│   ├── 01_PRD.md
│   ├── 02_DESIGN_BRIEF.md
│   ├── 03_TECH_SPEC.md
│   ├── 04_API_CONTRACTS.md
│   ├── 05_DATA_MODELS.md
│   ├── 06_TESTING_AND_QA.md
│   ├── 07_SECURITY_AND_ENV.md
│   └── 08_TASKS.md
│
├── .agents/skills/                          ◄── 26 Procedural Skills Installed via NPX CLI
│   ├── 01. grill-me/SKILL.md
│   ├── ... (skills 02 to 25)
│   └── 26. web-audio-spatial-hrtf/SKILL.md
│
├── src/                                     ◄── Frontend Source Code
│   ├── app/                                 ◄── Next.js 15 App Router pages & layouts
│   ├── components/                          ◄── React Three Fiber viewport & UI drawers
│   │   ├── ui/                              ◄── Shadcn / Radix accessible primitives
│   │   ├── viewport/                        ◄── Three.js WebGPU canvas & shaders
│   │   └── canvas/                          ◄── 2D Topographic elevation canvas
│   ├── lib/                                 ◄── Zustand stores, Web Audio API, IndexedDB
│   └── workers/                             ◄── Dedicated Web Workers (depth, tts, speech)
│
└── backend/                                 ◄── Python AI Microservice
    ├── main.py                              ◄── FastAPI Gateway & WebSocket channels
    ├── services/                            ◄── SequentialVRAMManager & Trimesh decimation
    ├── scripts/                             ◄── download_models.py pre-caching script
    └── tests/                               ◄── Pytest CUDA memory & endpoint suites
```

---

## 5. CLI Commands Cheat Sheet

| Task | Command |
| :--- | :--- |
| **Search Remote Skills Registry** | `npx -y skills find "<query>"` |
| **Install Skills via CLI** | `npx -y skills add <repo_url> -y` |
| **List Installed Skills** | `npx -y skills list` |
| **Frontend Dev Server** | `pnpm dev` (Runs Next.js on `http://localhost:3000`) |
| **Backend AI Microservice** | `uvicorn backend.main:app --reload --port 8000` |
| **Download Local AI Model Weights** | `python backend/scripts/download_models.py` |
| **Unit & Integration Tests** | `pnpm test` (Frontend) / `pytest backend/tests` (Backend) |
| **End-to-End Verification** | `pnpm test:e2e` (Playwright WebGL/WebGPU test runner) |
| **Visual QA Snapshot Audit** | `playwright-cli screenshot --filename=.audit/current.png` |
| **TypeScript & Lint Check** | `pnpm typecheck && pnpm lint` |

---

## 6. Autonomous Skill Trigger Matrix & Official CLI Sources

| Category | Skill Name | Official NPX Install Command | Automated Trigger Condition |
| :--- | :--- | :--- | :--- |
| **Planning** | `grill-me` | `npx -y skills add skills.sh/grill-me -y` | Trigger before planning any task to interrogate edge cases. |
| **Planning** | `brainstorming` | `npx -y skills add obra/superpowers -s brainstorming -y` | Trigger whenever exploring multiple technical design options. |
| **Planning** | `writing-plans` | `npx -y skills add obra/superpowers -s writing-plans -y` | Trigger to produce atomic 2-5 min implementation tasks. |
| **Planning** | `executing-plans` | `npx -y skills add obra/superpowers -s executing-plans -y` | Trigger when executing tasks with verification checkpoints. |
| **Planning** | `verification-before-completion` | `npx -y skills add obra/superpowers -s verification-before-completion -y` | Trigger before claiming task completion (runs test commands). |
| **Planning** | `receiving-code-review` | `npx -y skills add obra/superpowers -s receiving-code-review -y` | Trigger when receiving feedback before altering code. |
| **Visuals** | `awesome-design-md` | `npx -y skills add VoltAgent/awesome-design-md -y` | Trigger when referencing Linear/Supabase design tokens. |
| **Visuals** | `design-md-authoring` | `npx -y skills add google-labs-code/design-md -y` | Trigger when creating or updating visual design tokens. |
| **Visuals** | `taste` | `npx -y skills add Leonxlnx/taste-skill -y` | Trigger on frontend tasks to eliminate generic AI purple slop. |
| **Visuals** | `impeccable` | `npx -y skills add pbakaus/impeccable -y` | Trigger when auditing visual hierarchy & contrast ratios. |
| **Visuals** | `creative-studio-ui-styling` | `npx -y skills add nextlevelbuilder/ui-ux-pro-max-skill -y` | Trigger when styling dark zinc/slate glassmorphic panels. |
| **Visuals** | `shadcn-tailwind-components` | `npx -y skills add shadcn/ui -y` | Trigger when adding accessible Radix UI dialogs/buttons. |
| **Visuals** | `responsive-canvas-layout` | `npx -y skills add freshtechbro/claudedesignskills -s responsive-canvas-layout -y` | Trigger when building split-pane resizable studio docks. |
| **Testing** | `playwright-cli-visual-qa` | `npx -y skills add microsoft/playwright-cli -y` | Trigger to take screenshots and audit UI against DESIGN.md. |
| **Testing** | `playwright-webgl-testing` | `npx -y skills add microsoft/playwright-cli -s playwright-webgl-testing -y` | Trigger when writing CI/CD tests for 3D canvas buffers. |
| **Architecture**| `vercel-react-best-practices` | `npx -y skills add vercel-labs/agent-skills -s vercel-react-best-practices -y` | Trigger when creating Next.js routes & dynamic 3D imports. |
| **Architecture**| `api-design` | `npx -y skills add affaan-m/everything-claude-code -s api-design -y` | Trigger when building REST routes & WebSocket event streams. |
| **Architecture**| `zustand-3d-scene-store` | `npx -y skills add freshtechbro/claudedesignskills -s zustand-3d-scene-store -y` | Trigger when managing the 3D entity tree & undo/redo stack. |
| **Architecture**| `indexeddb-asset-cache` | `npx -y skills add freshtechbro/claudedesignskills -s indexeddb-asset-cache -y` | Trigger when caching `.glb` models & `.wav` audio offline. |
| **Graphics** | `r3f-scene-architecture` | `npx -y skills add EnzeD/r3f-skills -y` | Trigger when setting up R3F canvas loaders and render loops. |
| **Graphics** | `webgpu-threejs-tsl` | `npx -y skills add dgreenheck/webgpu-claude-skill -y` | Trigger when coding TSL shaders and GPU device loss handlers. |
| **Graphics** | `webgpu-postprocessing-tsl` | `npx -y skills add dgreenheck/webgpu-claude-skill -s webgpu-postprocessing-tsl -y` | Trigger when configuring UnrealBloom, SSAO, and FXAA passes. |
| **Graphics** | `2d-topographic-brush-canvas` | `npx -y skills add freshtechbro/claudedesignskills -s 2d-topographic-brush-canvas -y` | Trigger when coding the 2D elevation drawing brush tool. |
| **Graphics** | `transformers-js-workers` | `npx -y skills add huggingface/skills -s transformers-js -y` | Trigger when running Whisper, Depth Anything, or Kokoro in workers. |
| **Graphics** | `rapier3d-physics-controller` | `npx -y skills add EnzeD/r3f-skills -s rapier3d-physics-controller -y` | Trigger when configuring terrain colliders & WASD kinematics. |
| **Graphics** | `web-audio-spatial-hrtf` | `npx -y skills add freshtechbro/claudedesignskills -s web-audio-spatial-hrtf -y` | Trigger when creating 3D HRTF audio panner nodes. |

---

## 7. Reference files (AI memory system)

- `knowledge.md` — canonical project knowledge; Freebuff's single source of truth for the memory system
- `handoff.md` — session log / prioritized next steps
- `docs/activity-log.md` — auto-generated commit log (written by `.githooks/post-commit`, no input needed)
- `docs/activity-watch.log` — raw per-save events (gitignored; only exists if `node scripts/memory-watcher.mjs` is running)
- `.githooks/post-commit` + `scripts/setup-memory-hooks.sh` — automatic memory plumbing
- `MEMORY_SETUP.md` — replication kit (reference only, not part of the running memory system)
- `docs/01_PRD.md` – `docs/08_TASKS.md` — static spec suite; the task roadmap is `docs/08_TASKS.md`
- `DESIGN.md` — visual design token rulebook
