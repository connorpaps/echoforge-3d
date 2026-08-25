# 04. Network API Contracts & LLM Tool Schemas

**Product:** EchoForge 3D  
**Protocol Version:** 1.2.0 (Audited & Synced)  
**Transport Layers:** REST (HTTP/2), WebSockets, and Structured JSON Schema Tool Calls

---

## 1. REST Endpoints (FastAPI Backend Gateway)

### 1.1 Generate 3D Mesh
- **Endpoint:** `POST /api/v1/generate/mesh`
- **Request Body (JSON):**
  ```json
  {
    "prompt": "weathered ancient stone pillar with glowing runes",
    "image_base64": "optional_base64_concept_string",
    "target_face_count": 20000,
    "bake_convex_hull": true
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "asset_id": "mesh_9f8a7c2b",
    "glb_url": "/static/assets/mesh_9f8a7c2b.glb",
    "polygon_count": 18450,
    "bounding_box": {
      "min": [-1.2, 0.0, -1.2],
      "max": [1.2, 4.5, 1.2],
      "dimensions": [2.4, 4.5, 2.4]
    },
    "collider_hull_vertices": 32,
    "execution_time_seconds": 1.48
  }
  ```

---

### 1.2 Generate Tileable Texture
- **Endpoint:** `POST /api/v1/generate/texture`
- **Request Body (JSON):**
  ```json
  {
    "prompt": "mossy cracked cobblestone path",
    "channels": ["diffuse", "normal", "roughness"],
    "resolution": 1024
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "texture_id": "tex_3e4d5a6b",
    "diffuse_url": "/static/textures/tex_3e4d5a6b_diffuse.webp",
    "normal_url": "/static/textures/tex_3e4d5a6b_normal.webp",
    "roughness_url": "/static/textures/tex_3e4d5a6b_roughness.webp"
  }
  ```

---

### 1.3 Generate Spatial Audio Loop
- **Endpoint:** `POST /api/v1/generate/audio`
- **Request Body (JSON):**
  ```json
  {
    "prompt": "crackling forest campfire with gentle wind gusts",
    "duration_seconds": 10.0,
    "loopable": true
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "audio_id": "audio_1b2c3d4e",
    "wav_url": "/static/audio/audio_1b2c3d4e.wav",
    "duration": 10.0,
    "sample_rate": 44100,
    "channels": 2
  }
  ```

---

### 1.4 NPC Viewport Visual Inspection (SmolVLM)
- **Endpoint:** `POST /api/v1/npc/dialogue`
- **Request Body (JSON):**
  ```json
  {
    "npc_id": "npc_ancient_guardian",
    "system_prompt": "You are a mystical guardian of forgotten ruins.",
    "viewport_frame_base64": "data:image/jpeg;base64,...",
    "player_speech_text": "What do you know about this sanctuary?"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "dialogue_text": "I see you have rekindled the bonfire amidst the stone monoliths. The old spirits welcome your presence.",
    "detected_objects": ["stone monolith", "bonfire", "grassy hill"],
    "tts_recommended_voice": "af_heart"
  }
  ```

---

## 2. WebSocket Real-Time Progress Stream

- **Endpoint:** `WS /ws/v1/generation-feed`
- **Client Handshake:** Authenticate with `project_id` and `client_uuid`.
- **Server Event Payloads:**

```json
{
  "event": "JOB_PROGRESS",
  "job_id": "job_88a99b",
  "stage": "DIFFUSION_CONCEPT",
  "percent": 35,
  "message": "Synthesizing texture reference via SDXL-Turbo..."
}
```

```json
{
  "event": "JOB_PROGRESS",
  "job_id": "job_88a99b",
  "stage": "MESH_DECIMATION",
  "percent": 85,
  "message": "Decimating polygon count to 18,500 faces..."
}
```

```json
{
  "event": "JOB_COMPLETE",
  "job_id": "job_88a99b",
  "payload": {
    "type": "SPAWN_3D_ASSET",
    "glb_url": "/static/assets/mesh_9f8a7c2b.glb",
    "audio_url": "/static/audio/audio_1b2c3d4e.wav"
  }
}
```

---

## 3. Structured LLM Tool-Calling JSON Schema

The Qwen2.5-Coder model transforms raw voice transcripts into this strict schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EchoForgeSceneDelta",
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["spawn_asset", "batch_scatter", "modify_lighting", "create_audio_emitter", "spawn_npc"]
    },
    "parameters": {
      "type": "object",
      "properties": {
        "prompt": { "type": "string" },
        "category": { "type": "string", "enum": ["prop", "foliage", "structure", "creature", "npc"] },
        "transform": {
          "type": "object",
          "properties": {
            "position": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
            "rotation": { "type": "array", "items": { "type": "number" }, "minItems": 3, "maxItems": 3 },
            "scale": { "type": "number", "default": 1.0 }
          },
          "required": ["position"]
        },
        "audio": {
          "type": "object",
          "properties": {
            "ambient_prompt": { "type": "string" },
            "volume": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
            "falloff_distance": { "type": "number", "default": 15.0 }
          }
        },
        "physics": {
          "type": "object",
          "properties": {
            "collider_type": { "type": "string", "enum": ["convex_hull", "trimesh", "cuboid", "none"] },
            "mass": { "type": "number", "default": 0.0 }
          }
        }
      },
      "required": ["prompt", "transform"]
    }
  },
  "required": ["action", "parameters"]
}
```
