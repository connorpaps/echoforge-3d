# EchoForge 3D: Definitive 26-Skill Master Library (`.agents/skills/`)

A curated collection of **26 specialized procedural skills (`SKILL.md`)** for autonomous AI coding agents (GLM-5.2, DeepSeek-V4 Pro, Claude Code, Cursor, Freebuff).

This library incorporates the **Agent Skills Standard** [web:128][web:141], the **Superpowers methodology** (`obra/superpowers`) [web:170][web:185], the official **`awesome-design-md` library integration** (`VoltAgent/awesome-design-md`) [web:243][web:269], the official **Microsoft `playwright-cli` Visual QA Engine** [web:316][web:320], the **Grill-Me interrogation engine** [web:265], **Vercel React/Next.js best practices** [web:262][web:268], and **production WebGPU / 3D engineering repositories** [web:154][web:168].

---

## Complete 26-Skill Directory Structure

Place these folders inside `.agents/skills/` at your repository root:

```
.agents/skills/
│
├── [ CATEGORY A: Process, Planning & Interrogation (6 Skills) ]
│   ├── 01. grill-me/SKILL.md                        ◄── Relentless pre-code decision-tree interrogation (#1 skill on skills.sh)
│   ├── 02. brainstorming/SKILL.md                   ◄── Pre-implementation user intent & design discovery
│   ├── 03. writing-plans/SKILL.md                   ◄── Decomposes specs into atomic, test-driven tasks
│   ├── 04. executing-plans/SKILL.md                 ◄── Sequential execution with verification checkpoints
│   ├── 05. verification-before-completion/SKILL.md ◄── Evidence-before-assertions completion gate
│   └── 06. receiving-code-review/SKILL.md           ◄── Rigorous review evaluation without blind agreement
│
├── [ CATEGORY B: Aesthetic Systems, UI Polish & DESIGN.md (7 Skills) ]
│   ├── 07. awesome-design-md/SKILL.md               ◄── VoltAgent 74-brand DESIGN.md registry & Linear tokens
│   ├── 08. design-md-authoring/SKILL.md             ◄── Google Stitch / VoltAgent DESIGN.md design system authoring protocol
│   ├── 09. taste/SKILL.md                           ◄── Anti-slop design engine, variance, motion, typography
│   ├── 10. impeccable/SKILL.md                      ◄── Comprehensive UX review, visual polish, audit laws
│   ├── 11. creative-studio-ui-styling/SKILL.md      ◄── Dark slate theme, glassmorphism, HUD overlays, Framer Motion
│   ├── 12. shadcn-tailwind-components/SKILL.md      ◄── Radix UI primitives, copy-paste components, accessible dialogs
│   └── 13. responsive-canvas-layout/SKILL.md        ◄── Split-pane resizers, collapsible sidebars, floating palettes
│
├── [ CATEGORY C: Visual Inspection, QA & Testing (2 Skills) ]
│   ├── 14. playwright-cli-visual-qa/SKILL.md        ◄── Headless browser visual audit, screenshot comparison & a11y trees
│   └── 15. playwright-webgl-testing/SKILL.md        ◄── WebGL/WebGPU software-rendered automated regression test suite
│
├── [ CATEGORY D: System Architecture, State & Web Standards (4 Skills) ]
│   ├── 16. vercel-react-best-practices/SKILL.md     ◄── Next.js 15 App Router server/client boundary & rendering safety
│   ├── 17. api-design/SKILL.md                      ◄── REST & WebSocket design, tool schemas, error handling
│   ├── 18. zustand-3d-scene-store/SKILL.md          ◄── Entity-Component 3D scene state & undo/redo stacks
│   └── 19. indexeddb-asset-cache/SKILL.md           ◄── Client-side offline caching for GLB & WAV blobs
│
└── [ CATEGORY E: Graphics, WebGPU, ML & Domain Engineering (7 Skills) ]
    ├── 20. r3f-scene-architecture/SKILL.md          ◄── React Three Fiber 8.x + Next.js 15 client boundaries
    ├── 21. webgpu-threejs-tsl/SKILL.md              ◄── Three.js TSL displacement shaders & device loss
    ├── 22. webgpu-postprocessing-tsl/SKILL.md       ◄── TSL UnrealBloom, SSAO, FXAA, and color grading
    ├── 23. 2d-topographic-brush-canvas/SKILL.md     ◄── HTML5 Canvas pressure brushes, radial blur & height export
    ├── 24. transformers-js-workers/SKILL.md         ◄── In-browser WebGPU ML workers & OffscreenCanvas
    ├── 25. rapier3d-physics-controller/SKILL.md     ◄── Wasm rigid-body physics, terrain & WASM character
    ├── 26. web-audio-spatial-hrtf/SKILL.md          ◄── 3D PannerNode HRTF audio bus & listener sync
```

