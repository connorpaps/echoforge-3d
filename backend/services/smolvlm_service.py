"""SmolVLM vision-NPC dialogue service (Task 3.3).

Loads ``HuggingFaceTB/SmolVLM-Instruct`` (weights pre-cached in Phase 0) via
the transformers ``image-text-to-text`` pipeline and answers questions about
a viewport screenshot with a persona prompt. All GPU work happens inside the
SequentialVRAMManager lock via the ``smolvlm`` model slot.

Real inference additionally needs ``qwen-vl-utils`` (SmolVLM's processor
dependency) — NOT installed by default under the zero-vetted-deps guardrail.
When it is missing (or the model fails to load), the service degrades to a
deterministic canned dialogue line so the contract, UI, and tests always work.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Callable

from ..config import DEVICE, TORCH_DTYPE

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, str], None]

try:  # pragma: no cover - optional dependency
    import qwen_vl_utils  # noqa: F401

    QWEN_VL_UTILS_AVAILABLE = True
except ImportError:
    QWEN_VL_UTILS_AVAILABLE = False

# Fallback line used when the vision model is unavailable.
FALLBACK_DIALOGUE = (
    "Your world is taking shape — keep crafting, and I'll describe what I see."
)

DEFAULT_PERSONA = (
    "You are a wise forest guide inside a 3D world. React to what you see in "
    "the frame and keep your reply to 1-2 short sentences."
)


def _load_smolvlm():
    """VRAM manager slot loader: real SmolVLM, or None → canned dialogue."""
    if not QWEN_VL_UTILS_AVAILABLE:
        logger.info(
            "[SmolVLM] qwen-vl-utils not installed — using fallback dialogue"
        )
        return None
    try:
        from transformers import pipeline

        logger.info("[SmolVLM] loading HuggingFaceTB/SmolVLM-Instruct ...")
        pipe = pipeline(
            "image-text-to-text",
            model="HuggingFaceTB/SmolVLM-Instruct",
            device=DEVICE,
            torch_dtype=TORCH_DTYPE if DEVICE == "cuda" else None,
        )
        return pipe
    except Exception as exc:  # noqa: BLE001 - uncached/unsupported weights degrade gracefully
        logger.warning("[SmolVLM] load failed (%s) — using fallback dialogue", exc)
        return None


def _decode_frame(frame_base64: str):
    from PIL import Image

    body = frame_base64.strip()
    if body.startswith("data:"):
        body = body.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(body)))


class SmolVLMService:
    """Lazily-loaded SmolVLM wrapper with a graceful canned fallback."""

    # -- VRAM manager slot API ------------------------------------------------

    def ensure_loaded(self):
        """Construct the pipeline once; called by the SequentialVRAMManager."""
        return _load_smolvlm()

    # -- dialogue -----------------------------------------------------------------

    def dialogue(
        self,
        model,
        frame_base64: str,
        persona: str = DEFAULT_PERSONA,
        progress: ProgressCallback | None = None,
    ) -> tuple[str, bool]:
        """Answer about a viewport frame. Returns ``(dialogue_text, synthetic)``."""

        def report(stage: str, percent: int, message: str) -> None:
            if progress is not None:
                progress(stage, percent, message)

        if model is None:
            report("NPC", 60, "vision model offline — fallback line")
            return FALLBACK_DIALOGUE, True

        try:
            report("NPC", 20, "encoding frame")
            image = _decode_frame(frame_base64)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {"type": "text", "text": persona},
                    ],
                }
            ]
            report("NPC", 55, "vision model reasoning")
            outputs = model(
                messages,
                max_new_tokens=64,
                do_sample=True,
                temperature=0.7,
                return_full_text=False,
            )
            text = outputs[0]["generated_text"].strip()
            if not text:
                raise ValueError("SmolVLM returned empty text")
            report("NPC", 95, "response ready")
            return text, False
        except Exception as exc:  # noqa: BLE001 - degrade to the canned line
            logger.warning("[SmolVLM] inference failed (%s) — fallback line", exc)
            return FALLBACK_DIALOGUE, True


# Module-level singleton registered with the VRAM manager at app startup.
from .vram_manager import vram_manager  # noqa: E402

smolvlm_service = SmolVLMService()
smolvlm_slot = vram_manager.register("smolvlm", smolvlm_service.ensure_loaded)
