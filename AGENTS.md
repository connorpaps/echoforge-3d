# EchoForge 3D: Universal Agent Operating Invariants & System Prompt

**Repository:** `echoforge-3d`  
**Core Purpose:** Multimodal spatial worldcrafting engine & in-browser 3D creative suite.  
**Tech Stack:** Next.js 15 App Router, React 19, Three.js WebGPU TSL, React Three Fiber, Rapier3D Wasm, Web Audio API HRTF, FastAPI, PyTorch CUDA FP16, Transformers.js, Kokoro-82M.

---

## 1. Non-Negotiable Engineering Guardrails

1. **Diagnose First, Patch Second:** When encountering a bug, test failure, or runtime exception, do NOT modify code immediately. First log the root cause, verify the failure mechanism, and only then apply the minimal fix (`superpowers/debug-root-cause`).
2. **Non-Blocking Main Thread:** All machine learning inference in the browser (Distil-Whisper ASR, Depth Anything V2, Kokoro-82M TTS) MUST run inside dedicated Web Workers using `OffscreenCanvas` and zero-copy `Transferable ArrayBuffer` objects (`huggingface/transformers-js`).
3. **VRAM Safety Invariant:** Never load multiple heavy PyTorch models concurrently on CUDA. All generative backend tasks (TripoSR, SDXL-Turbo, AudioGen) MUST route through the `SequentialVRAMManager` with explicit garbage collection and cache clearance (`pytorch/pytorch`).
4. **Zero Unvetted Dependencies:** Never execute `npm install` or `pip install` for packages not explicitly defined in `docs/03_TECH_SPEC.md` without developer authorization.
5. **Asset Optimization Standard:** Decimate all raw 3D mesh outputs to ≤ 25,000 faces and bake convex collision hulls via trimesh before client transmission (`r3f-skills/r3f-physics`).
6. **Visual Design Adherence:** All UI components, colors, and layout tokens MUST strictly adhere to `./DESIGN.md`. Do not introduce generic AI purple gradients or pure black `#000000` backgrounds.

---

## 2. CLI Commands Cheat Sheet

| Task | Command |
| :--- | :--- |
| **Install Skills** | `npx -y skills add <repo> -y` |
| **Verify Skills** | `npx -y skills list` |
| **Frontend Dev Server** | `pnpm dev` (Runs Next.js on `http://localhost:3000`) |
| **Backend AI Microservice** | `uvicorn backend.main:app --reload --port 8000` |
| **Unit & Integration Tests** | `pnpm test` (Frontend) / `pytest backend/tests` (Backend) |
| **End-to-End Verification** | `pnpm test:e2e` (Playwright WebGL/WebGPU test runner) |
| **TypeScript & Lint Check** | `pnpm typecheck && pnpm lint` |

---

## 3. Specification & 14-Repository Skill Routing Index

| Task Type | Primary Spec Document | Active Installed Skills (`.agents/skills/`) |
| :--- | :--- | :--- |
| **Feature Scope & Requirements** | `docs/01_PRD.md` | `skills.sh/grill-me`, `superpowers/brainstorming` |
| **UI, Wireframes & Visual Layout**| `docs/02_DESIGN_BRIEF.md`, `./DESIGN.md` | `VoltAgent/awesome-design-md`, `Leonxlnx/taste-skill`, `pbakaus/impeccable`, `shadcn/ui` |
| **Next.js 15 & Server Boundaries** | `docs/03_TECH_SPEC.md` | `vercel-labs/agent-skills` |
| **3D Viewport, R3F & Physics** | `docs/03_TECH_SPEC.md` | `EnzeD/r3f-skills` (`r3f-fundamentals`, `r3f-physics`, `r3f-loaders`, `r3f-shaders`) |
| **WebGPU Shaders & TSL Nodes** | `docs/03_TECH_SPEC.md` | `dgreenheck/webgpu-claude-skill` (`webgpu-threejs-tsl`) |
| **In-Browser ML Workers** | `docs/03_TECH_SPEC.md` | `huggingface/skills` (`transformers-js`) |
| **Zustand 3D Scene Graph** | `docs/05_DATA_MODELS.md` | `TheBushidoCollective/han` (`zustand-advanced-patterns`, `zustand-typescript`) |
| **IndexedDB Binary Storage** | `docs/05_DATA_MODELS.md` | `NeverSight/learn-skills.dev` (`idb-state-persistence`) |
| **REST, WebSockets & Tool Schema**| `docs/04_API_CONTRACTS.md` | `everything-claude-code/api-design` |
| **PyTorch CUDA & VRAM Safety** | `docs/03_TECH_SPEC.md` | `pytorch/pytorch` |
| **Testing, CUJs & Visual QA** | `docs/06_TESTING_AND_QA.md` | `superpowers/verification-before-completion`, `playwright` |
| **Roadmap & Atomic Execution** | `docs/08_TASKS.md` | `superpowers/writing-plans`, `superpowers/executing-plans` |