---

## Category A: Process, Planning & Interrogation Skills

### 1. `grill-me/SKILL.md`
*Source: `skills.sh/grill-me` (Top Planning Skill)* [web:265]

```markdown
---
name: grill-me
description: Relentless decision-tree interrogation before coding starts. Forces the user and agent to lock down edge cases, data structures, failure modes, and boundaries before generating code.
---
# Pre-Code Interrogation & Requirement Hardening Protocol

## Mandatory Interrogation Loop:
1. **Never Start Coding Immediately:** When given a new feature or architectural requirement, DO NOT generate boilerplate or scaffolding code.
2. **Ask 4-6 Hard Technical Questions:** Interrogate the request along these specific axes:
   - *State & Persistence:* What happens on page refresh? Is state in URL, Zustand, IndexedDB, or Supabase?
   - *Failure Modes:* What if WebGPU device loss occurs? What if mic audio is silent? What if the VRAM queue is full?
   - *Edge Boundaries:* What is the maximum vertex count? How many concurrent audio emitters are permitted?
   - *Performance:* What is the target frame budget? (e.g., <16.6ms per frame).
3. **Lock Decisions:** Incorporate the user's answers into the feature spec before invoking `writing-plans`.
```

---

### 2. `brainstorming/SKILL.md`
*Source: `obra/superpowers/brainstorming`* [web:185][web:191]

```markdown
---
name: brainstorming
description: You MUST use this before any creative work—creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements, and design before implementation.
---
# Brainstorming & Design Discovery Protocol

## Mandatory Workflow:
1. **Explore Project Context:** Inspect current files, architecture docs, and recent commits.
2. **Clarify Purpose & Constraints:** Ask clarifying questions one at a time. Understand exact inputs, outputs, and edge cases.
3. **Propose 2-3 Approaches:** Present distinct technical trade-offs with your recommended approach.
4. **Present Design in Sections:** Outline data flows, component layouts, and file changes. Get user confirmation before proceeding.
5. **Spec Self-Review:** Check for ambiguities, placeholder code, and scope creep.
6. **Handoff:** Invoke `writing-plans` to generate the implementation plan.
```

---

### 3. `writing-plans/SKILL.md`
*Source: `obra/superpowers/writing-plans`* [web:170][web:192]

```markdown
---
name: writing-plans
description: Use when design or requirements are complete and you need detailed, bite-sized implementation tasks before touching code.
---
# Implementation Plan Authoring Protocol

## Core Rules:
1. **Zero-Context Assumption:** Write comprehensive plans assuming the executing engineer or sub-agent has zero prior context of this repository.
2. **Atomic Tasks (2-5 Minutes):** Break every feature into bite-sized, independently testable steps.
3. **Exact File Paths & Commands:** Every task MUST specify:
   - Exact file path to create or modify.
   - Complete copy-ready code blocks (no `// TODO: implement later` placeholders).
   - The exact test command to verify the task (`pnpm test:unit`, `pytest tests/test_vram.py`).
4. **Plan Output Location:** Save the plan as Markdown with checkboxes to `docs/plans/YYYY-MM-DD-<feature-name>.md`.
```

---

### 4. `executing-plans/SKILL.md`
*Source: `obra/superpowers/executing-plans`* [web:170][web:172]

```markdown
---
name: executing-plans
description: Use when you have a written implementation plan to execute systematically with review checkpoints.
---
# Implementation Plan Execution Protocol

## Execution Loop:
1. **Load Plan:** Read the target implementation plan file in `docs/plans/`.
2. **Execute In Order:** Execute tasks strictly sequentially.
3. **Per-Task Verification Gate:**
   - Implement the file changes.
   - Run the specified verification command.
   - Inspect terminal output and confirm the test passes.
