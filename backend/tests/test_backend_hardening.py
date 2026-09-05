from __future__ import annotations

import base64
import io
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from PIL import Image

from backend.routers.generate import GenerateMeshRequest
from backend.services import image_utils
from backend.services.hunyuan_service import HunyuanSidecarUnavailable
from backend.services.smolvlm_service import _decode_frame


def _png(size: tuple[int, int]) -> str:
    buf = io.BytesIO()
    Image.new("RGB", size, "red").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_mesh_request_enforces_documented_face_cap():
    with pytest.raises(Exception):
        GenerateMeshRequest(imageBase64=_png((8, 8)), maxFaces=25001)


def test_decode_image_rejects_excessive_pixel_count_before_loading(monkeypatch):
    monkeypatch.setattr(image_utils, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(image_utils.ImageDecodeError, match="dimensions"):
        image_utils.decode_image(_png((11, 10)))


def test_npc_frame_decoder_uses_shared_image_limits(monkeypatch):
    monkeypatch.setattr(image_utils, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(image_utils.ImageDecodeError, match="dimensions"):
        _decode_frame(_png((11, 10)))


def test_auto_mesh_generation_retries_triposr_when_hunyuan_drops(monkeypatch):
    from backend.routers import generate

    monkeypatch.setattr(generate, "MESH_BACKEND", "auto")
    monkeypatch.setattr(generate.hunyuan_service.hunyuan_service, "is_available", lambda: True)
    calls: list[str] = []

    async def fake_run(slot, func, *args, **kwargs):
        calls.append(slot)
        if slot == "hunyuan":
            raise HunyuanSidecarUnavailable("sidecar down")
        return {"vertices": [], "faces": []}

    monkeypatch.setattr(generate.vram_manager, "run", fake_run)
    with pytest.raises(HTTPException) as caught:
        import asyncio
        asyncio.run(generate.generate_mesh(GenerateMeshRequest(imageBase64=_png((8, 8)))))
    assert calls == ["hunyuan", "triposr"]
    assert caught.value.status_code == 500
    assert caught.value.detail == "mesh generation failed"


def test_generation_errors_do_not_expose_exception_text(client, monkeypatch):
    from backend.routers import generate

    async def fail(*args, **kwargs):
        raise RuntimeError("secret internal path")

    monkeypatch.setattr(generate.vram_manager, "run", fail)
    response = client.post("/api/v1/generate-texture", json={"prompt": "x"})
    assert response.status_code == 500
    assert response.json()["detail"] == "texture generation failed"
    assert "secret internal path" not in response.text


def test_raw_triposr_decoder_uses_shared_image_limits(monkeypatch):
    from backend.services import tsr_service

    monkeypatch.setattr(image_utils, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(image_utils.ImageDecodeError, match="dimensions"):
        tsr_service._decode(base64.b64decode(_png((11, 10))))


def test_mesh_processing_rejects_faces_above_global_cap():
    import trimesh
    from backend.services.mesh_processing import process_mesh

    with pytest.raises(ValueError, match="max_faces"):
        process_mesh(trimesh.creation.box(), max_faces=25001)


def test_invalid_mesh_backend_configuration_fails_fast():
    env = os.environ.copy()
    env["ECHOFORGE_MESH_BACKEND"] = "typo"
    repo = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "-c", "import backend.config"],
        cwd=repo,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "ECHOFORGE_MESH_BACKEND" in result.stderr


def test_expensive_generation_routes_are_rate_limited(client):
    responses = [
        client.post("/api/v1/generate-texture", json={"prompt": "x"})
        for _ in range(11)
    ]

    assert responses[-1].status_code == 429
    assert "rate limit" in responses[-1].json()["error"].lower()


def test_progress_websocket_filters_events_by_requested_job(client):
    from backend.services.progress_bus import progress_bus

    with client.websocket_connect("/ws/progress?jobId=job-a") as job_a, client.websocket_connect(
        "/ws/progress?jobId=job-b"
    ) as job_b:
        progress_bus.publish_sync(
            {"jobId": "job-a", "stage": "DIFFUSION", "percent": 10, "message": "a"}
        )

        assert job_a.receive_json()["jobId"] == "job-a"
        job_b.send_json({"type": "ping"})

        progress_bus.publish_sync(
            {"jobId": "job-b", "stage": "DIFFUSION", "percent": 20, "message": "b"}
        )
        assert job_b.receive_json()["jobId"] == "job-b"
