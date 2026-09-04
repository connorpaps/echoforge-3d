from __future__ import annotations

import httpx
import pytest
import trimesh

from backend.services.hunyuan_service import Hunyuan3DService, apply_default_wood_material


def _glb_bytes() -> bytes:
    return trimesh.Scene(trimesh.creation.box()).export(file_type="glb")


def test_hunyuan_service_accepts_valid_glb(monkeypatch):
    glb = _glb_bytes()
    request = httpx.Request("POST", "http://127.0.0.1:8081/generate")
    response = httpx.Response(200, content=glb, request=request)
    monkeypatch.setattr("backend.services.hunyuan_service.httpx.post", lambda *args, **kwargs: response)

    mesh = Hunyuan3DService().extract(
        {"backend": "hunyuan3d-2gp", "model": "test"},
        b"image-bytes",
    )

    assert len(mesh.vertices) > 0
    assert len(mesh.faces) > 0


def test_hunyuan_service_rejects_non_glb(monkeypatch):
    request = httpx.Request("POST", "http://127.0.0.1:8081/generate")
    response = httpx.Response(200, content=b"not-a-glb", request=request)
    monkeypatch.setattr("backend.services.hunyuan_service.httpx.post", lambda *args, **kwargs: response)

    with pytest.raises(RuntimeError, match="non-GLB"):
        Hunyuan3DService().extract(
            {"backend": "hunyuan3d-2gp", "model": "test"},
            b"image-bytes",
        )


def test_hunyuan_service_posts_base64_image(monkeypatch):
    seen: dict = {}
    glb = _glb_bytes()
    request = httpx.Request("POST", "http://127.0.0.1:8081/generate")
    response = httpx.Response(200, content=glb, request=request)

    def fake_post(url, **kwargs):
        seen["url"] = url
        seen["payload"] = kwargs["json"]
        return response

    monkeypatch.setattr("backend.services.hunyuan_service.httpx.post", fake_post)
    Hunyuan3DService().extract(
        {"backend": "hunyuan3d-2gp", "model": "test"},
        b"image-bytes",
        resolution=192,
    )

    assert seen["url"].endswith("/generate")
    assert seen["payload"]["image"]
    assert seen["payload"]["octree_resolution"] == 192
    assert seen["payload"]["num_inference_steps"] == 5


def test_neutral_hunyuan_colors_get_warm_wood_material():
    mesh = trimesh.creation.box()
    mesh.visual.vertex_colors = [102, 102, 102, 255]

    apply_default_wood_material(mesh)

    colors = mesh.visual.vertex_colors[:, :3]
    assert colors[:, 0].mean() > colors[:, 1].mean() > colors[:, 2].mean()
    assert colors[:, 0].mean() > 120
