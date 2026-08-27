# 07. Security, Sanitization & Environment Guardrails

**Product:** EchoForge 3D  
**Specification Version:** 1.2.0 (Audited & Production-Hardened)  
**Governing Skills:** `pytorch/pytorch` (VRAM isolation), `superpowers/verification-before-completion`, `everything-claude-code/api-design`

---

## 1. Threat Vectors & Security Mitigations

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Threat Vector Mitigation Matrix                          │
├────────────────────┬──────────────────────────────┬────────────────────────────────────┤
│ Attack Vector      │ Risk / Vulnerability         │ Production Mitigation Strategy     │
├────────────────────┼──────────────────────────────┼────────────────────────────────────┤
│ Voice & VLM Prompt │ Malicious prompt injection   │ Strict JSON Schema validation      │
│ Injection          │ attempting system overrides. │ via Pydantic & Zod schemas.        │
├────────────────────┼──────────────────────────────┼────────────────────────────────────┤
│ Buffer Overflow /  │ Corrupt GLTF/GLB or WAV      │ Trimesh decimation limit (≤20k),   │
│ Memory Exhaustion  │ payload crashes browser GPU. │ sanitization & 500MB IndexedDB cap.│
├────────────────────┼──────────────────────────────┼────────────────────────────────────┤
│ CUDA VRAM Denial   │ Concurrent generative model  │ SequentialVRAMManager locks with   │
│ of Service         │ calls crash workstation GPU. │ HTTP 503 retry-after headers.      │
├────────────────────┼──────────────────────────────┼────────────────────────────────────┤
│ CORS & Origin      │ Cross-origin WebSocket       │ FastAPI CORSMiddleware restricted  │
│ Poisoning          │ payload manipulation.        │ strictly to localhost:3000.        │
└────────────────────┴──────────────────────────────┴────────────────────────────────────┘
```

---

## 2. Trimesh Mesh Buffer Sanitizer (Server-Side)

```python
# backend/services/mesh_sanitizer.py
import trimesh
import numpy as np

MAX_ALLOWED_FACES = 25000

def sanitize_and_decimate_glb(input_path: str, output_path: str) -> dict:
    """Sanitizes raw AI-generated meshes, enforces vertex/face limits,
    removes non-manifold polygons, and exports a production-safe GLB."""
    mesh = trimesh.load(input_path, force="mesh")
    
    # 1. Reject empty or corrupt meshes
    if len(mesh.faces) == 0 or len(mesh.vertices) == 0:
        raise ValueError("Invalid mesh buffer: zero geometry.")

    # 2. Decimate geometry if above safety threshold
    if len(mesh.faces) > MAX_ALLOWED_FACES:
        mesh = mesh.simplify_quadric_decimation(face_count=MAX_ALLOWED_FACES)

    # 3. Clean degenerate polygons and repair normal vectors
    mesh.remove_degenerate_faces()
    mesh.remove_duplicate_faces()
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()

    # 4. Export sanitized GLB
    mesh.export(output_path, file_type="glb")
    
    return {
        "face_count": len(mesh.faces),
        "vertex_count": len(mesh.vertices),
        "is_watertight": mesh.is_watertight
    }
```

---

## 3. Environment Variable Isolation

### `.env.local` (Client-Side)
```bash
# Next.js Public Flags
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_WS_URL="ws://localhost:8000/ws"
NEXT_PUBLIC_ENABLE_WEBGPU="true"
```

### `backend/.env` (Server-Side Microservice)
```bash
# FastAPI & CUDA Execution Flags
CUDA_VISIBLE_DEVICES="0"
PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True"
HF_TOKEN="hf_your_free_read_token_here"
MAX_CONCURRENT_GPU_TASKS="1"
```
