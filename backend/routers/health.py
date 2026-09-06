"""GET /health — CUDA device + VRAM snapshot (docs/08_TASKS.md Task 2.1)."""

from __future__ import annotations

from fastapi import APIRouter

from ..config import MESH_BACKEND
from ..services.hunyuan_service import hunyuan_service
from ..services.vram_manager import vram_manager

router = APIRouter(tags=["health"])


def provider_status() -> dict:
    """Describe provider modes without importing or loading model weights."""
    hunyuan_available = hunyuan_service.is_available()
    mesh_selected = "hunyuan3d-2gp" if hunyuan_available and MESH_BACKEND in {"auto", "hunyuan"} else "triposr"
    return {
        "mesh": {
            "configured": MESH_BACKEND,
            "selected": mesh_selected,
            "hunyuan": {"available": hunyuan_available, "mode": "primary"},
            "triposr": {"mode": "fallback"},
        },
        "texture": {"provider": "sdxl-turbo", "mode": "optional"},
        "audio": {"provider": "audiogen", "fallback": "procedural", "mode": "optional"},
        "dialogue": {"provider": "smolvlm", "fallback": "canned", "mode": "optional"},
        "speech": {"provider": "whisper-small.en", "mode": "browser-worker"},
        "tts": {"provider": "kokoro", "mode": "browser-worker"},
        "depth": {"provider": "depth-anything-v2-small", "mode": "browser-worker"},
    }


@router.get("/health")
def health() -> dict:
    """Return service status and live VRAM allocation.

    Contract (docs/04_API_CONTRACTS.md): ``{ status, vramMB }`` plus a
    ``cuda`` detail block for the frontend VRAM meter.
    """
    status = vram_manager.vram_status_mb()
    return {
        "status": "ok",
        "vramMB": status["vramReservedMB"],
        "cuda": status,
        "providers": provider_status(),
    }
