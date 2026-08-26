"""EchoForge 3D — backend runtime configuration.

All values can be overridden via environment variables (see backend/.env.example).
Defaults match the local development setup documented in docs/03_TECH_SPEC.md.
"""

from __future__ import annotations

import os
from pathlib import Path

import torch

# --- Paths ----------------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# Keep model weights on the project drive (local .hf-cache), matching the
# pre-caching script in backend/scripts/download_models.py.
HF_HOME = Path(
    os.environ.get("HF_HOME", str(PROJECT_ROOT / ".hf-cache"))
).resolve()
os.environ.setdefault("HF_HOME", str(HF_HOME))

# Vendored third-party packages (see backend/vendor/README.md).
VENDOR_DIR = BACKEND_DIR / "vendor"


# --- CUDA / device ---------------------------------------------------------

DEVICE = os.environ.get("ECHOFORGE_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
CUDA_AVAILABLE = torch.cuda.is_available()
CUDA_DEVICE_ID = int(os.environ.get("CUDA_VISIBLE_DEVICES", "0").split(",")[0]) if CUDA_AVAILABLE else 0

# FP16 everywhere per docs/03_TECH_SPEC.md (CUDA FP16 execution).
TORCH_DTYPE = torch.float16 if CUDA_AVAILABLE else torch.float32


# --- Model repositories -----------------------------------------------------

TRIPOSR_REPO_ID = os.environ.get("TRIPOSR_REPO_ID", "stabilityai/TripoSR")
TRIPOSR_CONFIG_NAME = "config.yaml"
TRIPOSR_WEIGHTS_NAME = "model.ckpt"

SDXL_REPO_ID = os.environ.get("SDXL_REPO_ID", "stabilityai/sdxl-turbo")
SDXL_VARIANT = "fp16"


# --- VRAM safety ------------------------------------------------------------

# SequentialVRAMManager invariants (docs/08_TASKS.md Task 2.2 / AGENTS.md #3):
# never keep more than one heavy model resident; keep peak reservation under
# the configured ceiling.
MAX_CONCURRENT_GPU_TASKS = int(os.environ.get("MAX_CONCURRENT_GPU_TASKS", "1"))
VRAM_LIMIT_GB = float(os.environ.get("VRAM_LIMIT_GB", "6.0"))
assert MAX_CONCURRENT_GPU_TASKS == 1, "EchoForge 3D only supports a single serial GPU worker (VRAM safety invariant)."


# --- API -------------------------------------------------------------------

API_V1_PREFIX = "/api/v1"
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

# Generation defaults. Mesh resolution defaults to 192: TripoSR's official
# 256³ extraction is expensive on 8 GB cards (density+colour queries over 16.7M
# voxels); 192³ is ~2.3× cheaper with visually equivalent results after
# decimation to <= MESH_MAX_FACES.
MESH_RESOLUTION = int(os.environ.get("MESH_RESOLUTION", "192"))
MESH_MAX_FACES = int(os.environ.get("MESH_MAX_FACES", "20000"))
SDXL_STEPS = int(os.environ.get("SDXL_STEPS", "1"))
SDXL_GUIDANCE = float(os.environ.get("SDXL_GUIDANCE", "0.0"))
SDXL_SIZE = int(os.environ.get("SDXL_SIZE", "512"))

# Input guardrails
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))  # 10 MiB
MAX_PROMPT_CHARS = int(os.environ.get("MAX_PROMPT_CHARS", "2000"))