4. **Mark Complete:** Check off the task `[x]` in the plan file.
5. **Report & Pause:** Stop at designated review checkpoints to report progress and verify system health.
```

---

### 5. `verification-before-completion/SKILL.md`
*Source: `obra/superpowers/verification-before-completion`* [web:184][web:194]

```markdown
---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs. Requires running verification commands and confirming output before making assertions.
---
# Verification Before Completion Protocol

## Mandatory Verification Sequence:
1. **IDENTIFY:** What exact CLI command proves this feature works or this bug is fixed?
2. **RUN:** Execute the complete command freshly (`pnpm test`, `pnpm build`, `pytest`).
3. **READ:** Read the full terminal stdout/stderr, verify exit code is 0, and confirm zero failures.
4. **VERIFY:** Does the real output confirm the claim?
   - If NO: Report the actual failure with error logs.
   - If YES: State the completion claim WITH the terminal output as proof.
5. **NO SHORTCUTS:** Never state "the build succeeds" or "tests pass" without running the command.
```

---

### 6. `receiving-code-review/SKILL.md`
*Source: `obra/superpowers/receiving-code-review`* [web:184][web:195]

```markdown
---
name: receiving-code-review
description: Use when receiving code review feedback before implementing suggestions. Enforces technical rigor and verification rather than performative agreement or blind changes.
---
# Receiving Code Review Protocol

## Evaluation Steps:
1. **Read & Understand:** Review feedback thoroughly without immediate reflexive changes.
2. **Verify Codebase Reality:** Check if feedback aligns with actual project constraints (8GB VRAM limits, WebGPU worker boundaries).
3. **Evaluate Trade-offs:** Is the suggestion technically sound for this specific stack?
4. **Respond Technically:** Acknowledge valid points or provide reasoned technical explanations if a suggestion conflicts with established architecture.
5. **Implement Atomically:** Apply approved changes one at a time and verify tests pass after each change.
```

---

## Category B: Aesthetic Systems, UI Polish & DESIGN.md

### 7. `awesome-design-md/SKILL.md`
*Source: `VoltAgent/awesome-design-md` Official Registry* [web:243][web:269]

```markdown
---
name: awesome-design-md
description: Curated reference library of 74+ real-world brand design systems as DESIGN.md specs (Linear, Supabase, Stripe, Vercel, Apple). Use to pull exact brand color tokens, typography, glassmorphism, and component geometries.
---
# Awesome Design MD Brand System Protocol

## Standard Brand Presets for 3D Workstations:
1. **Linear Preset (Default Studio UI):**
   - Canvas Base: `#08090a` / Card Background: `rgba(20, 22, 26, 0.7)`
   - Border: `1px solid rgba(255, 255, 255, 0.08)`
   - Accent: Linear Purple `#5e6ad2` / Emerald `#10b981`
2. **Supabase Preset (Data & Telemetry UI):**
   - Canvas Base: `#121212` / Surface: `#1c1c1c`
   - Accent: Brand Green `#3ecf8e` (RGB: `62, 207, 142`)
3. **Usage Rule:**
   - Reference `./DESIGN.md` in your project root as the single source of truth for all Tailwind class names, surface colors, and typography rules.
```

---

### 8. `design-md-authoring/SKILL.md`
*Source: Google Stitch / VoltAgent Protocol* [web:243][web:260]

```markdown
---
name: design-md-authoring
description: Extracts, authors, and validates DESIGN.md design system files following the Google Stitch protocol. Use when generating or updating the project's visual design specification.
---
# DESIGN.md Protocol & Visual Language Standards

## Standard 9-Section Layout for DESIGN.md:
1. **Visual Atmosphere & Creative Stance:** High-level aesthetic theme (e.g., *Obsidian Dark Studio with Neon Emerald Glow*).
2. **Color Tokens & Exact Hex Register:**
   - Backgrounds: `#09090b` (canvas base), `#0f172a` (card surfaces).
   - Accents: `#10b981` (primary active), `#06b6d4` (secondary telemetry).
   - Borders: `rgba(255, 255, 255, 0.08)` (1px glass outlines).
