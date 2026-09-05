"""SDXL-Turbo single-step text-to-image service.

``stabilityai/sdxl-turbo`` is an adversarial-distilled model that produces a
usable image in 1–4 steps at 512×512. We load the fp16 variant and route all
GPU work through the SequentialVRAMManager so it never co-resides with
TripoSR (VRAM safety invariant).

Progress: diffusers' per-step callback drives DIFFUSION percent ticks over the
progress bus, plus a model-load tick so the frontend shimmer starts
immediately.
"""

from __future__ import annotations

import io
import logging
from typing import Callable

import torch

from ..config import (
    CUDA_AVAILABLE,
    DEVICE,
    SDXL_GUIDANCE,
    SDXL_REPO_ID,
    SDXL_SIZE,
    SDXL_STEPS,
    SDXL_VARIANT,
    TORCH_DTYPE,
)

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, str], None]


class SDXLService:
    """Lazily-loaded SDXL-Turbo wrapper (constructed via the VRAM manager slot)."""

    def __init__(self) -> None:
        self._pipe = None

    # -- VRAM manager slot API ------------------------------------------------

    def ensure_loaded(self):
        if self._pipe is not None:
            return self._pipe
        from diffusers import AutoPipelineForText2Image

        logger.info("[SDXL] loading %s (variant=%s) ...", SDXL_REPO_ID, SDXL_VARIANT)
        kwargs: dict = {"torch_dtype": TORCH_DTYPE}
        if CUDA_AVAILABLE:
            kwargs["variant"] = SDXL_VARIANT
        self._pipe = AutoPipelineForText2Image.from_pretrained(SDXL_REPO_ID, **kwargs)

        if CUDA_AVAILABLE:
            # SDXL-Turbo fp16 weights total ~6.6 GB (UNet alone ~4.9 GB). On
            # 8 GB cards that leaves <1 GB for activations and the CUDA
            # allocator thrashes (a 1-step job stalls for 40s+). Model offload
            # streams each component to the GPU only while it is used, keeping
            # peak VRAM ~3 GB and generation fast. See AGENTS.md VRAM safety.
            self._pipe.enable_model_cpu_offload()
            self._pipe.enable_vae_slicing()
            self._pipe.enable_vae_tiling()
        else:
            self._pipe.to(DEVICE)
        if hasattr(self._pipe, "set_progress_bar_config"):
            self._pipe.set_progress_bar_config(disable=True)
        self._pipe.safety_checker = None
        logger.info("[SDXL] pipeline loaded (device=%s, cpu_offload=%s)", DEVICE, CUDA_AVAILABLE)
        return self._pipe

    def unload(self) -> None:
        """Clear the pipeline reference owned by this service."""
        self._pipe = None

    # -- generation -------------------------------------------------------------

    def generate(
        self,
        pipe,
        prompt: str,
        steps: int = SDXL_STEPS,
        guidance_scale: float = SDXL_GUIDANCE,
        seed: int | None = None,
        size: int = SDXL_SIZE,
        progress: ProgressCallback | None = None,
    ) -> bytes:
        """Generate an image and return PNG bytes. Call under the VRAM lock.

        ``pipe`` is the loaded diffusion pipeline handed to us by the VRAM
        manager.
        """

        def report(stage: str, percent: int, message: str) -> None:
            if progress is not None:
                progress(stage, percent, message)

        report("DIFFUSION", 10, "model loaded — sampling")
        generator: torch.Generator | None = None
        if seed is not None:
            generator = torch.Generator(device=DEVICE).manual_seed(seed)

        def on_step_end(_pipe, step: int, _timestep, callback_kwargs) -> dict:
            # Modern diffusers hook (callback_on_step_end): (pipe, step, timestep, kwargs).
            # The callback MUST return the kwargs dict — diffusers 0.31 pops
            # "latents" off the return value and crashes on None (verified
            # live on CUDA: `'NoneType' object has no attribute 'pop'`).
            percent = 20 + int(80 * (step + 1) / max(1, steps))
            report("DIFFUSION", min(percent, 100), f"step {step + 1}/{steps}")
            return callback_kwargs

        result = pipe(
            prompt=prompt,
            num_inference_steps=steps,
            guidance_scale=guidance_scale,
            width=size,
            height=size,
            generator=generator,
            callback_on_step_end=on_step_end,
        )
        image = result.images[0]
        report("DIFFUSION", 100, "complete")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()


# Module-level singletons registered with the VRAM manager at app startup.
from .vram_manager import vram_manager  # noqa: E402

sdxl_service = SDXLService()
sdxl_slot = vram_manager.register("sdxl-turbo", sdxl_service.ensure_loaded, sdxl_service.unload)
