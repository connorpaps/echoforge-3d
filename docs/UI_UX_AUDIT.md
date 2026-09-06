# EchoForge 3D UI/UX Audit

**Audit scope:** first-run experience, core image-to-3D workflow, editor layout, visual hierarchy, responsiveness, accessibility, and discoverability.

**Audit basis:** live local application inspection, current repository implementation, `DESIGN.md`, PRD and design brief, and external guidance from Nielsen Norman Group, Material Design 3, Blender, Unity, Figma, Apple Human Interface Guidelines, Carbon Design System, and W3C WCAG 2.2.

**Bottom line:** EchoForge has a credible creative-tool foundation, but the current interface is organized around the original feature inventory rather than the user's primary job. The result is visually dense, technically expressive, and difficult to understand on first contact. The highest-value redesign is not a new visual theme. It is a task-oriented information architecture built around:

> **Reference image → Generate 3D model → Place/edit in scene → Enhance → Save/export**

The original dark studio identity has now been replaced with a warm light studio palette. The hierarchy changes below have been implemented in the first redesign pass.

### Implementation status

- **Shipped:** creation-first left drawer with `Create a 3D asset` as the primary surface.
- **Shipped:** contextual empty viewport state with a single upload CTA linked to the existing reference-image input.
- **Shipped:** `Optional tools` and `System status` disclosure sections for terrain, voice, and provider diagnostics.
- **Shipped:** compact-width sheet layout for the creation drawer, plus a visible controls toggle.
- **Shipped:** warm neutral surfaces, readable slate text, restrained teal/slate accents, lighter 3D ground, and consistent light export background.
- **Shipped:** less prominent secondary generation actions and a tighter, grouped toolbar.

The remaining findings in this document are the next polish queue, not claims that the first redesign pass was never implemented.

---

## 1. Executive assessment

### What is working

- The application has a recognizable dark studio direction rather than a generic dashboard.
- The central 3D canvas is correctly treated as the main content area.
- The project already has the right broad surfaces: creation controls, scene editing, provider status, persistence, and export.
- The interface exposes real system state instead of silently hiding local GPU/provider behavior.
- The code has reusable visual primitives such as `GlassPanel`, `SectionLabel`, `StatusPill`, telemetry text, and design tokens.
- The app supports a resizable split layout and a collapsible drawer concept.

### What is holding it back

1. **The first screen does not communicate the primary action.** The user sees a large empty grid and a terrain sketching tool before the image-to-3D path.
2. **Too many feature families compete at the same level.** Terrain, voice prompting, image generation, materials, audio, NPCs, provider diagnostics, and telemetry are all visible together.
3. **The layout is technically responsive but not practically adaptive.** At a normal desktop capture the top toolbar overflows horizontally, and at a narrow preview the left drawer becomes unusably small.
4. **The visual language is over-dense.** Small uppercase labels, multiple colored accents, repeated cards, translucent surfaces, and telemetry create noise instead of focus.
5. **The scene/editor model is not visible enough.** The scene inspector is below the fold in the empty state and there is no persistent, obvious scene hierarchy comparable to a creative editor's outliner.
6. **Technical state is presented as user-facing product navigation.** Provider names and runtime jargon are useful, but should not compete with the creation workflow.

### Overall judgment

This is not a broken UI. It is a **feature-complete prototype shell with a weak product hierarchy**. The right next phase is a focused UX redesign, not more model integrations or more feature panels.

---

## 2. Evidence from the live application

A live local desktop capture was inspected at approximately 1075 × 1175 browser-window pixels. The following behavior was visible:

- The top app bar displayed the product title, VRAM meter, mesh provider, voice status, drawer shortcut, FX toggle, Save Project, Load Project, New Project, and Export. The row overflowed horizontally, with the export control clipped at the right edge.
- The left drawer consumed roughly 30% of the app and stacked five major areas vertically: topographic canvas, prompt/voice, generation, provider readiness, and scene inspector.
- The first visible panel was a black, empty topographic canvas. It had more visual prominence than the primary image upload flow.
- The center viewport showed a nearly empty, very dark grid with no instruction, sample object, or obvious call to action.
- The image upload control appeared below the terrain and prompt panels. Generate Mesh and Generate Texture received almost equal visual treatment even though Generate Mesh is the core first action and texture generation requires a target entity and prompt.
- Provider readiness occupied a large portion of the left drawer and exposed implementation-level terms such as `Hunyuan3D-2GP`, `TripoSR ACTIVE FALLBACK`, `AudioGen FALLBACK: PROCEDURAL`, `SmolVLM FALLBACK: CANNED`, and `BROWSER WORKER`.
- The scene inspector and its editing model were not visible without scrolling in the empty state.
- The bottom bar exposed Web Audio, ambient bus count, Rapier, frame time, P95, and FPS continuously. This is useful diagnostic information, but not high-priority first-run content.

