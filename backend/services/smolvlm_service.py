"""SmolVLM vision-NPC dialogue service (Task 3.3).

Loads ``HuggingFaceTB/SmolVLM-Instruct`` (weights pre-cached in Phase 0) as an
``AutoModelForImageTextToText`` + its processor and answers questions about a
viewport screenshot with a persona prompt. All GPU work happens inside the
SequentialVRAMManager lock via the ``smolvlm`` model slot.

NOTE: transformers 4.46 has no ``image-text-to-text`` pipeline task (added
later), so we drive the processor + model directly with the SmolVLM chat
template — the canonical HF usage. Real inference additionally needs
``qwen-vl-utils`` (SmolVLM's processor dependency). When it is missing (or the
model fails to load), the service degrades to a deterministic canned dialogue
line so the contract, UI, and tests always work.
"""

from __future__ import annotations

import logging
from typing import Callable

import torch
from transformers import AutoModelForImageTextToText, AutoProcessor

from ..config import DEVICE, SMOLVLM_REPO_ID, TORCH_DTYPE

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
    """VRAM manager slot loader: real SmolVLM, or None → canned dialogue.

    Returns ``(model, processor)`` or ``None`` (fallback). The model rides on
    the GPU through the VRAM manager slot.
    """
    if not QWEN_VL_UTILS_AVAILABLE:
        logger.info(
            "[SmolVLM] qwen-vl-utils not installed — using fallback dialogue"
        )
        return None
    try:
        logger.info("[SmolVLM] loading %s ...", SMOLVLM_REPO_ID)
        processor = AutoProcessor.from_pretrained(SMOLVLM_REPO_ID)
        model = AutoModelForImageTextToText.from_pretrained(
            SMOLVLM_REPO_ID, torch_dtype=TORCH_DTYPE
        )
        model.to(DEVICE)
        model.eval()
        logger.info(
            "[SmolVLM] loaded %s (device=%s, dtype=%s)", SMOLVLM_REPO_ID, DEVICE, TORCH_DTYPE
        )
        return model, processor
    except Exception as exc:  # noqa: BLE001 - uncached/unsupported weights degrade gracefully
        logger.warning("[SmolVLM] load failed (%s) — using fallback dialogue", exc)
        return None


def _decode_frame(frame_base64: str):
    from .image_utils import decode_image

    return decode_image(frame_base64)


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
            vl_model, processor = model
            report("NPC", 20, "encoding frame")
            image = _decode_frame(frame_base64)
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image"},
                        {"type": "text", "text": persona},
                    ],
                }
            ]
            report("NPC", 40, "preprocessing frame")
            prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
            inputs = processor(text=prompt, images=[image], return_tensors="pt").to(DEVICE)
            report("NPC", 55, "vision model reasoning")
            with torch.inference_mode():
                outputs = vl_model.generate(
                    **inputs,
                    max_new_tokens=64,
                    do_sample=True,
                    temperature=0.7,
                )
            text = processor.batch_decode(
                outputs[:, inputs["input_ids"].shape[1] :], skip_special_tokens=True
            )[0].strip()
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