3. **Typography & Font Pairings:** `Geist Sans` / `Inter` for UI controls, `Geist Mono` / `JetBrains Mono` for coordinates.
4. **Component Geometry & Radii:** Strict `rounded-lg` (8px) for cards, `rounded-md` (6px) for buttons, `rounded-full` for status badges.
5. **Spacing Scale & Layout Density:** `gap-2` for toolbars, `p-4` for inspector drawers.
6. **Elevation & Glassmorphic Depth:** `backdrop-blur-md` + `shadow-[0_0_20px_rgba(0,0,0,0.5)]`.
7. **Explicit Anti-Patterns:** Ban pure `#000000` pitch black, ban default purple gradients, ban unstyled alerts.
8. **Responsive Breakpoints:** 12-column grid collapsing into floating HUD drawers on viewports <1280px.
9. **Copy-Ready AI Prompts:** Ready-to-execute prompt snippets for new components matching the exact aesthetic.
```

---

### 9. `taste/SKILL.md`
*Source: `Leonxlnx/taste-skill` (The Anti-AI Slop Engine)* [web:216][web:221]

```markdown
---
name: taste
description: Eliminates generic, boring AI templates and overrides default LLM aesthetic instincts. Injects premium layout variance, typography hierarchy, kinetic motion, and curated color registers.
---
# Aesthetic Taste & Anti-Slop Directive

## The 3 Aesthetic Dials:
- **Design Variance (8/10):** Break symmetric statistical defaults. Avoid standard 3-column feature cards with purple gradients. Use asymmetric hero compositions, editorial typography, and overlapping canvas HUD chips.
- **Motion Intensity (6/10):** Kinetic but disciplined. Micro-interactions on hover (`scale: 1.02`, spring transitions), smooth canvas modal entrance (`Framer Motion`), and subtle glowing borders.
- **Visual Density (4/10):** Breathable, high-contrast studio spacing. Generous padding around 3D viewports with crisp 1px borders.

## Banned AI Defaults:
- ❌ NO generic purple/violet radial gradients (`bg-gradient-to-r from-purple-500 to-indigo-600`).
- ❌ NO unstyled plain Inter headers with centered boilerplate copy.
- ❌ NO identical rounded rectangle cards with centered Lucide icons.
- ✅ YES: Dark slate/obsidian backgrounds with targeted neon emerald/cyan glowing accents.
- ✅ YES: Monospace telemetry headers paired with crisp sans-serif interface labels.
```

---

### 10. `impeccable/SKILL.md`
*Source: `pbakaus/impeccable` (The Frontend Design Language)* [web:211][web:213]

```markdown
---
name: impeccable
description: Comprehensive UX audit, visual hierarchy refinement, polish, cognitive load reduction, and micro-interaction hardening. Use to audit and perfect UI components and screen layouts.
---
# Impeccable Design Laws & Audit Protocol

## Core Design Laws:
1. **Visual Hierarchy Law:** Every screen must have ONE clear visual focal point (for EchoForge 3D: the 3D WebGPU Viewport). Secondary controls (terrain canvas, voice pill, inspector) must never compete with the primary canvas.
2. **Contrast & Legibility:** Minimum 4.5:1 contrast ratio for all secondary text against glassmorphic backgrounds. Never place low-contrast text on semi-transparent overlays without a solid backdrop-blur filter.
3. **State Completeness:** Every interactive component MUST explicitly handle:
   - `initial` / `hover` / `active` / `focused` / `disabled`
   - `empty` / `loading` (with skeleton pulse) / `error` (actionable recovery) / `success`
4. **Micro-Interactions:** Subtle feedback on every user touchpoint (button depress `active:scale-95`, tooltip hover with 100ms delay, glowing pill pulse during voice recording).
```

---

### 11. `creative-studio-ui-styling/SKILL.md`
*Source: `ui-ux-pro-max-skill`* [web:197][web:209]

```markdown
---
name: creative-studio-ui-styling
description: Visual design tokens, dark studio glassmorphism, micro-interactions, and 3D HUD styling. Use when styling Next.js UI panels, buttons, floating palettes, and inspector drawers.
---
# Creative Studio UI & Aesthetic Styling Protocol