The attached user screenshot showed an even more reduced version of the problem: effectively only the dark viewport/grid, without enough context to understand what the application does or what to do next.

---

## 3. Priority findings

### P0, fix before calling the interface polished

#### P0.1 The primary workflow is buried

**Problem:** The product's strongest capability is reference image → 3D model, but the first panel is `2D TOPOGRAPHIC CANVAS`. Upload is the third major card, below terrain and prompt.

**Impact:** A new user can reasonably conclude that EchoForge is a terrain sculpting tool, a voice-controlled scene builder, or a GPU monitoring dashboard. They are not led to the model-generation workflow.

**Evidence:** `src/components/workspace/LeftDrawer.tsx` renders `TopoCanvas`, `PromptBar`, `GenerationPanel`, `ProviderStatusPanel`, then `SceneInspector` in that order.

**Recommendation:** Make `Create 3D asset` the first and visually dominant panel. Move terrain to an optional `Environment` section or mode. Move voice, materials, audio, and NPC authoring into context-sensitive enhancement sections.

#### P0.2 The empty state has no task-oriented CTA

**Problem:** The viewport is visually dominant but empty. The left inspector says: `No entities yet. Sketch terrain to begin, upload an image or generate an asset, then press Tab for play mode.` This is a list of unrelated possibilities, not a next step.

**Impact:** The user must infer the workflow from disabled buttons and scattered copy. The large empty canvas looks like a loading failure or an unfinished screen.

**Recommendation:** Add a central empty-state card over the viewport:

```text
Create your first 3D asset
Upload a reference image and EchoForge will generate a model you can place and edit.

[ Upload reference image ]

PNG, JPG, or WebP · local processing · up to 10 MB
```

Use one primary CTA, one short explanation, and a secondary `Open sample` action only if a privacy-safe local sample is already part of the product.

#### P0.3 Responsive behavior fails at useful widths

**Problem:** The app uses horizontal overflow in the top bar and retains a 30% permanent drawer even when the available width is too narrow. The screenshot showed toolbar clipping. The preview pane can reduce the drawer to a width where text and controls are no longer usable.

**Impact:** The app is not practically usable in a narrow browser window, embedded preview, or laptop split-screen layout.

**Recommendation:** Define explicit layout breakpoints:

- **≥ 1200 px:** persistent left creation rail, central viewport, optional right inspector.
- **800–1199 px:** compact left rail or narrower drawer, inspector opens as a sheet.
- **< 800 px:** modal drawer or bottom sheet; no permanent multi-card sidebar.
- **< 600 px:** compact navigation control plus one active panel; do not squeeze the full workstation into three columns.

At every width, the primary CTA must remain fully visible. Overflow should become a deliberate `More` menu, not clipped text.

#### P0.4 The toolbar has no hierarchy

**Problem:** Save Project, Load Project, New Project, FX, provider telemetry, voice status, and Export sit in one crowded horizontal row. Most controls are text-only and visually similar.

**Impact:** The user cannot distinguish document actions, display settings, runtime status, and the primary action.

**Recommendation:** Split the toolbar into three groups:

- **Leading:** sidebar toggle, project name, saved/unsaved state.
- **Center:** mode switcher, `Create`, `Scene`, `Play`.
- **Trailing:** one prominent `Save` action, `Export`, and a `More` menu for New Project, FX, diagnostics, and shortcuts.

Keep only one visually primary action per toolbar state.

#### P0.5 The current UI exposes too much implementation detail too early

**Problem:** Provider readiness is valuable for trust and debugging, but it currently occupies a large first-run panel and uses provider/model names as the main language.

**Impact:** Users are forced to understand Hunyuan, TripoSR, SDXL-Turbo, AudioGen, SmolVLM, Whisper, Kokoro, and Depth Anything before they have created anything.

**Recommendation:** Show a single workflow-level status near the Generate button:

```text
3D generation: Ready
Using local fallback: TripoSR
```

