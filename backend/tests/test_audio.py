"""Task 3.1 — /api/v1/generate-audio + procedural fallback + WAV contract."""

from __future__ import annotations

import io
import wave

import numpy as np

from backend.services import audio_service, procedural_audio


# --- procedural synth -----------------------------------------------------------


def test_synthesize_loop_returns_valid_wav():
    data = procedural_audio.synthesize_loop(2.0, sample_rate=16000, seed=7)
    assert data[:4] == b"RIFF"
    assert data[8:12] == b"WAVE"
    with wave.open(io.BytesIO(data), "rb") as w:
        assert w.getframerate() == 16000
        assert w.getnchannels() == 1
        assert w.getsampwidth() == 2
        frames = w.readframes(w.getnframes())
    assert len(frames) == 2 * 16000 * 2  # 2s mono 16-bit


def test_synthesize_loop_is_seamless():
    """Concat two copies: no discontinuity at the wrap point."""
    data = procedural_audio.synthesize_loop(1.0, sample_rate=16000, seed=3)
    samples, _ = procedural_audio.decode_wav(data)
    doubled = np.concatenate([samples, samples])
    wrap_delta = abs(float(doubled[len(samples) - 1]) - float(doubled[len(samples)]))
    assert wrap_delta < 0.02  # amplitude units


def test_synthesize_loop_is_deterministic():
    a = procedural_audio.synthesize_loop(1.5, sample_rate=16000, seed=42)
    b = procedural_audio.synthesize_loop(1.5, sample_rate=16000, seed=42)
    assert a == b


def test_make_loopable_removes_boundary_click():
    """A sawtooth with a hard boundary at its edges must loop seamlessly."""
    rate = 16000
    n = rate  # 1s
    t = np.arange(n, dtype=np.float32)
    audio = (t % 1000) / 1000.0  # sawtooth: audio[0]≈0, audio[-1]≈0.999 → huge jump
    looped = procedural_audio.make_loopable(audio, rate, fade_sec=0.1)
    doubled = np.concatenate([looped, looped])
    wrap_delta = abs(float(doubled[len(looped) - 1]) - float(doubled[len(looped)]))
    assert wrap_delta < 0.01


def test_encode_decode_roundtrip():
    samples = np.linspace(-0.8, 0.8, 480, dtype=np.float32)
    decoded, rate = procedural_audio.decode_wav(
        procedural_audio.encode_wav(samples, 8000)
    )
    assert rate == 8000
    assert decoded.shape == samples.shape
    assert np.max(np.abs(decoded - samples)) < 0.002  # 16-bit quantization


# --- audio service ---------------------------------------------------------------


def test_generate_falls_back_to_procedural_when_model_none():
    wav, synthetic = audio_service.audio_service.generate(None, "rain", 1.0, seed=1)
    assert synthetic is True
    assert wav[:4] == b"RIFF"


def test_generate_reports_progress_events():
    events: list[tuple[str, int, str]] = []
    audio_service.audio_service.generate(
        None,
        "wind",
        1.0,
        seed=2,
        progress=lambda stage, percent, message: events.append((stage, percent, message)),
    )
    assert any(stage == "AUDIO" for stage, _, _ in events)
    assert events[-1][1] >= 90


def test_audiogen_slot_registered_with_vram_manager():
    from backend.services.vram_manager import vram_manager

    assert any(slot.name == "audiogen" for slot in vram_manager.slots())


# --- endpoint ---------------------------------------------------------------------


def test_generate_audio_returns_wav(client, monkeypatch):
    monkeypatch.setattr(
        audio_service.audio_service,
        "generate",
        lambda model, prompt, duration_sec=10.0, seed=None, progress=None: (
            procedural_audio.synthesize_loop(1.0, seed=5),
            True,
        ),
    )
    response = client.post(
        "/api/v1/generate-audio", json={"prompt": "rain on a tent"}
    )
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.headers["x-echoforge-synthetic"] == "true"
    assert response.headers["x-echoforge-job"]
    assert response.content[:4] == b"RIFF"


def test_generate_audio_passes_seed_and_duration(client, monkeypatch):
    captured: dict = {}

    def fake_generate(model, prompt, duration_sec=10.0, seed=None, progress=None):
        captured["duration"] = duration_sec
        captured["seed"] = seed
        return procedural_audio.synthesize_loop(duration_sec, seed=seed), True

    monkeypatch.setattr(audio_service.audio_service, "generate", fake_generate)
    response = client.post(
        "/api/v1/generate-audio",
        json={"prompt": "wind", "durationSec": 5, "seed": 99},
    )
    assert response.status_code == 200, response.text
    assert captured["duration"] == 5
    assert captured["seed"] == 99


def test_generate_audio_requires_prompt(client):
    response = client.post("/api/v1/generate-audio", json={"prompt": ""})
    assert response.status_code == 422


def test_generate_audio_rejects_out_of_range_duration(client):
    response = client.post(
        "/api/v1/generate-audio", json={"prompt": "x", "durationSec": 60}
    )
    assert response.status_code == 422


def test_ws_progress_streams_audio_stage(client, monkeypatch):
    """Task 2.5 channel carries the AUDIO stage end to end."""
    monkeypatch.setattr(
        audio_service.audio_service,
        "generate",
        lambda model, prompt, duration_sec=10.0, seed=None, progress=None: (
            procedural_audio.synthesize_loop(1.0, seed=1),
            True,
        ),
    )
    with client.websocket_connect("/ws/progress") as ws:
        response = client.post(
            "/api/v1/generate-audio", json={"prompt": "rain"}
        )
        assert response.status_code == 200
        job_id = response.headers["x-echoforge-job"]

        stages: list[str] = []
        for _ in range(30):
            event = ws.receive_json()
            if event.get("jobId") != job_id:
                continue
            stages.append(event["stage"])
            if event["stage"] == "DONE":
                break

        assert "AUDIO" in stages
        assert stages[-1] == "DONE"
