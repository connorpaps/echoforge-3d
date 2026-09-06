"""GET /health — docs/08_TASKS.md Task 2.1 verification."""

from __future__ import annotations

import torch


def test_health_returns_contract_shape(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "vramMB" in body
    assert isinstance(body["vramMB"], int)
    assert body["cuda"]["available"] is torch.cuda.is_available()
    if torch.cuda.is_available():
        assert body["cuda"]["deviceName"]
        assert body["cuda"]["vramTotalMB"] > 0
    else:
        assert body["cuda"]["vramTotalMB"] == 0


def test_health_cuda_metadata_matches_torch(client):
    body = client.get("/health").json()
    if torch.cuda.is_available():
        expected_total = torch.cuda.get_device_properties(0).total_memory // (2**20)
        assert body["cuda"]["vramTotalMB"] == expected_total


def test_health_reports_provider_modes_without_loading_models(client):
    providers = client.get("/health").json()["providers"]
    assert providers["mesh"]["configured"] in {"auto", "triposr", "hunyuan"}
    assert providers["mesh"]["triposr"]["mode"] == "fallback"
    assert providers["texture"]["mode"] == "optional"
    assert providers["speech"]["mode"] == "browser-worker"


def test_health_selects_fallback_when_hunyuan_is_configured_but_unavailable(monkeypatch):
    from backend.routers import health as health_router

    monkeypatch.setattr(health_router, "MESH_BACKEND", "hunyuan")
    monkeypatch.setattr(health_router.hunyuan_service, "is_available", lambda: False)

    providers = health_router.provider_status()

    assert providers["mesh"]["configured"] == "hunyuan"
    assert providers["mesh"]["selected"] == "triposr"