Put the complete provider matrix behind a collapsed `System status` disclosure. Keep the detailed panel for troubleshooting and portfolio evidence, not as primary creation UI.

---

### P1, fix during the main redesign

#### P1.1 The information architecture follows feature inventory, not user intent

Current visible sections are:

- 2D Topographic Canvas
- Prompt
- Generate
- Provider readiness
- Scene Inspector
- bottom runtime telemetry

A better structure is task-based:

- **Create:** reference image, generation, model result.
- **Scene:** object list, selection, transforms.
- **Enhance:** material, audio, NPC.
- **Environment:** terrain and future atmosphere tools.
- **System:** provider readiness, VRAM, diagnostics.
- **Play:** first-person preview.

This avoids presenting every capability at once and creates a natural place for future features without expanding the default screen.

#### P1.2 The scene hierarchy is not persistent or obvious

The project has a scene inspector, but it appears low in the drawer and only becomes useful after an entity exists. Creative tools commonly keep an object/layer list and a context-sensitive properties panel visible or immediately accessible.

**Recommendation:** Use a compact `Scene` outliner as the persistent secondary surface. Show object type icons, names, visibility, and selection. Keep transforms and type-specific properties in an inspector that appears only when an entity is selected.

Suggested desktop layout after the first asset exists:

```text
┌─────────────────────────────────────────────────────────────┐
│ project / modes / save / export                             │
├─────────────┬───────────────────────────────┬───────────────┤
│ Scene list  │                               │ Inspector     │
│ objects     │         3D viewport           │ selected item │
│             │                               │ transforms    │
├─────────────┴───────────────────────────────┴───────────────┤
│ compact runtime status                                      │
└─────────────────────────────────────────────────────────────┘
```

#### P1.3 The prompt's scope is ambiguous

The placeholder `Spawn 3 stone pillars around a campfire…` suggests that the field executes structured scene commands. The current product scope explicitly defers a structured natural-language scene-command layer.

**Recommendation:** Rename and explain it honestly:

```text
Scene prompt (optional)
Describe a material, ambience, or NPC behavior.
```

If scene commands are not active, do not imply that they are. If the field is eventually expanded, expose a separate `Scene command` mode with explicit previews and undo.

#### P1.4 Disabled controls do not explain their dependency

Generate Texture and Generate Ambient Audio are disabled until a prompt or selected entity exists, but the user only sees disabled buttons.

**Recommendation:** Add dependency copy and contextual labels:

- `Generate texture` → `Select an object first` when no object is selected.
- `Add ambience` → `Describe the ambience above` when prompt is empty.
- Use tooltips or inline helper text rather than making the user guess why a control is inert.

#### P1.5 Typography is too small for a primary editor

The implementation uses many `text-[9px]`, `text-[10px]`, and `text-[11px]` styles. This makes the UI feel like a diagnostic console and becomes especially difficult inside a narrow drawer.

**Recommendation:**

- Body and control text: 13–14 px.
- Section labels: 11–12 px, uppercase only when useful.
- Secondary helper text: at least 12 px.
- Telemetry: 11–12 px and visually subordinate.
- Avoid long uppercase provider/status strings in small text.

#### P1.6 The visual system uses too many competing accents

Emerald, violet, cyan, red, glass surfaces, borders, glow states, and monospace telemetry all appear in the same view. The result reads as a sci-fi HUD rather than a calm professional tool.

**Recommendation:** Keep the palette but assign strict semantic jobs:

- **Emerald:** one primary creation action and success state.
- **Neutral gray:** all standard controls and surfaces.
- **Cyan:** runtime/measurement data only.
- **Violet:** export or play mode only, not a second generation CTA.
- **Red/amber:** warnings and fallback states.

Do not give Generate Mesh, Generate Texture, Audio, voice, provider rows, and telemetry all separate visual emphasis.

#### P1.7 Glassmorphism is reducing separation rather than adding polish

The current panel recipe uses translucent backgrounds, blur, hairline borders, and shadows on nearly every section. In the screenshot, the panel grouping is technically present but visually low-contrast and repetitive.

**Recommendation:** Use fewer, more meaningful surfaces. Make the creation panel and inspector opaque enough to read clearly. Reserve blur and glow for overlays, transient progress, and selected states. Let the viewport be the visually rich surface.

#### P1.8 The viewport needs a neutral studio presentation

The empty grid is too dark and visually ambiguous. At the same time, the generated dark chair evidence required `FX: Off` for readability. This indicates that the viewport presentation is not yet a reliable product surface.

