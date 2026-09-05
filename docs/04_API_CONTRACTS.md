# 04. API Contracts, WebSockets & Tool Calling Schemas

**Product:** EchoForge 3D  
**Specification Version:** 1.2.0 (Audited & Production-Hardened)  
**Governing Skills:** `everything-claude-code/api-design`, `pytorch/pytorch`

---

## 1. REST Endpoints Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 REST API Endpoint Matrix                               │
├─────────────────────────┬────────┬────────────────────────────┬────────────────────────┤
│ Endpoint                │ Method │ Request Payload            │ Response Payload       │
├─────────────────────────┼────────┼────────────────────────────┼────────────────────────┤
│ `/api/v1/generate-mesh`  │ POST   │ `{ prompt, imageBase64 }`  │ `{ glbUrl, bounds }`   │
│ `/api/v1/generate-audio` │ POST   │ `{ prompt, durationSec }`  │ Binary `.wav` Stream   │
│ `/api/v1/npc-dialogue`   │ POST   │ `{ frameBase64, persona }` │ `{ dialogueText }`     │
│ `/health`               │ GET    │ None                       │ `{ status, vramMB }`   │
└─────────────────────────┴────────┴────────────────────────────┴────────────────────────┘
```

---

## 2. Prompt-assisted generation (not a voice command parser)

Voice input is push-to-talk transcription that feeds the existing natural-language
prompt and generation flow. EchoForge does **not** currently guarantee a
deterministic structured-command parse from speech. The schema below documents
an integration contract for clients that already produce scene deltas; it is
not a claim that the voice pill emits these operations directly.

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
        "category": {
          "type": "string",
          "enum": ["prop", "foliage", "structure", "creature", "npc"]
        },
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
            "volume": { "type": "number", "minimum": 0.0, "maximum": 1.0, "default": 0.8 },
            "falloff_distance": { "type": "number", "default": 15.0 }
          }
        },
        "npc_dialogue": {
          "type": "object",
          "properties": {
            "persona": { "type": "string" },
            "voice_name": { "type": "string", "default": "af_heart" }
          }
        },
        "physics": {
          "type": "object",
          "properties": {
            "collider_type": { "type": "string", "enum": ["convexHull", "trimesh", "cuboid", "none"] },
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
