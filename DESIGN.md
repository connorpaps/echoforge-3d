# EchoForge 3D: Custom Design System Specification (`DESIGN.md`)

A tailored **`DESIGN.md`** visual specification engineered specifically for **EchoForge 3D**. 

This design system blends the best architectural elements from three tier-1 products in `VoltAgent/awesome-design-md`:
- **Linear:** High-density keyboard-first toolbars, hairline 1px borders, and muted card surfaces.
- **Raycast:** Dark chrome glassmorphism, floating HUD chips, and keycap badges.
- **Supabase:** Clean telemetry readouts, monospace data chips, and emerald accent glows.

---

## 1. Visual Atmosphere & Creative Stance

```
  +---------------------------------------------------------------------------------------+
  | Aesthetic: Obsidian Dark Studio / Neon Emerald Telemetry / Glassmorphic HUD Overlays |
  +---------------------------------------------------------------------------------------+
```
- **The Stance:** EchoForge 3D is a professional, high-performance creative workstation, not a marketing landing page.
- **Visual Weight:** Dark, deep obsidian surfaces (`#08090a`) that make the 3D WebGPU canvas and displaced terrain meshes stand out.
- **Hierarchy:** The 3D canvas is the central visual anchor. UI sidebars, elevation brush drawers, and inspector chips float unobtrusively using semi-transparent frosted glass.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Surface & Background Tokens
- `{bg.canvas}`: `#08090a` (Main application background & viewport clear color)
- `{bg.surface}`: `rgba(18, 20, 24, 0.75)` (Glassmorphic cards, drawers, and modal panels)
- `{bg.subtle}`: `rgba(255, 255, 255, 0.03)` (Hover rows, inactive tool wells)
- `{bg.elevated}`: `#16181d` (Dropdown menus, context tooltips, popovers)

### 2.2 Border & Hairline Tokens
- `{border.subtle}`: `rgba(255, 255, 255, 0.08)` (Default 1px hairline border for all panels)
- `{border.focus}`: `rgba(16, 185, 129, 0.50)` (Active tool selection, focused input fields)
- `{border.interactive}`: `rgba(255, 255, 255, 0.16)` (Button hover border)

### 2.3 Brand & Telemetry Accents
- `{accent.primary}`: `#10b981` (Emerald Glow — Active tool indicators, recording pill)
- `{accent.primary.rgb}`: `16, 185, 129` (Used for dynamic CSS drop shadows)
- `{accent.secondary}`: `#5e6ad2` (Linear Violet — Mode toggles, export actions)
- `{accent.cyan}`: `#06b6d4` (Cyan Glow — 3D vertex counts, VRAM memory meters)
- `{accent.danger}`: `#ef4444` (Error toasts, GPU reset warnings)

### 2.4 Typography Color Hierarchy
- `{text.primary}`: `#f8fafc` (High-contrast active labels, titles, prompt text)
- `{text.secondary}`: `#94a3b8` (Subtitles, parameter names, helper descriptions)
- `{text.muted}`: `#64748b` (Inactive hotkeys, disabled states)
- `{text.telemetry}`: `#34d399` (Monospace coordinate text, memory figures)

---

## 3. Typography & Font Hierarchy

- **Interface Font:** `Inter` or `Geist Sans`
- **Telemetry & Coordinate Font:** `JetBrains Mono` or `Geist Mono`

| UI Element | Font Family | Size | Weight | Tracking / Case |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Header** | Interface | `14px (text-sm)` | `600 (Semibold)` | `-0.01em` |
| **Section Labels** | Interface | `11px (text-xs)` | `500 (Medium)` | `+0.05em (UPPERCASE)` |
| **Standard Controls** | Interface | `13px (text-sm)` | `400 (Regular)` | `normal` |
| **3D Telemetry Readouts** | Telemetry | `11px (text-xs)` | `500 (Medium)` | `tabular-nums (Mono)` |
| **Keycap Badges (KBD)** | Telemetry | `10px (text-[10px])` | `600 (Semibold)` | `monospace` |

---

## 4. Component Geometries & Interactive States

### 4.1 Radii System
- `{rounded.none}`: `0px` (Full-bleed 3D canvas viewport)
- `{rounded.xs}`: `4px` (Keycap badges `<kbd>Tab</kbd>`, inline status chips)
- `{rounded.sm}`: `6px` (Toolbar buttons, dropdown menu items)
- `{rounded.md}`: `8px` (Floating HUD panels, prompt input bar, inspector drawers)
- `{rounded.full}`: `9999px` (Recording indicator pills, avatar badges)

### 4.2 Elevation & Glassmorphism
- **Floating Panel Glass:** `backdrop-blur-md bg-[rgba(18,20,24,0.75)] border border-[rgba(255,255,255,0.08)] shadow-[0_8px_32px_rgba(0,0,0,0.4)]`
- **Active Tool Glow:** `shadow-[0_0_15px_rgba(16,185,129,0.25)] border-emerald-500/60`
- **Keycap Style:** `bg-zinc-800/80 border border-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-inner`

### 4.3 Interactive Feedback Laws
- **Buttons:** `active:scale-[0.98] transition-all duration-150`
- **Tool Selection:** Instant border-color swap to `{accent.primary}` without layout shifting.
- **Voice Recording Indicator:** Subtle pulsing emerald ring:
  ```css
  @keyframes voice-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  }
  ```

---

## 5. Screen Layout & Split-View Structure

```
+-------------------------------------------------------------------------------------------+
| [Top Bar] Project Title | VRAM: 4.2GB/8GB (52%) | (•) Voice: Ready | [Export .GLB / Scene] |
+-------------------------------------------------------------------------------------------+
| [Left Drawer - Resizable]            | [Right Viewport - Full Bleed]                     |
| ├── 2D Topographic Canvas            |                                                   |
| │    [ Elevation Brush: R=24 H=0.8 ] |   Three.js WebGPU 60 FPS Viewport                 |
| ├── Natural Language Prompt Input    |   - Displaced Terrain Mesh                        |
| │    "Spawn 3 stone pillars..."      |   - Baked Colliders & Physics                     |
| └── Scene Entity Inspector           |   - Positional Audio Emitters (HRTF)              |
|      - Monolith_01 (PBR Stone)       |                                                   |
|      - Bonfire (WAV Audio Node)      |   [Floating HUD: Press <Tab> to Playtest]         |
+-------------------------------------------------------------------------------------------+
| [Bottom Bar] Ambient Audio Bus: 44.1kHz | Rapier3D: Running | Latency: 12ms                |
+-------------------------------------------------------------------------------------------+
```

---

## 6. Strict Design Anti-Patterns (Banned AI Defaults)

- ❌ **NO Generic Purple Gradients:** Never use `bg-gradient-to-r from-purple-500 to-indigo-600` on cards or headers.
- ❌ **NO Pure Black (#000000):** Pure black destroys shadow depth. Always use deep zinc/slate `#08090a`.
- ❌ **NO Center-Aligned Feature Cards:** EchoForge 3D is a studio workstation, not a marketing template. All controls must be aligned to structural toolbars and docks.
- ❌ **NO Layout-Blocking Overlays:** HUD containers must have `pointer-events-none` with child chips set to `pointer-events-auto` so 3D navigation is never blocked.
- ❌ **NO Unstyled Dialogs:** Every modal must have a semi-transparent backdrop blur and 1px hairline border matching `{border.subtle}`.
