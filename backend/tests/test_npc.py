"""Task 3.3 — /api/v1/npc-dialogue + SmolVLM service + canned fallback."""

from __future__ import annotations

import base64
import io

from PIL import Image

from backend.services import smolvlm_service


def _frame_data_url() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (40, 90, 160)).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# --- service ---------------------------------------------------------------------


def test_dialogue_returns_canned_fallback_when_model_none():
    text, synthetic = smolvlm_service.smolvlm_service.dialogue(
        None, _frame_data_url(), "persona"
    )
    assert synthetic is True
    assert len(text) > 0


def test_dialogue_reports_progress_events():
    events: list[tuple[str, int, str]] = []
    smolvlm_service.smolvlm_service.dialogue(
        None,
        _frame_data_url(),
        "persona",
        progress=lambda stage, percent, message: events.append((stage, percent, message)),
    )
    assert any(stage == "NPC" for stage, _, _ in events)


def test_smolvlm_slot_registered_with_vram_manager():
    from backend.services.vram_manager import vram_manager

    assert any(slot.name == "smolvlm" for slot in vram_manager.slots())


# --- endpoint ----------------------------------------------------------------------


def test_npc_dialogue_returns_text(client, monkeypatch):
    monkeypatch.setattr(
        smolvlm_service.smolvlm_service,
        "dialogue",
        lambda model, frame, persona, progress=None: (
            "I see a campfire glowing on the ridge — perfect for storytelling.",
            False,
        ),
    )
    response = client.post(
        "/api/v1/npc-dialogue",
        json={"frameBase64": _frame_data_url(), "persona": "be terse"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["dialogueText"].startswith("I see a campfire")
    assert body["synthetic"] is False
    assert body["jobId"]
    assert body["elapsedMs"] >= 0


def test_npc_dialogue_defaults_persona(client, monkeypatch):
    captured: dict = {}
    monkeypatch.setattr(
        smolvlm_service.smolvlm_service,
        "dialogue",            lambda model, frame, persona, progress=None: (
                captured.update(persona=persona) or ("hi", False)
            ),
    )
    response = client.post(
        "/api/v1/npc-dialogue", json={"frameBase64": _frame_data_url()}
    )
    assert response.status_code == 200
    assert "forest guide" in captured["persona"]


def test_npc_dialogue_rejects_invalid_frame(client):
    response = client.post(
        "/api/v1/npc-dialogue", json={"frameBase64": "not-valid!!!", "persona": "x"}
    )
    assert response.status_code == 400


def test_npc_dialogue_requires_frame(client):
    response = client.post("/api/v1/npc-dialogue", json={"persona": "x"})
    assert response.status_code == 422
