# 02. UI & UX Design Brief

**Product:** EchoForge 3D  
**Design Standard:** Linear + Raycast + Supabase Hybrid Studio Architecture  
**Authoritative Reference:** `./DESIGN.md`

---

## 1. Design Tokens & Visual Atmosphere

```
+----------------------------------------------------------------------------------------------------+
| Visual Stance: Obsidian Dark Studio (`#08090a`) / Frosted Glass / Emerald Telemetry (`#10b981`)     |
+----------------------------------------------------------------------------------------------------+
```

### 1.1 Color Tokens
- **Canvas Base:** `#08090a` (Deep obsidian background)
- **Glassmorphic Cards:** `rgba(18, 20, 24, 0.75)` with `backdrop-blur-md` and 1px border `rgba(255, 255, 255, 0.08)`
- **Primary Accent (Emerald):** `#10b981` (RGB: `16, 185, 129`) for active tools, recording status, and camera nodes
- **Secondary Accent (Linear Violet):** `#5e6ad2` for export actions and mode switches
- **Telemetry Cyan:** `#06b6d4` for vertex counters, FPS telemetry, and VRAM monitors
- **Error Danger:** `#ef4444` for GPU resets, out-of-bounds errors, and network disconnects

### 1.2 Typography Hierarchy
- **Interface Labels:** `Inter` or `Geist Sans` (Clean sans-serif for buttons, tooltips, tabs)
- **3D Coordinates & Telemetry:** `JetBrains Mono` or `Geist Mono` (`tabular-nums` for vector math, memory meters)

---

## 2. Screen Inventory & Split-Workstation Layout

```
+----------------------------------------------------------------------------------------------------+
| [Top Bar] EchoForge 3D | VRAM: 4.2GB/8GB [■■■■■□□□□□] | (•) Voice: Ready | [Export .GLB / Scene]    |
+----------------------------------------------------------------------------------------------------+
| [Left Drawer - Resizable (25% - 40%)] | [Right Viewport - Full Bleed (60% - 75%)]                   |
| ├── 2D Topographic Canvas (Elevation) |                                                             |
| │    - Radius: [ 24px ]               |   Three.js WebGPU 60 FPS Viewport                           |
| │    - Height Value: [ 0.85 ]         |   - Displaced Heightfield Terrain (TSL Shader)              |
| ├── Voice & Text Prompt Input         |   - Rapier3D Wasm Rigid Body Physics                        |
| │    "Place 3 pillars around fire"    |   - HRTF Positional Spatial Audio Nodes                     |
| └── Scene Entity Inspector            |   - Inspectable NPC Agent (SmolVLM)                         |
|      ├── Terrain (Heightmap Mesh)     |                                                             |
|      ├── Gothic_Arch (PBR Stone)      |   [Floating HUD: Press <Tab> to Playtest]                   |
|      └── Campfire (WAV Audio Node)    |                                                             |
+----------------------------------------------------------------------------------------------------+
| [Bottom Bar] Web Audio: 44.1kHz | Rapier: Running | Frame Time: 14.2ms | FPS: 60                   |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. Component Specifications & Interaction States

### 3.1 2D Topographic Canvas
- **Purpose:** Draw grayscale elevation contours.
- **Controls:** Brush Size slider (8px–128px), Height Intensity slider (0.0 to 1.0), Clear Canvas, Invert Elevation.
- **Feedback:** Real-time radial blur preview on hover; updates to Three.js terrain geometry debounced at 50ms.

### 3.2 Voice Prompt Input Bar
- **Purpose:** Dictate natural language scene operations.
- **States:**
  - `Idle`: Dark slate pill with microphone icon and hotkey prompt (`Hold M to Speak`).
  - `Recording`: Emerald pulsing glow (`animation: voice-pulse`) with audio level waveform.
  - `Transcribing`: Wireframe loading shimmer.
  - `Executed`: Brief green confirmation flash with generated action summary badge.

### 3.3 Three.js WebGPU Viewport & HUD
- **HUD Non-Blocking Rule:** Parent HUD container has `pointer-events-none`. Floating chips (hotkeys, mini-stats) use `pointer-events-auto`.
- **First-Person Transition:** Pressing `Tab` smoothly fades the left drawer, engages HTML5 pointer lock, and displays a center crosshair with interaction prompt (`[E] Talk to NPC`).

---

## 4. State Matrix

| State | Visual Indication | User Action Available |
| :--- | :--- | :--- |
| **Empty State** | Flat wireframe terrain grid with soft ambient fog. Top-left card displays *"Sketch terrain or press M to speak."* | Paint elevation brush or dictate prompt. |
| **Generating State** | Targeted 3D bounding box glows with an animated emerald wireframe shimmer. Telemetry bar displays *"Generating mesh via TripoSR..."* | Viewport camera remains fully orbitable; UI is non-blocking. |
| **Error State** | Floating glass toast at bottom-right with red border (`#ef4444`) and exact recovery action (*"GPU Queue Saturated - Retrying in 3s"*). | Dismiss button, Retry action button. |
| **Success State** | Generated `.glb` mesh drops into scene with physical particle dust; audio emitter activates at mesh origin. | Undo action (`Cmd+Z`), select, move, scale. |

---

## 5. Hotkey & Navigation Mapping

| Hotkey | Action | Scope |
| :--- | :--- | :--- |
| `<Tab>` | Toggle between Editor Mode and First-Person Walk Mode | Global |
| `<M>` (Hold) | Push-to-talk voice command dictation | Editor Mode |
| `<W> <A> <S> <D>` | Character locomotion | First-Person Mode |
| `<Space>` | Character jump (gravity physics) | First-Person Mode |
| `<E>` | Interact with nearest NPC (trigger visual dialogue) | First-Person Mode |
| `<Cmd+Z> / <Ctrl+Z>` | Undo last scene graph transformation | Editor Mode |
| `<Cmd+B> / <Ctrl+B>` | Toggle collapse/expand of left creation drawer | Editor Mode |
