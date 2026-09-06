# EchoForge 3D Design System

EchoForge is a local-first worldbuilding editor. Its interface should feel like a field instrument for turning a visual reference into a staged 3D scene, not like an AI dashboard or a marketing landing page.

## 1. Visual stance

**Cartographic Field Workbench**

> A reference image enters a field console, becomes a forged object, and is staged in a living scene.

The primary surface archetype is **Command / Inspect**, with **Explore** as the secondary behavior. The viewport is the dominant surface. Creation, hierarchy, and selected-object properties are quiet editor regions around it.

The visual system borrows structural conventions from mature creative tools, including a central canvas, scene hierarchy, contextual inspector, compact tool rail, and task-specific regions. It does not copy Blender, Unity, Figma, Spline, Meshy, Substance, or Runway.

## 2. Color tokens

### 2.1 Surfaces

- `{bg.canvas}`: `#e7e4dc`, mineral viewport field.
- `{bg.chrome}`: `#202522`, graphite application chrome.
- `{bg.surface}`: `#f4f1e9`, paper editor regions and docks.
- `{bg.subtle}`: `rgba(32, 37, 34, 0.05)`, inactive wells and hover rows.
- `{bg.elevated}`: `#fffdf8`, inputs and menus.

### 2.2 Borders

- `{border.subtle}`: `rgba(32, 37, 34, 0.15)`, structural hairlines.
- `{border.focus}`: `rgba(200, 100, 63, 0.55)`, keyboard and input focus.
- `{border.interactive}`: `rgba(32, 37, 34, 0.30)`, controls and hover states.

### 2.3 Semantic accents

- `{accent.forge}`: `#c8643f`, creation, generation, and object selection.
- `{accent.echo}`: `#65aeb0`, spatial audio, waveform, and ambient signal only.
- `{accent.warning}`: `#b77932`, recoverable warnings.
- `{accent.danger}`: `#a9473a`, destructive actions and failures.
- `{accent.secondary}`: `#202522`, neutral secondary emphasis.

Rust is the product signature. Blue-green must not become a second brand color. It is reserved for audio and spatial feedback so the UI communicates meaning through color.

## 3. Typography

- **Interface:** IBM Plex Sans, weights 400, 500, and 600.
- **Technical metadata:** IBM Plex Mono, weights 400 and 500.
- **Headings:** sentence case, tight tracking, no decorative all-caps.
- **Kickers:** mono, 9px, uppercase, `0.12em` tracking, used only for coordinates and workflow markers.
- **Telemetry:** mono, 9px to 11px, tabular numerals.

| Element | Font | Size | Weight | Treatment |
| :--- | :--- | :--- | :--- | :--- |
| Application wordmark | IBM Plex Sans | 13px | 500 | tight tracking |
| Region title | IBM Plex Sans | 16px to 18px | 500 or 600 | sentence case |
| Standard control | IBM Plex Sans | 11px to 13px | 400 or 500 | compact |
| Workflow kicker | IBM Plex Mono | 9px | 400 | sparse uppercase |
| Telemetry | IBM Plex Mono | 9px to 11px | 400 or 500 | tabular numerals |

## 4. Geometry and depth

- Canvas and editor regions use square corners.
- Controls use `4px` corners at most.
- Pills are reserved for transient status indicators such as recording state.
- Major regions use hairline borders and no normal-state shadows.
- Backdrop blur is not used for ordinary editor surfaces.
- Selection uses rust borders, brackets, or axis frames. Do not use glow as the primary selection signal.
- Motion is restrained and disabled under `prefers-reduced-motion`.

`GlassPanel` remains as a compatibility name for feature components, but its implementation is a flat editor surface, not glassmorphism.

## 5. Editor shell

```text
+------------------------------------------------------------------------------------------+
| EchoForge 3D / field 01 | Edit  Play | drawer | save | export                            |
+------------------------------------------------------------------------------------------+
| rail | source / scene dock       |                 viewport                  | inspector  |
|      | 01 Reference intake      |        mineral field + 3D scene          | selection  |
|      | 02 Scene hierarchy       |        selection frames + contours         | transform  |
|      | 03 Field tools           |                                               |
+------------------------------------------------------------------------------------------+
| Local scene                                                               Runtime +      |
+------------------------------------------------------------------------------------------+
```

Desktop layout:

- Tool rail: 52px, Create, Scene, and Tools.
- Source and scene dock: approximately 280px to 300px.
- Viewport: remaining width, with a minimum target of 60% of the desktop shell.
- Context inspector: 280px to 320px when an object is selected.
- Bottom status: one quiet readiness line with diagnostics in a revealable tray.

Compact layout:

- The source dock becomes a left sheet, capped at 320px.
- The viewport remains visible beside it.
- Empty-state guidance moves into the visible viewport region.
- Secondary project controls collapse before the primary save and export actions.

## 6. Meaningful motifs

Motifs must explain the workflow rather than decorate it:

- Contour and grid lines: terrain and spatial context.
- Registration ticks and framed thumbnails: reference alignment.
- Rust brackets: selected or forged objects.
- Waveform marks and blue-green signal: ambient audio.
- Scene rows with object glyphs: hierarchy and staging.

Do not add random scan lines, fake blueprint noise, aurora gradients, decorative grain, or colorful icon tiles.

## 7. Interaction rules

- One dominant action per state. In Create, that is Generate Mesh.
- Creation uses rust. Audio uses blue-green. Warnings and destructive actions use their semantic colors.
- Advanced terrain and provider diagnostics live in Tools, not in the first-run path.
- Object selection synchronizes the viewport, Scene hierarchy, and right inspector.
- Play mode recedes the editor chrome while retaining a small mode indicator and movement affordance.
- Keyboard actions remain discoverable through labels and native focus states.

## 8. Banned defaults

- No generic purple or blue AI gradients.
- No pure black canvas.
- No repeated dashboard card grids.
- No centered marketing card as the primary empty state.
- No permanent telemetry wall.
- No unearned blur or glow.
- No default rounded-square product badge.
- No visual expansion of scope merely to make the interface look richer.
