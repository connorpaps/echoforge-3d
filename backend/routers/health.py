"""GET /health — CUDA device + VRAM snapshot (docs/08_TASKS.md Task 2.1)."""

from __future__ import annotations

from fastapi import APIRouter

from ..services.vram_manager import vram_manager

router = APIRouter(tags=["health"])


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
    }