**Recommendation:** Add a neutral studio environment for editor mode:

- soft charcoal background, not near-black everywhere;
- readable floor plane with restrained grid lines;
- subtle key/fill/rim lighting;
- clear horizon or ground contact;
- camera reset and frame-selected controls;
- selected-object outline or transform gizmo;
- separate cinematic/play mode treatment if desired.

The goal is not photorealism. The goal is that a generated object is immediately legible.

#### P1.9 Document actions need document state

Save, Load, and New Project are presented as bare text actions. The UI does not visibly communicate project name, dirty state, or whether a destructive action will discard unsaved work.

**Recommendation:** Add:

```text
Untitled scene · Unsaved
```

or

```text
Chair study · Saved 2m ago
```

Protect `New Project` with a confirmation when unsaved changes exist. Keep Save visible and make Load/New part of a document menu if space is limited.

#### P1.10 The bottom telemetry bar is overexposed

Web Audio, emitter count, Rapier, frame time, P95, and FPS are not the user's first concern. The always-on data competes with the creation experience.

**Recommendation:** Keep a compact status summary, for example:

```text
Ready · 60 FPS · 0 emitters
```

Put detailed diagnostics behind `System status` or a click-to-expand tray. This keeps the capability without turning the first screen into a debug panel.

---

### P2, later polish and efficiency work

#### P2.1 Keyboard shortcuts should be discoverable but quiet

`Cmd+B`, `Tab`, and `M` are useful accelerators, but displaying them in the main toolbar before the user knows the corresponding tasks adds cognitive load.

Keep shortcuts in a help menu, tooltips, and a command palette. Show the most relevant shortcut only next to an action that the user has already discovered.

#### P2.2 Add a compact command/help surface

A command palette or shortcut sheet would suit the workstation concept after the primary flow is clear. It should not be the first-run navigation model.

#### P2.3 Add focused editor states instead of a universal dashboard

Useful future states include:

- `Create` for image-to-3D generation;
- `Scene` for hierarchy and transforms;
- `Enhance` for materials, audio, and NPC authoring;
- `Play` for first-person inspection.

These can reuse the same viewport instead of adding more persistent cards.

#### P2.4 Provide camera and viewport controls

A small viewport toolbar should include `Frame selected`, `Reset view`, `Grid`, `Lighting`, and `FX`. These are more useful in context than a global `FX: On` button in the top bar.

---

## 4. Recommended target experience

### First-run state

```text
┌──────────────────────────────────────────────────────────────┐
│ EchoForge 3D   Untitled scene · Unsaved   Create Scene Play  │
│                                              Save   Export ⋯ │
├───────────────┬──────────────────────────────────────────────┤
│ CREATE        │                                              │
│               │                                              │
│ Create a 3D  │              Empty viewport                   │
│ asset         │                                              │
│               │      Create your first 3D asset              │
│ 1 Reference   │      Upload an image to begin.               │
│ [drop image]  │                                              │
│               │      [ Upload reference image ]              │
│ 2 Generate    │                                              │
│ [Generate 3D │      Local processing · no account required   │
│  model]       │                                              │
│               │                                              │
│ Options ▸     │                                              │
│ System status │                                              │
└───────────────┴──────────────────────────────────────────────┘
│ Ready · Web Audio · 60 FPS                                   │
└──────────────────────────────────────────────────────────────┘
```

### After generation

The creation panel becomes an asset result panel:

```text
Asset ready
Chair reference
20,000 faces · Hunyuan3D-2GP

[ Add to scene ]  [ Generate another ]

Scene
● Chair

Enhance ▸
Environment ▸
System status ▸
```

The viewport should automatically frame the model and display a small, dismissible status toast. The inspector should open because there is now a selected object.

### Scene editing state

- Persistent scene list on the left or in a narrow rail.
- Viewport in the center.
- Contextual inspector on the right.
- Generation and enhancement controls accessible through modes or collapsible sections, not all shown simultaneously.
- `Play` is an explicit mode, not an unexplained keyboard-only transition.

### Narrow state

- Top bar becomes: menu, project name, Save, More.
- Creation panel becomes a modal drawer or bottom sheet.
- Inspector becomes a sheet opened from the selected object.
- No horizontal scroll for primary actions.
- No card may require reading clipped text to understand its action.

---

## 5. Content and naming recommendations

