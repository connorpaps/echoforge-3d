"""POST /api/v1/generate-mesh + /api/v1/generate-texture + /ws/progress.

The GPU seams are patched in conftest (fake VRAM run + fake services), so
these tests verify the *server* contract end to end: request validation,
progress events, GLB/png packaging, and error handling.
"""

from __future__ import annotations

import base64
import io

import numpy as np
import pytest
from PIL import Image
import trimesh

from backend.services.mesh_processing import validate_glb


def _data_url_image() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (120, 40, 200)).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# --- generate-mesh --------------------------------------------------------------


def test_generate_mesh_returns_valid_glb(client):
    response = client.post(
        "/api/v1/generate-mesh",
        json={"prompt": "a red knight statue", "imageBase64": _data_url_image()},
    )
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["glbUrl"].startswith("data:model/gltf-binary;base64,")
    glb = base64.b64decode(body["glbUrl"].split(",", 1)[1])
    assert validate_glb(glb)

    assert body["faceCount"] > 0
    assert body["vertexCount"] > 0
    assert body["glbSizeBytes"] > 0
    assert body["elapsedMs"] >= 0
    assert set(body["bounds"]) == {"min", "max", "center", "size"}
    assert len(body["bounds"]["min"]) == 3


def test_generate_mesh_accepts_plain_base64(client):
    raw_bytes = base64.b64decode(_data_url_image().split(",", 1)[1])
    response = client.post(
        "/api/v1/generate-mesh",
        json={"imageBase64": base64.b64encode(raw_bytes).decode("ascii")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["faceCount"] > 0


def test_generate_mesh_rejects_invalid_image(client):
    response = client.post(
        "/api/v1/generate-mesh",
        json={"imageBase64": "not-valid-base64!!!"},
    )
    assert response.status_code == 400


def test_generate_mesh_requires_image(client):
    response = client.post("/api/v1/generate-mesh", json={"prompt": "no image"})
    assert response.status_code == 422  # pydantic validation


def test_generate_mesh_rejects_out_of_range_resolution(client):
    response = client.post(
        "/api/v1/generate-mesh",
        json={"imageBase64": _data_url_image(), "resolution": 1024},
    )
    assert response.status_code == 422


def test_generate_mesh_auto_selects_hunyuan_when_sidecar_is_healthy(client, monkeypatch):
    """The quality provider is selected by health without changing the API contract."""
    from backend.routers import generate
    from backend.services import hunyuan_service

    called = {"value": False}
    monkeypatch.setattr(generate, "MESH_BACKEND", "auto")
    monkeypatch.setattr(hunyuan_service.hunyuan_service, "is_available", lambda: True)

    def fake_extract(model, image_bytes, resolution=192, progress=None):
        called["value"] = True
        return trimesh.creation.icosphere(subdivisions=2)

    monkeypatch.setattr(hunyuan_service.hunyuan_service, "extract", fake_extract)
    response = client.post(
        "/api/v1/generate-mesh",
        json={"imageBase64": _data_url_image()},
    )

    assert response.status_code == 200, response.text
    assert called["value"] is True


# --- generate-texture ------------------------------------------------------------


def test_generate_texture_returns_png(client):
    response = client.post(
        "/api/v1/generate-texture",
        json={"prompt": "ancient stone castle at dusk"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    png = base64.b64decode(body["imageBase64"])
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    assert body["seed"] is None
    assert body["elapsedMs"] >= 0


def test_generate_texture_echoes_seed(client):
    response = client.post(
        "/api/v1/generate-texture",
        json={"prompt": "misty forest", "seed": 12345},
    )
    assert response.status_code == 200
    assert response.json()["seed"] == 12345


def test_generate_texture_requires_prompt(client):
    response = client.post("/api/v1/generate-texture", json={"prompt": ""})
    assert response.status_code == 422


# --- WebSocket progress channel ---------------------------------------------------


def test_ws_progress_streams_ticks(client):
    """docs/08_TASKS.md Task 2.5: frontend sees live RECONSTRUCTION ticks."""
    from fastapi.testclient import TestClient

    with client.websocket_connect("/ws/progress") as ws:
        response = client.post(
            "/api/v1/generate-mesh",
            json={"prompt": "test", "imageBase64": _data_url_image()},
        )
        assert response.status_code == 200
        job_id = response.json()["jobId"]

        seen: list[dict] = []
        for _ in range(60):  # generous cap; pipeline emits several events
            event = ws.receive_json()
            if event.get("jobId") != job_id:
                continue
            seen.append(event)
            if event["stage"] == "DONE":
                break

        stages = [e["stage"] for e in seen]
        assert "RECONSTRUCTION" in stages
        assert stages[-1] == "DONE"
        assert all(0 <= e["percent"] <= 100 for e in seen)
