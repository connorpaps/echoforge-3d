# 07. Security, Environment & Buffer Sanitization Guardrails

**Product:** EchoForge 3D  
**Security Standard:** OWASP Top 10 for Web & LLM Systems  
**Scope:** Browser Client, FastAPI Gateway, and PyTorch AI Workers

---

## 1. Threat Modeling & Mitigation Protocols

```
+----------------------------------------------------------------------------------------------------+
| Identified Threat Vectors & Architectural Mitigations                                              |
+----------------------------------------------------------------------------------------------------+
| 1. LLM Tool Injection: Malicious voice input attempting arbitrary scene code execution.           |
|    └── Mitigation: Strict JSON schema validation (AJV on client / Pydantic on backend).             |
|                                                                                                    |
| 2. Malicious 3D Buffer Overflows: Corrupted GLB/GLTF binary headers crashing WebGPU context.       |
|    └── Mitigation: Trimesh manifold validation & Draco header sanitization before Three.js load.   |
|                                                                                                    |
| 3. GPU Worker Starvation: Denial-of-Service via simultaneous heavy mesh generation requests.       |
|    └── Mitigation: Per-client IP rate limiting (slowapi) & atomic Redis queue locks.               |
|                                                                                                    |
| 4. Secret & API Key Leaks: Private Hugging Face or Supabase tokens committed to version control.   |
|    └── Mitigation: Pre-commit git-secrets scanning and runtime environment variable isolation.     |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. 3D Binary Buffer Sanitization (GLTF / GLB)

Raw mesh buffers received from generative AI models or external uploads must pass sanity checks before Three.js attempts buffer allocation:

```python
# backend/security/buffer_sanitizer.py
import trimesh
import os

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 # 50 MB
MAX_FACE_COUNT = 100000
ALLOWED_EXTENSIONS = {".glb", ".gltf"}

def sanitize_and_verify_mesh(file_path: str) -> bool:
    """Verifies that 3D file is non-malicious, under size thresholds, and structurally sound."""
    if not os.path.exists(file_path):
        raise ValueError("File does not exist")
        
    if os.path.getsize(file_path) > MAX_FILE_SIZE_BYTES:
        raise ValueError("Mesh buffer exceeds 50MB safety limit")

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Invalid 3D format: {ext}")

    try:
        mesh = trimesh.load(file_path, force='mesh')
        if len(mesh.faces) > MAX_FACE_COUNT:
            # Force auto-decimation if faces exceed limit
            mesh = mesh.simplify_quadric_decimation(face_count=25000)
            mesh.export(file_path, file_type='glb')
        return True
    except Exception as e:
        raise ValueError(f"Corrupt 3D geometry buffer: {str(e)}")
```

---

## 3. Environment Variable Security & Key Isolation

### 3.1 Rules for Environment Keys
- **Client-Side Keys (`NEXT_PUBLIC_*`):** ONLY safe public identifiers (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- **Server-Side Keys:** Kept strictly inside backend `.env` files (never prefixed with `NEXT_PUBLIC_`).
- **Never commit `.env` or `.env.local`:** `.gitignore` must strictly ignore all environment variable files.

### 3.2 Environment Template (`.env.example`)

```bash
# Frontend Environment Variables (Client Safe)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://xyzcompany.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsIn..."

# Backend Microservice Variables (Server-Only Secrets)
BACKEND_HOST="0.0.0.0"
BACKEND_PORT="8000"
HF_TOKEN="hf_your_free_serverless_token_here"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsIn..."
REDIS_URL="redis://localhost:6379/0"
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
MAX_CONCURRENT_GPU_JOBS="1"
```

---

## 4. FastAPI Gateway Security & CORS Configuration

```python
# backend/security/cors.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

def apply_security_middleware(app: FastAPI):
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Restrict CORS to trusted origins
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
```