| Current | Recommended | Reason |
|---|---|---|
| 2D Topographic Canvas | Terrain | Plain language, shorter, optional context |
| Prompt | Scene prompt (optional) | Clarifies scope |
| Generate | Create 3D asset | Names the outcome |
| Upload a reference image | Add reference image | More direct action label |
| Generate Mesh | Generate 3D model | User-facing terminology |
| Generate Texture | Apply material | Describes the scene effect |
| Generate Ambient Audio | Add ambience | Shorter, less technical |
| Provider readiness | System status | Keeps implementation detail secondary |
| FX: On | Preview effects | Explains what changes |
| Mesh: TripoSR | 3D engine: TripoSR fallback | Makes the provider status interpretable |
| No entities yet... | Your scene is empty. Start by uploading an image. | One next step instead of three unrelated options |
| `Hunyuan3D-2GP UNAVAILABLE` | `3D generation ready via TripoSR fallback` | Communicates capability before provider internals |

Avoid copy that implies structured scene command execution until that feature is actually available.

---

## 6. Design-system recommendations

### Preserve

- Deep obsidian base.
- Emerald as a brand accent.
- Monospace for measurements and diagnostics.
- Hairline borders where they clarify structure.
- A restrained professional studio tone.

### Change

- Use more opaque panel surfaces for readable working controls.
- Reduce the number of bordered cards.
- Increase default control/body type size.
- Use one primary accent for the main action.
- Make selected and active states clearer through shape, label, and contrast, not glow alone.
- Use a consistent 8/12/16/24 spacing scale.
- Give the viewport enough tonal range to show a dark generated mesh.
- Keep decorative glass and glow out of the empty state.

### Accessibility baseline

The current design token palette was checked with relative luminance calculations:

- `#f8fafc` on `#08090a`: approximately **19.05:1**.
- `#94a3b8` on `#08090a`: approximately **7.77:1**.
- `#64748b` on `#08090a`: approximately **4.19:1**.
- `#5e6ad2` on `#08090a`: approximately **4.24:1**.

W3C WCAG 2.2 requires 4.5:1 for normal text under Success Criterion 1.4.3. The muted and violet values are below that threshold on the canvas background before accounting for translucent surfaces and anti-aliasing. Small metadata text is particularly vulnerable.

Recommended fixes:

- use a brighter muted text token for normal-size instructional copy;
- reserve the existing muted token for large text or genuinely secondary metadata;
- raise the contrast of violet action labels or use a darker/lighter background pairing;
- check effective contrast against the actual translucent panel background, not only the base canvas;
- provide non-color indicators for fallback, selected, active, and error states;
- maintain visible keyboard focus rings;
- keep interactive targets comfortably clickable even when the drawer is narrow.

---

## 7. Implementation sequence

### Phase 1, core comprehension

1. Reorder the default screen around `Create 3D asset`.
2. Add the meaningful empty-state CTA in the viewport.
3. Move Terrain, voice, provider detail, audio, NPC, and advanced settings behind collapsible/contextual sections.
4. Rename ambiguous labels and remove implied unsupported behavior.
5. Make Generate 3D model the only dominant primary action.

**Acceptance:** A new user can identify what EchoForge does and start the image-to-3D flow without reading documentation.

### Phase 2, layout and editor ergonomics

1. Redesign the top bar into logical groups with a deliberate overflow menu.
2. Add project name and saved/unsaved state.
3. Add a visible scene outliner and a contextual inspector.
4. Auto-open/select the generated asset after generation.
5. Add frame-selected/reset-camera viewport controls.

**Acceptance:** After generation, the user can identify the object, select it, edit it, save it, and export it without scrolling through unrelated panels.

### Phase 3, responsive and visual quality

1. Implement width-based drawer/rail/sheet behavior.
2. Remove horizontal overflow from primary controls.
3. Increase typography and adjust contrast tokens.
4. Simplify the accent system and panel treatment.
5. Improve editor lighting/grid readability for dark meshes.

**Acceptance:** The app remains understandable at desktop, laptop, preview-pane, and narrow widths. A dark generated object is legible with default settings.

### Phase 4, efficiency and polish

1. Add contextual tooltips and shortcut help.
2. Add a command palette only after the task flow is clear.
3. Add focused `Create`, `Scene`, `Enhance`, `Environment`, and `Play` states.
4. Add visual regression screenshots at agreed viewport sizes.

