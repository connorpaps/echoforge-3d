"""AudioGen text-to-audio service with a procedural fallback (Task 3.1).

The spec model is ``facebook/audiogen-medium`` — GATED on Hugging Face, and
``audiocraft==1.3.0`` pins ``torch==2.1.0`` which conflicts with this repo's
torch 2.5 stack. Per the plan, audiocraft is installed *separately*
(``--no-deps``, see backend/requirements-audiocraft.txt) so the torch 2.5
stack stays intact. When audiocraft is missing OR the gated weights are not
cached (no HF_TOKEN), the endpoint degrades to the deterministic procedural
synthesizer in ``procedural_audio.py`` so the contract, UI, and tests always
work.

Real-model verification needs: HF_TOKEN + accepted license, then
``backend/scripts/download_models.py`` to finish the pre-cache.
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

        logger.info("[AudioGen] loading %s ...", AUDIOGEN_REPO_ID)
        model = AudioGen.get_pretrained(AUDIOGEN_REPO_ID)
        model.eval()
        if DEVICE == "cuda":
            model = model.to(DEVICE)
        return model
    except Exception as exc:  # noqa: BLE001 - gated/uncached weights degrade gracefully
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
        with torch.no_grad():
            generated = model.generate([prompt], progress=False)
        audio = generated[0, 0].cpu().numpy().astype(np.float32)

        report("AUDIO", 80, "making loop seamless")
        looped = procedural_audio.make_loopable(audio, AUDIO_SAMPLE_RATE)
        return procedural_audio.encode_wav(looped, AUDIO_SAMPLE_RATE), False


# Module-level singleton registered with the VRAM manager at app startup.
from .vram_manager import vram_manager  # noqa: E402

audio_service = AudioService()
audiogen_slot = vram_manager.register("audiogen", audio_service.ensure_loaded)
