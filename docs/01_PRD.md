# 01. Product Requirements Document (PRD)

**Product Name:** EchoForge 3D  
**Document Version:** 1.0.0  
**Target Milestone:** MVP Release (Months 1–3)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Market Problem
Creating exploratory 3D game environments and interactive levels currently requires switching between 5+ disjointed software applications:
- 2D sketching tools (Photoshop/Krita) for elevation maps.
- 3D modeling tools (Blender/Maya) for mesh geometry and UV unwrapping.
- Texturing suites (Substance Designer) for PBR texture channels.
- Digital Audio Workstations (DAWs) for Foley and loop generation.
- Game Engines (Unity/Unreal/Godot) for scene assembly, collision authoring, and character scripting.

This creates an intense iteration bottleneck for indie developers, game designers, and technical artists. Evaluating the mood, scale, lighting, and spatial feel of a concept takes days or weeks.

### 1.2 The EchoForge Solution
EchoForge 3D provides a unified **canvas-to-engine loop** directly in the browser:
1. The user sketches elevation contours on a 2D topographic canvas.
2. The user dictates natural language scene modifications via microphone (*"Place three mossy stone monoliths around a glowing campfire on top of that hill"*).
3. The system parses spatial commands, generates watertight 3D meshes with colliders, synthesizes 3D spatial audio emitters, and renders the environment in a 60 FPS WebGPU Three.js scene.
4. The user presses `Tab` to enter a first-person controller mode, navigating the world with WASD locomotion, hearing positional sound, and conversing with vision-aware NPCs.

---

## 2. Target User Personas

| Persona | Role | Primary Need | Core Pain Point |
| :--- | :--- | :--- | :--- |
| **Alex (Solo Indie Developer)** | Solo Game Creator | Rapidly prototyping atmospheric 3D game spaces for game jams and pitches. | Spending 80% of development time modeling basic props and baking colliders instead of gameplay. |
| **Maya (Technical Level Designer)** | Studio Level Artist | Testing spatial scale, player sightlines, and audio ambiance before committing to high-poly assets. | Multi-hour export/import cycles between Blender and Unreal Engine. |
| **Liam (3D Web Engineer)** | Frontend Developer | Building interactive WebGPU browser experiences with spatial audio and physics. | High barrier to entry in orchestrating multimodal AI models with WebGL/Three.js. |

---

## 3. Prioritized Feature Scope Matrix

### 3.1 P0: MVP Core (Months 1–3) — Mandatory
- **2D Topographic Canvas:** HTML5 drawing canvas with radial falloff elevation brushes, converting luminance into 3D heightfield displacement in real time.
- **Voice-to-Scene Dictation:** Browser-based speech transcription (<150ms) via Distil-Whisper WebGPU, converted to structured JSON tool calls by Qwen2.5-Coder.
- **Automated 3D Asset Synthesis:** Single-image-to-3D mesh generation (TripoSR / TRELLIS) with automated decimation (<25k faces) and collision hull authoring.
- **In-Browser 3D Viewport:** Three.js / WebGPU renderer with TSL shaders, dynamic lighting, and Rapier3D Wasm character physics.
- **Positional 3D Audio:** Web Audio API HRTF spatial panner nodes bound to 3D scene objects with AudioGen synthesized environmental loops.
- **Vision-Reactive NPC:** SmolVLM-powered agent that inspects player viewport canvas frames and responds via in-browser Kokoro-82M neural TTS voice.
- **Universal Scene Export:** One-click export to standalone Three.js HTML bundles and standard Godot/Unity `.gltf` scenes.

### 3.2 P1: Post-MVP Enhancements
- **Multi-Asset Scatter Brushes:** Procedural foliage and rock scattering along terrain slope thresholds.
- **Dynamic Sky & Weather Controls:** Procedural volumetric fog, time-of-day sunlight orbits, and rain particle systems.
- **Multiplayer Co-Creation:** Real-time multi-user cursor sync via WebRTC data channels.

### 3.3 P2: Future Roadmap
- **Skeletal Rigging & Animation:** Automated humanoid rig generation and retargeting for generated NPC meshes.
- **Custom LoRA Fine-Tuning:** In-editor texture style LoRA training on uploaded art reference packs.

---

## 4. Explicit Non-Goals / Out-of-Scope (MVP)

- **No Real-Time MMO Networking:** MVP is single-user local/browser creation only.
- **No Manual UV Unwrapping Tools:** The system handles automated UV projection and PBR baking; no manual UV vertex editing is provided.
- **No Closed/Paid Proprietary APIs:** The entire pipeline must function on open-weight models without mandatory subscription dependencies (Midjourney, OpenAI, Higgsfield).

---

## 5. Measurable Success Metrics & Acceptance Criteria

| Metric | Target Standard | Verification Method |
| :--- | :--- | :--- |
| **Viewport Frame Rate** | $\ge 60\text{ FPS}$ sustained on baseline hardware | Three.js stats monitor during first-person locomotion. |
| **Client Voice-to-Intent Latency** | $< 250\text{ ms}$ total roundtrip | Timestamp logging between mic release and JSON dispatch. |
| **3D Asset Generation Turnaround** | $< 4.5\text{ seconds}$ per prop | Backend execution duration from prompt to `.glb` download. |
| **Local GPU VRAM Peak** | $< 6.0\text{ GB}$ VRAM allocation | PyTorch `torch.cuda.max_memory_allocated()` audit. |
| **Client-Side Bundle Size** | $< 15\text{ MB}$ initial JS bundle | Next.js production build analyzer. |
