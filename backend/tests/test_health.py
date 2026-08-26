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
