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

# rembg (U²-Net) background-removal weights must also stay off the C: drive
# (knowledge.md: "keep big downloads on G:"). rembg honors U2NET_HOME.
U2NET_HOME = Path(
    os.environ.get("U2NET_HOME", str(HF_HOME / "u2net"))
).resolve()
os.environ.setdefault("U2NET_HOME", str(U2NET_HOME))

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

# Optional quality-upgrade provider. ``auto`` uses the local Hunyuan3D-2GP
# sidecar when it is healthy and falls back to TripoSR when it is absent.
MESH_BACKEND = os.environ.get("ECHOFORGE_MESH_BACKEND", "auto").lower()
if MESH_BACKEND not in {"auto", "triposr", "hunyuan"}:
    raise ValueError(
        "ECHOFORGE_MESH_BACKEND must be one of: auto, triposr, hunyuan"
    )
HUNYUAN_SIDECAR_URL = os.environ.get("HUNYUAN_SIDECAR_URL", "http://127.0.0.1:8081")
HUNYUAN_TIMEOUT_S = float(os.environ.get("HUNYUAN_TIMEOUT_S", "900"))

SDXL_REPO_ID = os.environ.get("SDXL_REPO_ID", "stabilityai/sdxl-turbo")
SMOLVLM_REPO_ID = os.environ.get("SMOLVLM_REPO_ID", "HuggingFaceTB/SmolVLM-Instruct")
SDXL_VARIANT = "fp16"


# --- VRAM safety ------------------------------------------------------------

# SequentialVRAMManager invariants (docs/08_TASKS.md Task 2.2 / AGENTS.md #3):
# never keep more than one heavy model resident; keep peak reservation under
# the configured ceiling.
MAX_CONCURRENT_GPU_TASKS = int(os.environ.get("MAX_CONCURRENT_GPU_TASKS", "1"))
VRAM_LIMIT_GB = float(os.environ.get("VRAM_LIMIT_GB", "6.0"))
assert MAX_CONCURRENT_GPU_TASKS == 1, "EchoForge 3D only supports a single serial GPU worker (VRAM safety invariant)."

# Per-slot hard deadline (seconds) for GPU inference. A hung CUDA kernel
# (driver deadlock) can't be cancelled from Python — asyncio.wait_for leaves
# the worker thread burning the GPU and torch won't interrupt a wedged
# kernel. The only reliable release is process exit, so the GpuWatchdog in
# vram_manager.py force-exits the backend when a job exceeds its slot's
# deadline. This bounds the blast radius: a stuck model can never peg the
# host GPU forever. Set GPU_JOB_TIMEOUT_S=0 to disable entirely.
GPU_JOB_TIMEOUT_S = int(os.environ.get("GPU_JOB_TIMEOUT_S", "300"))
GPU_SLOT_TIMEOUT_S: dict[str, int] = {
    "triposr": int(os.environ.get("GPU_TIMEOUT_TRIPOSR", "300")),
    "hunyuan": int(os.environ.get("GPU_TIMEOUT_HUNYUAN", "900")),
    "sdxl-turbo": int(os.environ.get("GPU_TIMEOUT_SDXL", "120")),
    # AudioGen 1.5B is autoregressive (~50 lm steps/sec of audio); a 10 s
    # clip can take minutes on an 8 GB card, so allow a wide window.
    "audiogen": int(os.environ.get("GPU_TIMEOUT_AUDIOGEN", "420")),
    "smolvlm": int(os.environ.get("GPU_TIMEOUT_SMOLVLM", "120")),
}


# --- API -------------------------------------------------------------------

API_V1_PREFIX = "/api/v1"
GENERATION_RATE_LIMIT = os.environ.get("ECHOFORGE_GENERATION_RATE_LIMIT", "10/minute")
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

# Generation defaults. Mesh resolution defaults to 256 for better detail on
# organic subjects (faces etc.) — TripoSR's official 256³ extraction is
# ~2.3× slower than 192³ on 8 GB cards (density+colour queries over 16.7M
# voxels). Drop back to 192 via MESH_RESOLUTION if generation feels too slow.
MESH_RESOLUTION = int(os.environ.get("MESH_RESOLUTION", "256"))
# Preserve the established application processing cap. This remains below the
# broader raw-output safety ceiling documented in AGENTS.md.
MESH_FACE_CAP = 20_000
MESH_MAX_FACES = int(os.environ.get("MESH_MAX_FACES", "20000"))
if not 500 <= MESH_MAX_FACES <= MESH_FACE_CAP:
    raise ValueError(f"MESH_MAX_FACES must be between 500 and {MESH_FACE_CAP}")
SDXL_STEPS = int(os.environ.get("SDXL_STEPS", "1"))
SDXL_GUIDANCE = float(os.environ.get("SDXL_GUIDANCE", "0.0"))
SDXL_SIZE = int(os.environ.get("SDXL_SIZE", "512"))

# --- Audio (AudioGen / procedural fallback) ---------------------------------

AUDIOGEN_REPO_ID = os.environ.get("AUDIOGEN_REPO_ID", "facebook/audiogen-medium")
AUDIO_SAMPLE_RATE = int(os.environ.get("AUDIO_SAMPLE_RATE", "16000"))
AUDIO_DURATION_DEFAULT = float(os.environ.get("AUDIO_DURATION_DEFAULT", "10"))
MAX_AUDIO_SECONDS = float(os.environ.get("MAX_AUDIO_SECONDS", "30"))

# Input guardrails
MAX_IMAGE_BYTES = int(os.environ.get("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))  # 10 MiB
MAX_IMAGE_PIXELS = int(os.environ.get("MAX_IMAGE_PIXELS", str(16 * 1024 * 1024)))
MAX_IMAGE_DIMENSION = int(os.environ.get("MAX_IMAGE_DIMENSION", "8192"))
MAX_PROMPT_CHARS = int(os.environ.get("MAX_PROMPT_CHARS", "2000"))
