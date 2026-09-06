# 02. UI & UX Design Brief

**Product:** EchoForge 3D  
**Design Standard:** Cartographic Field Workbench
**Authoritative Reference:** `./DESIGN.md`

---

## 1. Design tokens and visual atmosphere

```text
+----------------------------------------------------------------------------------------------------+
| Visual stance: Mineral field / Graphite chrome / Forge rust / Echo signal                         |
+----------------------------------------------------------------------------------------------------+
```

EchoForge is a local-first spatial editor, not a dashboard. The viewport is the dominant surface, while source intake, scene hierarchy, and selected-object properties form quiet editor regions around it.

### 1.1 Color tokens

- **Mineral canvas:** `#e7e4dc`
- **Graphite chrome:** `#202522`
- **Paper editor surface:** `#f4f1e9`
- **Elevated input surface:** `#fffdf8`
- **Forge rust:** `#c8643f`, creation, generation, and selection only
- **Echo signal:** `#65aeb0`, spatial audio and ambient signal only
- **Warning:** `#b77932`
- **Danger:** `#a9473a`

### 1.2 Typography hierarchy

- **Interface:** IBM Plex Sans, 400, 500, and 600.
- **Coordinates and telemetry:** IBM Plex Mono, 400 and 500.
- **Region labels:** sentence case, compact, and readable.
- **Workflow markers:** 9px mono kickers with sparse uppercase tracking.

---

## 2. Editor shell

```text
+----------------------------------------------------------------------------------------------------+
| EchoForge 3D / field 01 | Edit  Play | drawer | save | export                                      |
+----------------------------------------------------------------------------------------------------+
| rail | source / scene dock       |                 viewport                  | contextual inspector |
|      | 01 Reference intake      |        mineral field + 3D scene          | selected object       |
|      | 02 Scene hierarchy       |        contours + selection frame         | transform / audio    |
|      | 03 Field tools           |                                               | NPC authoring        |
+----------------------------------------------------------------------------------------------------+
| Local scene                                                               Runtime + diagnostics  |
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Desktop regions

- **Editor rail:** 52px. Create, Scene, and Tools are real work regions, not decorative navigation.
- **Source and scene dock:** approximately 280px to 300px. Create owns the reference-to-mesh action. Scene owns the hierarchy.
- **Viewport:** the remaining width, targeted at a minimum of 60% of the desktop shell.
- **Contextual inspector:** 280px to 320px when an entity is selected. The selected object synchronizes across the viewport, hierarchy, and inspector.
- **Bottom status:** one readiness line. Detailed Web Audio, Rapier, frame-time, P95, FPS, and terrain counts live in a revealable runtime tray.

### 2.2 Compact behavior

- The source dock becomes a left sheet capped at 320px.
- The viewport remains visible beside the sheet.
- Empty-state guidance moves into the visible viewport region.
- Secondary project controls collapse before Save and Export.
- The selected-object inspector is desktop-first and never blocks the compact source workflow.

---

## 3. Component specifications

### 3.1 Reference intake

- **Purpose:** upload a PNG, JPG, or WebP reference and create a mesh.
- **Primary action:** Generate Mesh, the only high-emphasis action in the Create region.
- **Supporting actions:** Generate Texture and Ambient Audio stay subordinate until a prompt or target exists.
- **Reference representation:** show the uploaded thumbnail and filename in the intake region.

### 3.2 Scene hierarchy

- **Purpose:** show the actual objects staged in the scene.
- **Rows:** use object glyphs, names, type metadata, and a rust selection state.
- **Empty state:** explain that forging a reference or adding an NPC creates the first scene entry.
- **NPC entry point:** remain available from the hierarchy without requiring an invisible inspector.

### 3.3 Contextual inspector

- **Purpose:** edit the selected entity rather than expose every feature at once.
- **Controls:** name, duplicate, delete, transform, audio emitter settings, NPC persona, and voice ID.
- **Selection rule:** selection in the viewport and hierarchy opens the same inspector state.
- **Destructive actions:** remain explicit and use the danger token.

### 3.4 Field tools

- **Purpose:** expose terrain painting and provider readiness without competing with creation.
- **Terrain:** retain the existing topographic canvas and controls.
- **System status:** reveal provider health and fallback provenance inside Tools.

### 3.5 Prompt command bar

- **Purpose:** enhance a selected scene object with material, soundscape, or NPC voice direction.
- **Placement:** below Create in the source dock until a future contextual command bar is needed.
- **Voice:** retain push-to-talk and the existing `M` shortcut.

---

## 4. Interaction states

| State | Visual indication | User action |
| :--- | :--- | :--- |
| **Empty** | Mineral contour field, lower-left source-to-stage guidance, no centered marketing card | Add reference image or switch to Scene / Tools |
| **Reference loaded** | Thumbnail and filename persist in Create, Generate Mesh becomes primary | Forge mesh |
| **Generating** | Existing non-blocking generation HUD uses restrained forge motion | Continue orbiting or inspect other controls |
| **Mesh ready** | Object becomes the dominant visual content, scene row appears, inspector opens on selection | Transform, rename, duplicate, material, audio, save, export |
| **Play mode** | Editor chrome recedes, mode indicator and crosshair remain | Walk and interact with NPCs |
| **Error** | Exact recovery message with danger token, no decorative glow | Retry or correct input |

---

## 5. Hotkey and navigation mapping

| Hotkey | Action | Scope |
| :--- | :--- | :--- |
| `<Tab>` | Toggle between Editor Mode and First-Person Walk Mode | Global |
| `<M>` (Hold) | Push-to-talk voice dictation | Editor Mode |
| `<W> <A> <S> <D>` | Character locomotion | First-Person Mode |
| `<Space>` | Character jump | First-Person Mode |
| `<E>` | Interact with nearest NPC | First-Person Mode |
| `<Cmd+Z> / <Ctrl+Z>` | Undo last scene graph transformation | Editor Mode |
| `<Cmd+B> / <Ctrl+B>` | Toggle the source dock | Editor Mode |

---

## 6. Visual guardrails

- No generic AI gradients, aurora backgrounds, or pure black canvas.
- No repeated feature-card grid or permanent telemetry wall.
- No normal-state backdrop blur, glow, or large shadows on editor regions.
- No colorful icon tile above every heading.
- Do not copy a reference product literally.
- Do not add feature scope merely to make the shell look richer.
