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


class _FakeInputs(dict):
    """Dict-like stand-in for processor(...) output (a BatchFeature is a dict
    subclass — the service unpacks it with ``**inputs`` and indexes by key).
    CPU-only."""

    def __init__(self, n_prompt: int) -> None:
        import torch

        super().__init__(input_ids=torch.zeros((1, n_prompt), dtype=torch.long))

    def to(self, _device):  # noqa: ANN001 - the real path moves to CUDA
        return self


class _FakeProcessor:
    def __init__(self, reply: str) -> None:
        self._reply = reply

    def apply_chat_template(self, messages, add_generation_prompt=False):  # noqa: ANN001
        assert messages[0]["role"] == "user"
        assert messages[0]["content"][0] == {"type": "image"}
        return "<chat-template>"

    def __call__(self, text=None, images=None, return_tensors=None):  # noqa: ANN001
        assert text and images
        return _FakeInputs(n_prompt=4)

    def batch_decode(self, outputs, skip_special_tokens=False):  # noqa: ANN001
        return [self._reply]


class _FakeModel:
    def generate(self, **kwargs):
        import torch

        assert kwargs["max_new_tokens"] == 64
        assert kwargs["do_sample"] is True
        return torch.zeros((1, 8), dtype=torch.long)

    def to(self, _device):  # noqa: ANN001
        return self

    def eval(self):  # noqa: D102
        return self


def test_dialogue_real_path_uses_processor_and_returns_nonsynthetic():
    """The real-vision code path (processor + model, no pipeline) returns the
    generated text with synthetic=False."""
    model = (_FakeModel(), _FakeProcessor("A campfire glows on the ridge."))
    text, synthetic = smolvlm_service.smolvlm_service.dialogue(
        model, _frame_data_url(), "be terse"
    )
    assert synthetic is False
    assert text == "A campfire glows on the ridge."


def test_dialogue_real_path_falls_back_on_inference_error():
    class BoomModel:
        def generate(self, **kwargs):
            raise RuntimeError("cuda error")

    model = (BoomModel(), _FakeProcessor("ignored"))
    text, synthetic = smolvlm_service.smolvlm_service.dialogue(model, _frame_data_url())
    assert synthetic is True
    assert text == smolvlm_service.FALLBACK_DIALOGUE


def test_load_smolvlm_returns_none_without_qwen_vl_utils(monkeypatch):
    monkeypatch.setattr(smolvlm_service, "QWEN_VL_UTILS_AVAILABLE", False)
    assert smolvlm_service._load_smolvlm() is None


def test_load_smolvlm_builds_model_and_processor(monkeypatch):
    # Patch the SERVICE's module globals, not `transformers` itself: 4.46's
    # _LazyModule caches lazily-materialized names, so module-level setattr on
    # `transformers` is silently ignored once the real class has been touched.
    monkeypatch.setattr(smolvlm_service, "QWEN_VL_UTILS_AVAILABLE", True)
    monkeypatch.setattr(
        smolvlm_service,
        "AutoProcessor",
        type("AP", (), {"from_pretrained": staticmethod(lambda repo: _FakeProcessor("x"))}),
    )
    loaded: dict = {}

    class FakeAuto:
        @staticmethod
        def from_pretrained(repo, torch_dtype=None):
            loaded["repo"] = repo
            loaded["dtype"] = torch_dtype
            return _FakeModel()

    monkeypatch.setattr(smolvlm_service, "AutoModelForImageTextToText", FakeAuto)
    result = smolvlm_service._load_smolvlm()
    model, processor = result
    assert loaded["repo"] == "HuggingFaceTB/SmolVLM-Instruct"
    assert isinstance(model, _FakeModel)
    assert isinstance(processor, _FakeProcessor)


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
