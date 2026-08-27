"""Deterministic procedural ambient-audio fallback (backend Task 3.1).

Used when the real AudioGen model (``facebook/audiogen-medium``, gated on HF)
is not installed or its weights are not cached. Produces a *seamlessly
loopable* 16-bit PCM mono WAV, so the frontend spatial bus gets a usable
emitter regardless of GPU/model state.

Also hosts the WAV encode/decode helpers and the ``make_loopable`` crossfade
used to turn the real AudioGen one-shot output into a seamless loop.
"""

from __future__ import annotations

import io
import wave

import numpy as np


# --- WAV helpers ---------------------------------------------------------------


def encode_wav(samples: np.ndarray, sample_rate: int) -> bytes:
    """Encode float samples in [-1, 1] as a 16-bit PCM mono WAV."""
    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm.tobytes())
    return buffer.getvalue()


def decode_wav(data: bytes) -> tuple[np.ndarray, int]:
    """Decode a 16-bit PCM WAV back to float samples + sample rate."""
    with wave.open(io.BytesIO(data), "rb") as w:
        rate = w.getframerate()
        raw = w.readframes(w.getnframes())
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32767.0
    return samples, rate


def make_loopable(audio: np.ndarray, sample_rate: int, fade_sec: float = 0.5) -> np.ndarray:
    """Crossfade a one-shot into a seamless loop.

    The result's first ``fade`` samples are the original *tail* morphing into
    the original *head* (equal-power), and the original tail is dropped. The
    wrap point therefore sits on an original adjacent sample pair, so looping
    the output is continuous for any input — no clicks at the seam.
    """
    fade = int(fade_sec * sample_rate)
    n = len(audio)
    if n <= 2 * fade or fade < 2:
        return audio
    ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
    out = np.empty(n - fade, dtype=np.float32)
    out[:fade] = audio[n - fade :] * (1.0 - ramp) + audio[:fade] * ramp
    out[fade:] = audio[fade : n - fade]
    return out


# --- Fallback synthesizer ------------------------------------------------------


def synthesize_loop(
    duration_sec: float,
    sample_rate: int = 16000,
    seed: int | None = None,
) -> bytes:
    """Deterministic ambient pad: harmonic chord + airy noise bed.

    All tones are snapped to integer multiples of the loop fundamental
    (1/duration), so they complete whole cycles per loop — a perfect seam.
    The noise bed is low-passed and shaped with a raised-cosine window (zero
    at both edges), so it loops seamlessly too. Fully deterministic via
    ``numpy.random.default_rng(seed)``.
    """
    rng = np.random.default_rng(seed)
    n = int(round(duration_sec * sample_rate))
    t = np.arange(n, dtype=np.float32) / sample_rate
    loop_fund = 1.0 / max(duration_sec, 1e-6)

    # A2 E3 A3 C#4 — an open-fifth chord; each tone tremolo-modulated at an
    # integer-cycle rate so the envelope also loops.
    signal = np.zeros(n, dtype=np.float32)
    ratios = [1.0, 1.5, 2.0, 2.5]
    for i, ratio in enumerate(ratios):
        freq = round(110.0 * ratio / loop_fund) * loop_fund
        phase = rng.uniform(0.0, 2.0 * np.pi)
        tremolo_rate = loop_fund * float(rng.integers(1, 4))
        tremolo = 0.72 + 0.28 * np.sin(2.0 * np.pi * tremolo_rate * t + phase)
        signal += (0.26 / (i + 1)) * tremolo * np.sin(2.0 * np.pi * freq * t + phase)

    # Airy noise bed: cheap moving-average lowpass, windowed to zero at the
    # loop edges so the noise contributes nothing to the seam.
    noise = rng.standard_normal(n).astype(np.float32)
    kernel = np.ones(8, dtype=np.float32) / 8.0
    noise = np.convolve(noise, kernel, mode="same")
    noise *= 0.5 - 0.5 * np.cos(2.0 * np.pi * t / max(duration_sec, 1e-6))
    signal += 0.06 * noise

    peak = float(np.max(np.abs(signal))) or 1.0
    return encode_wav(signal / peak * 0.8, sample_rate)