## Visual Design Invariants:
1. **Color Palette:**
   - Background Base: Dark Zinc `#09090b` / Slate `#0f172a`.
   - Card/Panel Surface: Semi-transparent glass `rgba(15, 23, 42, 0.75)` with `backdrop-blur-md` and 1px border `rgba(255, 255, 255, 0.08)`.
   - Primary Accent: Emerald Glow `#10b981` (RGB: `16, 185, 129`) with subtle drop shadows (`shadow-[0_0_15px_rgba(16,185,129,0.25)]`).
   - Text Hierarchy: Primary `#f8fafc`, Secondary `#94a3b8`, Muted `#64748b`.
2. **Typography Scale:**
   - Interface Labels: `Inter` or `Geist Sans` (`text-xs font-medium tracking-wide uppercase` for section headers).
   - Coordinates & Telemetry: `JetBrains Mono` or `Geist Mono` (`text-xs tabular-nums text-emerald-400`).
3. **Floating HUD & Canvas Overlays:**
   - Floating panels must use `pointer-events-auto` while parent overlay container uses `pointer-events-none` so Three.js orbit/first-person controls remain interactive.
   - Smooth entrance animations via Framer Motion (`initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}`).
```

---

### 12. `shadcn-tailwind-components/SKILL.md`
*Source: `shadcn/ui` official agent skill* [web:196][web:200]

```markdown
---
name: shadcn-tailwind-components
description: Official shadcn/ui component integration patterns, Radix UI accessibility, and Tailwind CSS utility styling. Use when adding dialogs, dropdowns, sliders, tooltips, and tabs.
---
# Shadcn / Tailwind UI Component Protocol

## Component Construction Rules:
1. **Source-Owned Architecture:** Components live directly in `@/components/ui/` rather than imported as opaque node modules.
2. **Radix Primitive Accessibility:** Always wrap custom interactive elements in Radix primitives for keyboard accessibility (ARIA attributes, focus rings).
3. **Class Merging:** Always merge dynamic class names using the `cn()` utility (`clsx` + `tailwind-merge`):
   ```typescript
   import { cn } from "@/lib/utils";
   export function StudioButton({ className, ...props }: ButtonProps) {
     return <button className={cn("px-3 py-1.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 transition-all", className)} {...props} />;
   }
   ```
```

---

### 13. `responsive-canvas-layout/SKILL.md`

```markdown
---
name: responsive-canvas-layout
description: Split-pane resizing, collapsible sidebars, and full-viewport 3D canvas layouts using react-resizable-panels. Use when structuring the main IDE workstation layout.
---
# Studio Workstation Layout Protocol

## Split View Structure:
1. Use `react-resizable-panels` for smooth, draggable split boundaries between the 2D Topographic Canvas and the 3D Three.js Viewport.
2. **Collapsible Drawers:** Left sidebar (2D Sketch / Prompt Box) must collapse smoothly with hotkey `Cmd+B` / `Ctrl+B`.
3. **Resize Observer Handling:** Whenever panel sizes change, trigger Three.js camera aspect updates:
   ```typescript
   useEffect(() => {
     camera.aspect = width / height;
     camera.updateProjectionMatrix();
     renderer.setSize(width, height);
   }, [width, height]);
   ```
```

---

## Category C: Visual Inspection, QA & Testing Skills

### 14. `playwright-cli-visual-qa/SKILL.md`
*Source: `microsoft/playwright-cli` Official Agent Skill* [web:316][web:320]

```markdown
---
name: playwright-cli-visual-qa
description: Autonomous browser-driven visual auditing and UI testing using playwright-cli. Use when capturing screenshots, inspecting 3D viewport canvas pixels, diagnosing layout bugs, or taking accessibility snapshots.
---
# Playwright CLI Visual Inspection & Audit Protocol

## Essential Commands:
1. **Launch & Navigate:**
   ```bash
   playwright-cli open http://localhost:3000
   ```
2. **Accessibility Snapshot (Fast DOM Inspection):**
   ```bash
   playwright-cli snapshot -i
   ```
3. **Capture Viewport Screenshot:**
   ```bash
   playwright-cli screenshot --filename=.audit/viewport-current.png
   ```
