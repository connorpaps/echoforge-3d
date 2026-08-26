"""TripoSR image-to-mesh service.

Loads the vendored ``tsr`` pipeline (backend/vendor/tsr) against the cached
``stabilityai/TripoSR`` checkpoint and runs image → scene codes → marching
cubes extraction with vertex colors. All GPU work happens *inside* the
SequentialVRAMManager lock, and this service only exposes:

  * ``ensure_loaded`` — lazy model construction (used by the manager's slot)
  * ``extract`` — full image → trimesh.Mesh pipeline with progress callbacks

The torchmcubes CUDA extension is optional: when unavailable, the skimage
shim (backend/shims/torchmcubes_stub.py) is registered under the same module
name before ``tsr`` is imported, so the vendored code runs unchanged.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Callable

import numpy as np
import torch
import trimesh

from ..config import (
    CUDA_AVAILABLE,
    DEVICE,
    HF_HOME,
    TORCH_DTYPE,
    TRIPOSR_CONFIG_NAME,
    TRIPOSR_REPO_ID,
    TRIPOSR_WEIGHTS_NAME,
    VENDOR_DIR,
)
from .image_utils import prepare_foreground

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str, int, str], None]


def _mc_backend_name() -> str:
    from ..shims import torchmcubes_stub

    return torchmcubes_stub.backend_name()


def _bootstrap_vendor() -> None:
    """Make the vendored ``tsr`` package importable and shim torchmcubes."""
    vendor = str(VENDOR_DIR)
    if vendor not in sys.path:
        sys.path.insert(0, vendor)

    try:
        import torchmcubes  # noqa: F401
    except ImportError:
        from ..shims import torchmcubes_stub

        sys.modules.setdefault("torchmcubes", torchmcubes_stub)
        logger.info("torchmcubes not installed — using %s marching-cubes shim", torchmcubes_stub.backend_name())


def _resolve_model_path() -> str:
    """Local HF snapshot dir for TripoSR (falls back to a network fetch)."""
    repo_dir = HF_HOME / "hub" / f"models--{TRIPOSR_REPO_ID.replace('/', '--')}" / "snapshots"
    if repo_dir.is_dir():
        snapshots = sorted(repo_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
        if snapshots:
            return str(snapshots[0])
    from huggingface_hub import snapshot_download

    return snapshot_download(TRIPOSR_REPO_ID, allow_patterns=["*.yaml", "*.ckpt", "*.json"])


class TripoSRService:
    """Lazily-loaded TripoSR wrapper (constructed via the VRAM manager slot)."""

    def __init__(self) -> None:
        self._model = None
        self._resolution: int | None = None

    # -- VRAM manager slot API ------------------------------------------------

    def ensure_loaded(self):
        """Load the pipeline once; called by the SequentialVRAMManager."""
        if self._model is not None:
            return self._model

        _bootstrap_vendor()
        from tsr.system import TSR

        model_path = _resolve_model_path()
        logger.info("[TripoSR] loading pipeline from %s ...", model_path)
        model = TSR.from_pretrained(model_path, TRIPOSR_CONFIG_NAME, TRIPOSR_WEIGHTS_NAME)
        # FP16 + chunked surface extraction. TripoSR's triplane renderer mixes
        # fp32 grid vertices with the decoder, so backend/vendor/tsr/system.py
        # carries an EchoForge patch casting inputs to the model dtype.
        # chunk_size keeps peak VRAM ~1.5-2 GB while staying large enough to
        # saturate the GPU on 8 GB cards.
        model.renderer.set_chunk_size(16384)
        model.to(DEVICE, dtype=TORCH_DTYPE)
        model.eval()
        self._model = model
        logger.info(
            "[TripoSR] pipeline loaded (device=%s, dtype=%s, chunk_size=16384, mc=%s)",
            DEVICE,
            TORCH_DTYPE,
            _mc_backend_name(),
        )
        return self._model

    # -- generation -------------------------------------------------------------

    def extract(
        self,
        model,
        image_bytes: bytes,
        resolution: int = 256,
        progress: ProgressCallback | None = None,
    ) -> trimesh.Trimesh:
        """Run the full image → mesh pipeline. Call under the VRAM lock.

        ``model`` is the loaded pipeline handed to us by the VRAM manager.
        """

        def report(stage: str, percent: int, message: str) -> None:
            if progress is not None:
                progress(stage, percent, message)

        report("RECONSTRUCTION", 5, "preparing image")
        pil = prepare_foreground(_decode(image_bytes))

        report("RECONSTRUCTION", 15, "encoding image features")
        with torch.no_grad():
            scene_codes = model(pil, DEVICE)

        report("RECONSTRUCTION", 55, "sampling density field")
        if self._resolution != resolution:
            model.set_marching_cubes_resolution(resolution)
            self._resolution = resolution
        meshes = model.extract_mesh(
            scene_codes,
            has_vertex_color=True,
            resolution=resolution,
            threshold=25.0,
        )
        report("RECONSTRUCTION", 92, "extracting surface")
        mesh = meshes[0]

        # Sanity checks before handing to the optimizer.
        if len(mesh.vertices) == 0 or len(mesh.faces) == 0:
            raise RuntimeError("TripoSR returned an empty mesh — try a clearer input image")
        if not np.isfinite(mesh.vertices).all():
            raise RuntimeError("TripoSR returned non-finite vertices")

        report("RECONSTRUCTION", 98, "reconstruction complete")
        return mesh


def _decode(image_bytes: bytes):
    from PIL import Image

    import io

    return Image.open(io.BytesIO(image_bytes))


# Module-level singletons registered with the VRAM manager at app startup.
from .vram_manager import vram_manager  # noqa: E402

tsr_service = TripoSRService()
tsr_slot = vram_manager.register("triposr", tsr_service.ensure_loaded)