**Acceptance:** Advanced users gain speed without making first-run users navigate a cockpit full of controls.

---

## 8. Validation plan after implementation

The redesign should be validated with both task completion and screenshots.

### Usability tasks

1. Start from a fresh project and identify the first action.
2. Upload a reference image.
3. Generate a 3D model.
4. Locate the generated object in the scene.
5. Change its name and transform.
6. Add a material or ambience enhancement.
7. Save, create a new project, reload, and export.
8. Find provider status without being forced to read it during creation.
9. Collapse/open the creation panel.
10. Use the app at a narrow width without clipped primary actions.

### Evidence to capture

- first-run desktop screenshot;
- asset-ready screenshot with selected model and inspector;
- scene editing screenshot with outliner and inspector;
- generation progress state;
- provider status expanded state;
- narrow-width screenshot;
- saved/reloaded project state;
- exported result reopened in a browser.

### Technical gates

- existing frontend unit tests;
- backend tests;
- Playwright journeys;
- typecheck and lint;
- production build;
- keyboard navigation and focus checks;
- contrast checks against actual rendered surfaces;
- zero browser/page errors during the real image-to-3D flow;
- visual comparison at a realistic desktop viewport, not only a narrow embedded pane.

---

## 9. Research basis

1. **Nielsen Norman Group, 10 Usability Heuristics for User Interface Design**
   https://www.nngroup.com/articles/ten-usability-heuristics/
   Applied principles: visibility of system status, user control and freedom, consistency and standards, recognition rather than recall, flexibility and efficiency, aesthetic and minimalist design, and contextual help.

2. **Nielsen Norman Group, Aesthetic and Minimalist Design**
   https://www.nngroup.com/articles/aesthetic-minimalist-design/
   Applied principle: maximize high-value signal and progressively disclose information instead of showing every potentially useful feature at once.

3. **Material Design 3, Navigation drawer guidelines**
   https://m3.material.io/components/navigation-drawer/guidelines
   Applied guidance: use permanent drawers on large screens, modal drawers at compact widths, and adapt the navigation surface to the available space.

4. **Blender Manual, Workspaces**
   https://docs.blender.org/manual/en/latest/interface/window_system/workspaces.html
   Applied pattern: separate viewport, outliner, properties, and task-specific workspaces instead of combining all functions into one undifferentiated panel.

5. **Unity Manual, Hierarchy window**
   https://docs.unity3d.com/6000.2/Documentation/Manual/Hierarchy.html
   Applied pattern: a scene hierarchy is the authoritative list of objects, with selection, visibility, grouping, and duplication accessible from the list.

6. **Unity Manual, Inspector window**
   https://docs.unity3d.com/6000.2/Documentation/Manual/UsingTheInspector.html
   Applied pattern: properties belong to the current selection and should be presented contextually rather than as a permanent list of unrelated controls.

7. **Figma Learn, Explore design files**
   https://help.figma.com/hc/en-us/articles/15297425105303-Explore-design-files
   Applied pattern: distinct regions for navigation, left organization/layers, central canvas, right properties, and toolbar. EchoForge should adopt the separation of responsibilities without copying Figma's visual style.

8. **Apple Human Interface Guidelines, Toolbars**
   https://developer.apple.com/design/human-interface-guidelines/toolbars
   Applied guidance: group toolbar items by function and frequency, avoid overcrowding, use overflow intentionally, and maintain a clear primary action.

9. **Apple Human Interface Guidelines, Sidebars**
   https://developer.apple.com/design/human-interface-guidelines/sidebars
   Applied guidance: use sidebars for meaningful navigation, allow them to hide when content needs space, and adapt their presentation to the available window size.

10. **Carbon Design System, Accordion usage**
    https://carbondesignsystem.com/components/accordion/usage
    Applied pattern: progressive disclosure is appropriate for long side panels, with concise headers, consistent disclosure controls, and collapsed secondary sections.

11. **W3C WAI, WCAG 2.2 Contrast Minimum**
    https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
    Applied requirement: 4.5:1 minimum contrast for normal text, with care for small, thin, anti-aliased text and actual rendered backgrounds.

---

## Final recommendation

Do not add more providers, more panels, or more feature badges right now. Rebuild the default composition around the one sentence a user should understand immediately:

> **Upload an image, generate a 3D model, and edit it in your scene.**

Keep terrain, voice, materials, audio, NPCs, provider diagnostics, and play mode. They are valuable. They should become context, not competition.