4. **Targeted Element Screenshot:**
   ```bash
   playwright-cli screenshot "[data-testid='viewport-3d']" --filename=.audit/canvas-3d.png
   ```

## Autonomous Audit Workflow:
1. **Trigger Screen Capture:** Whenever a new UI layout, modal, or 3D shader pass is built, execute `playwright-cli screenshot`.
2. **Inspect & Compare:** Inspect the saved `.png` image against `./DESIGN.md` rules (check contrast ratios, verify 1px glassmorphic borders, check for overlapping HUD chips).
3. **Console Error Check:** Run `playwright-cli console` to catch silent Three.js WebGL shader compilation warnings or WebGPU pipeline rejections.
4. **Close Session:** `playwright-cli close`
```

---

### 15. `playwright-webgl-testing/SKILL.md`
*Source: Modern WebGL/WebGPU Headless E2E Patterns* [web:318][web:322]

```markdown
---
name: playwright-webgl-testing
description: End-to-End browser testing for WebGL/WebGPU canvases and 3D UI states using Playwright. Use when creating CI verification gates.
---
# Playwright 3D Canvas Testing Protocol

## Launch Configuration:
Always enable software rendering flags for CI headless WebGL execution:
```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    launchOptions: {
      args: [
        '--enable-unsafe-webgpu',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--ignore-gpu-blocklist'
      ]
    }
  }
});
```

## Canvas Assertion Pattern:
Assert that `<canvas data-testid="viewport-3d">` renders non-zero pixel data and handles mouse-pointer locking on `Tab` press.
```

---

## Category D: System Architecture, State & Web Standards

### 16. `vercel-react-best-practices/SKILL.md`
*Source: `vercel-labs/agent-skills` (Vercel Official)* [web:262][web:268]

```markdown
---
name: vercel-react-best-practices
description: Official Vercel standards for Next.js 15 App Router, React 19 Server/Client boundaries, streaming SSR, bundle size optimization, and dynamic imports.
---
# Next.js 15 & React Performance Protocol

## Mandatory Next.js Rules:
1. **Server vs Client Boundary:** Keep top-level route layouts as Server Components. Add `'use client'` only at the lowest possible component boundary where DOM listeners or Three.js hooks are required.
2. **Dynamic 3D Imports:** All components importing Three.js or `@react-three/fiber` MUST be dynamically imported with SSR disabled:
   ```typescript
   const Viewport3D = dynamic(() => import('@/components/viewport/Viewport3D'), {
     ssr: false,
     loading: () => <ViewportSkeleton />
   });
   ```
3. **Bundle Optimization:** Never import massive packages directly at top level; use tree-shakeable imports from `lucide-react` and `date-fns`.
```

---

### 17. `api-design/SKILL.md`
*Source: `everything-claude-code/api-design`* [web:188]

```markdown
---
name: api-design
description: Conventions and best practices for REST endpoints, WebSocket streaming channels, JSON tool schemas, error responses, and rate limiting.
---
# API Design Patterns Protocol

## Standards:
1. **REST URL Structure:** Resource nouns, lowercase, plural (`/api/v1/scenes`, `/api/v1/models/generate`).
2. **Standard HTTP Codes:** `200 OK` (success), `202 Accepted` (async generation queued), `422 Unprocessable Entity` (schema validation error), `503 Service Unavailable` (VRAM queue full).
3. **Structured JSON Errors:**
   ```json
   {
     "error": {
       "code": "VRAM_LIMIT_EXCEEDED",
       "message": "Sequential GPU queue is currently saturated. Try again in 4 seconds.",
       "details": {}
     }
   }
   ```
4. **WebSocket Binary Frames:** Prefix binary arrays with a 1-byte header (`0x01` for GLB mesh chunks, `0x02` for WAV audio streams).
```

---

### 18. `zustand-3d-scene-store/SKILL.md`

```markdown
---
name: zustand-3d-scene-store
description: Scalable Zustand state management for Three.js scene graphs, entity-component trees, active tool modes, and undo/redo history stacks.
---
# 3D Scene Graph Store Protocol

## Structure & Invariants:
1. **Decouple Render State from React:** Store transient transformation matrices in flat dictionary maps (`entities: Record<string, SceneEntity>`) by UUID.
2. **Undo/Redo History Stacks:**
   - Maintain past/future arrays of JSON delta patches.
   - Limit history depth to 50 actions to prevent client memory bloat.
