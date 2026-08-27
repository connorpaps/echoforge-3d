"""Shared pytest fixtures for the EchoForge backend.

GPU-heavy paths (model loading/inference) are never exercised by unit tests —
the VRAM manager's ``run`` and the model services are patched with lightweight
fakes. The VRAM manager itself is exercised directly with tiny CUDA tensors
when a GPU is present and falls back to pure-serialization assertions
otherwise.
"""

from __future__ import annotations

import asyncio
import io
import os
import sys
from pathlib import Path

import numpy as np
import pytest
import trimesh

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Pin the HF cache to the project-local directory (no accidental downloads
# into the user's home).
os.environ.setdefault("HF_HOME", str(BACKEND_DIR.parent / ".hf-cache"))


@pytest.fixture(autouse=True)
def _fresh_progress_bus():
    """Reset the singleton ProgressBus between tests.

    The bus binds its event loop on first subscribe; each TestClient runs the
    app on its own loop, so a bus left bound to an earlier test's loop would
    publish to the dead loop and the next WebSocket test would hang waiting
    for events that never arrive.
    """
    from backend.services.progress_bus import progress_bus

    progress_bus._loop = None
    progress_bus._subscribers.clear()
    yield


def _fake_mesh() -> trimesh.Trimesh:
    """A small vertex-colored test mesh that survives the pipeline."""
    mesh = trimesh.creation.icosphere(subdivisions=3)
    colors = np.zeros((len(mesh.vertices), 4), dtype=np.uint8)
    colors[:, 0] = np.linspace(0, 255, len(mesh.vertices))  # red gradient
    colors[:, 3] = 255
    mesh.visual.vertex_colors = colors
    return mesh


def _fake_png() -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), (30, 144, 90)).save(buffer, format="PNG")
    return buffer.getvalue()


class _FakeModel:
    """Stand-in model object accepted by patched service functions."""

    def __call__(self, *args, **kwargs):
        raise AssertionError("fake model should never be invoked directly")


@pytest.fixture()
def fake_run(monkeypatch):
    """Patch the VRAM manager so generation tests never touch CUDA/models."""

    async def fake_run_impl(slot_name, func, *args, **kwargs):
        return await asyncio.to_thread(func, _FakeModel(), *args, **kwargs)

    from backend.services.vram_manager import vram_manager

    monkeypatch.setattr(vram_manager, "run", fake_run_impl)
    return fake_run_impl


@pytest.fixture()
def client(fake_run, monkeypatch):
    """FastAPI TestClient with GPU seams patched to deterministic fakes."""
    from fastapi.testclient import TestClient

    from backend.main import create_app
    from backend.services import sdxl_service, tsr_service

    app = create_app()

    monkeypatch.setattr(
        tsr_service.tsr_service,
        "extract",
        lambda model, image_bytes, resolution=256, progress=None: _fake_mesh(),
    )
    monkeypatch.setattr(
        sdxl_service.sdxl_service,
        "generate",
        lambda pipe, prompt, steps=1, guidance_scale=0.0, seed=None, size=512, progress=None: _fake_png(),
    )

    with TestClient(app) as test_client:
        yield test_client
