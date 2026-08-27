"""AudioGen text-to-audio service with a procedural fallback (Task 3.1).

The spec model is ``facebook/audiogen-medium`` — PUBLIC on Hugging Face
(verified via the HF API: gated=false; the earlier "gated" note was wrong).
``audiocraft==1.3.0`` pins ``torch==2.1.0`` which conflicts with this repo's
torch 2.5 stack, so audiocraft is installed *separately* (``--no-deps``, see
backend/requirements-audiocraft.txt — includes a guarded xformers import
patch since no torch-2.5 Windows wheel exists). When audiocraft is missing
OR the weights are not cached, the endpoint degrades to the deterministic
procedural synthesizer in ``procedural_audio.py`` so the contract, UI, and
tests always work.

Real-model pre-cache (no token needed):
``HF_HOME='G:\hf-cache' .venv/Scripts/python.exe backend/scripts/download_models.py``
"""

from __future__ import annotations

import logging
from typing import Callable

import numpy as np
import torch

from ..config import AUDIOGEN_REPO_ID, AUDIO_SAMPLE_RATE, DEVICE
from . import procedural_audio

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, str], None]

try:  # pragma: no cover - optional audiocraft install
    import audiocraft.models  # noqa: F401

    AUDIOCRAFT_IMPORTABLE = True
except ImportError:
    AUDIOCRAFT_IMPORTABLE = False


def _load_audiogen():
    """VRAM manager slot loader: real AudioGen, or None → procedural fallback."""
    if not AUDIOCRAFT_IMPORTABLE:
        logger.info("[AudioGen] audiocraft not installed — using procedural fallback")
        return None
    try:
        from audiocraft.models import AudioGen

        logger.info("[AudioGen] loading %s (device=%s) ...", AUDIOGEN_REPO_ID, DEVICE)
        # AudioGen is a wrapper ABC (not an nn.Module) — no .eval()/.to();
        # get_pretrained moves the underlying LM to the requested device.
        model = AudioGen.get_pretrained(AUDIOGEN_REPO_ID, device=DEVICE)
        return model
    except Exception as exc:  # noqa: BLE001 - uncached weights degrade gracefully
        logger.warning("[AudioGen] load failed (%s) — using procedural fallback", exc)
        return None


class AudioService:
    """Lazily-loaded AudioGen wrapper with a graceful procedural fallback."""

    # -- VRAM manager slot API -------------------------------------------------

    def ensure_loaded(self):
        """Construct the model once; called by the SequentialVRAMManager."""
        return _load_audiogen()

    # -- generation -------------------------------------------------------------

    def generate(
        self,
        model,
        prompt: str,
        duration_sec: float = 10.0,
        seed: int | None = None,
        progress: ProgressCallback | None = None,
    ) -> tuple[bytes, bool]:
        """Synthesize a loopable WAV. Returns ``(wav_bytes, synthetic)``.

        ``synthetic=True`` when the procedural fallback produced the audio
        (model is None or the real path is unavailable). Call under the VRAM
        lock via ``vram_manager.run("audiogen", ...)``.
        """

        def report(stage: str, percent: int, message: str) -> None:
            if progress is not None:
                progress(stage, percent, message)

        if model is None:
            report("AUDIO", 40, "synthesizing ambient loop (fallback)")
            wav = procedural_audio.synthesize_loop(duration_sec, AUDIO_SAMPLE_RATE, seed)
            report("AUDIO", 95, "encoding wav")
            return wav, True

        report("AUDIO", 30, "model loaded — sampling")
        # make_loopable crossfades away the last `fade` seconds, so generate
        # fade_sec MORE audio than requested and the loop lands at the exact
        # requested duration. CRITICAL: AudioGen caps generation at its
        # max_duration (10 s) — requesting more silently switches to the
        # extended streaming continuation path, which is pathologically slow
        # (~7 min for a 10.5 s clip on the RTX 2070; watchdog-killed live).
        # Clamp the fade budget so duration + fade never exceeds max_duration;
        # at the cap (10 s) we emit the raw one-shot (no crossfade).
        max_dur = float(getattr(model, "max_duration", 10.0) or 10.0)
        fade_budget = min(procedural_audio.LOOP_FADE_SEC, max(0.0, max_dur - duration_sec))
        model.set_generation_params(duration=duration_sec + fade_budget)
        with torch.no_grad():
            generated = model.generate([prompt], progress=False)
        audio = generated[0, 0].cpu().numpy().astype(np.float32)

        report("AUDIO", 80, "making loop seamless")
        looped = procedural_audio.make_loopable(audio, AUDIO_SAMPLE_RATE, fade_sec=fade_budget)
        return procedural_audio.encode_wav(looped, AUDIO_SAMPLE_RATE), False


# Module-level singleton registered with the VRAM manager at app startup.
from .vram_manager import vram_manager  # noqa: E402

audio_service = AudioService()
audiogen_slot = vram_manager.register("audiogen", audio_service.ensure_loaded)