3. **Immutable Updates:** Always return fresh top-level references when updating entity positions to ensure React UI panels react properly.
```

---

### 19. `indexeddb-asset-cache/SKILL.md`

```markdown
---
name: indexeddb-asset-cache
description: Client-side binary asset caching with IndexedDB (idb-keyval). Use when persisting downloaded GLB models, generated audio buffers, and heightmaps offline.
---
# Client-Side Binary Caching Protocol

## Storage Guidelines:
1. Store large 3D meshes as `Blob` or `ArrayBuffer` directly in IndexedDB with a 500MB LRU limit.
2. Cache key convention: `asset:glb:${model_hash}` and `audio:wav:${audio_hash}`.
3. Check local cache before dispatching network requests to backend or Hugging Face serverless endpoints.
```

---

## Category E: Graphics, WebGPU, ML & Domain Engineering

### 20. `r3f-scene-architecture/SKILL.md`
*Source: `EnzeD/r3f-skills`* [web:154]

```markdown
---
name: r3f-scene-architecture
description: Expert best practices for React Three Fiber (R3F) and @react-three/drei in Next.js 15. Use when scaffolding the 3D canvas, cameras, lighting, and model loaders.
---
# React Three Fiber Architecture Protocol

## Core Rules:
1. **Dynamic Client Import:** Always render R3F `<Canvas>` components via dynamic client-side imports in Next.js (`dynamic(() => import(...), { ssr: false })`) to avoid SSR `window` errors.
2. **Never Mutate State in `useFrame` Directly:**
   - Do NOT call React `setState` inside `useFrame`.
   - Mutate Three.js object references (`meshRef.current.position.x += delta`) directly to maintain 60 FPS without triggering React re-renders.
3. **Asset Preloading:**
   - Preload GLTF assets using `useGLTF.preload('/path.glb')`.
   - Wrap all 3D mesh instances in `<Suspense fallback={<WireframeLoader />}>`.
4. **Memory Cleanup:**
   - Explicitly dispose of geometries and materials on unmount.
```

---

### 21. `webgpu-threejs-tsl/SKILL.md`
*Source: `dgreenheck/webgpu-claude-skill`* [web:168]

```markdown
---
name: webgpu-threejs-tsl
description: WebGPU rendering and Three.js Shading Language (TSL) node materials. Use when building custom terrain displacement shaders and handling WebGPU device loss.
---
# WebGPU & TSL Shader Protocol

## Import Convention:
```typescript
import * as THREE from 'three/webgpu';
import { positionLocal, time, vec3, uv, texture } from 'three/tsl';
```

## Terrain Displacement Shader:
Use node-based materials (`MeshStandardNodeMaterial`) for hardware-accelerated vertex displacement:
```typescript
const material = new THREE.MeshStandardNodeMaterial();
const heightMap = texture(heightMapTexture);
material.positionNode = positionLocal.add(vec3(0, heightMap.r.mul(10.0), 0));
```

## Device Loss Recovery:
Attach `device.lost` promise handler immediately on adapter initialization to handle tab sleep or GPU driver crashes gracefully. [web:151]
```

---

### 22. `webgpu-postprocessing-tsl/SKILL.md`
*Source: Modern Three.js WebGPU Post-Processing Standard* [web:226][web:239]

```markdown
---
name: webgpu-postprocessing-tsl
description: Atmospheric post-processing pipeline for Three.js WebGPU using TSL nodes. Use when adding UnrealBloom, SSAO, anti-aliasing (FXAA), vignette, and cinematic color grading.
---
# WebGPU Post-Processing Pipeline Protocol

## TSL Node Post-Processing Construction:
```typescript
import * as THREE from 'three/webgpu';
import { pass, bloom, fxaa } from 'three/tsl';

export function setupWebGPUPostProcessing(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const postProcessing = new THREE.PostProcessing(renderer);
  const scenePass = pass(scene, camera);
  
  // 1. UnrealBloom pass for glowing ruins and fire
  const bloomPass = bloom(scenePass, {
    threshold: 0.85,
    strength: 0.6,
    radius: 0.4
  });
  
  // 2. Anti-aliasing pass at the end of the chain
  const finalPass = bloomPass.pipe(fxaa());
  
  postProcessing.outputNode = finalPass;
  return postProcessing;
}
```

## Render Loop Integration:
Replace standard `renderer.render(scene, camera)` with `postProcessing.render()` inside animation loop.
```

---

### 23. `2d-topographic-brush-canvas/SKILL.md`
*Source: Interactive Heightmap Canvas Standards*

```markdown
---
name: 2d-topographic-brush-canvas
description: HTML5 2D canvas elevation drawing engine. Use when building the topographic heightmap sketching tool with soft radial falloff brushes, smoothing filters, and real-time texture sync.
---
# 2D Topographic Canvas Engine Protocol

## Radial Falloff Brush Construction:
```typescript
export function drawElevationBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  elevationValue: number // 0.0 to 1.0
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  const grey = Math.floor(elevationValue * 255);
  
  gradient.addColorStop(0, `rgba(${grey}, ${grey}, ${grey}, 0.4)`);
  gradient.addColorStop(1, `rgba(${grey}, ${grey}, ${grey}, 0.0)`);
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}
```

## Debounced Worker Transfer:
Debounce canvas updates by 50ms before transferring `ImageBitmap` to `depth.worker.ts` Web Worker to prevent WebGPU queue saturation.
```

---

### 24. `transformers-js-workers/SKILL.md`
*Source: `huggingface/skills/transformers-js`* [web:162]

```markdown
---
name: transformers-js-workers
description: In-browser ML execution using @huggingface/transformers inside dedicated Web Workers. Use when implementing Whisper speech-to-text, Depth Anything V2, or Kokoro TTS.
---
# Transformers.js Web Worker Protocol

## Rules for Zero Main-Thread Blocking:
1. **Dedicated Worker Threading:** Never instantiate `pipeline()` on main UI thread. Always create dedicated Worker instance.
2. **OffscreenCanvas Processing:** Process image data in worker using `OffscreenCanvas` instead of DOM elements. [web:48]
3. **Zero-Copy Transfers:** Always transfer `Float32Array.buffer` instances using Transferable objects: [web:58]
   ```typescript
   self.postMessage({ type: 'RESULT', data: floatArray.buffer }, [floatArray.buffer]);
   ```
4. **Quantization & Dtype:** Default to `dtype: 'fp16'` for WebGPU and `dtype: 'q8'` for WASM fallbacks.
```

---

### 25. `rapier3d-physics-controller/SKILL.md`

```markdown
---
name: rapier3d-physics-controller
description: Wasm-based 3D physics, collision authoring, and first-person character controllers. Use when adding gravity, terrain heightfield colliders, and WASD locomotion.
---
# Rapier3D Physics Protocol

## Physics Loop & Configuration:
1. Wrap interactive scene in `<Physics gravity={[0, -9.81, 0]} timeStep="vary">`.
2. **Terrain Colliders:** Use `<HeightfieldCollider>` derived directly from Depth Anything elevation matrix.
3. **Dynamic Props:** Wrap imported meshes in `<RigidBody type="fixed" colliders="hull">` for convex hulls, or `colliders="cuboid"` for optimized bounding boxes.
4. **Character Kinematics:**
   - Use `<KinematicCharacterController>` for first-person player motion.
   - Query ground contact via `controller.computedGrounded()` before applying jump impulse vectors.
```

---

### 26. `web-audio-spatial-hrtf/SKILL.md`

```markdown
---
name: web-audio-spatial-hrtf
description: 3D positional audio and HRTF panner management. Use when binding synthesized ambient sound effects and NPC voices to 3D Three.js object coordinates.
---
# Web Audio HRTF Spatial Protocol

## Configuration Matrix:
```typescript
const panner = audioCtx.createPanner();
panner.panningModel = 'HRTF';
panner.distanceModel = 'inverse';
panner.refDistance = 1.5;
panner.maxDistance = 60.0;
panner.rolloffFactor = 1.0;
panner.coneInnerAngle = 360;
```

## Render Loop Synchronization:
In Three.js `useFrame` loop, sync `AudioListener` position and orientation with camera matrix.
```
