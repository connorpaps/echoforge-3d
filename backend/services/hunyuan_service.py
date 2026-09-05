"""HTTP adapter for the optional Hunyuan3D-2GP sidecar.

The sidecar owns Hunyuan's conflicting CUDA dependencies. EchoForge keeps its
stable API and post-processing here, and only receives a raw GLB over localhost.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Callable

import httpx
import numpy as np
import trimesh

from ..config import HUNYUAN_SIDECAR_URL, HUNYUAN_TIMEOUT_S

logger = logging.getLogger(__name__)
ProgressCallback = Callable[[str, int, str], None]


def apply_default_wood_material(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Give geometry-only Hunyuan output a useful warm wood appearance.

    Hunyuan shape generation does not return texture data. Its placeholder
    vertex colors are uniform gray, which makes a wooden reference render as a
    white/gray asset in viewers that honor COLOR_0. Keep this fallback local to
    Hunyuan so TripoSR's sampled photo colors remain untouched.
    """
    colors = np.asarray(mesh.visual.vertex_colors)
    # Hunyuan's GLB loader can expose COLOR_0 with ``kind=None`` even when
    # the attribute is indexed one-to-one with vertices.
    if colors.ndim != 2 or len(colors) != len(mesh.vertices):
        return mesh
    rgb = colors[:, :3]
    if len(rgb) == 0 or float(np.std(rgb, axis=0).max()) > 2.0:
        return mesh

    vertices = np.asarray(mesh.vertices, dtype=np.float64)
    grain = 0.94 + 0.06 * np.sin(vertices[:, 0] * 31.0 + vertices[:, 2] * 23.0)
    # Match the dark walnut tone in common wooden reference images without
    # losing enough red bias to read as wood under neutral scene lighting.
    base = np.array([120.0, 58.0, 20.0])
    colored = np.clip(base[None, :] * grain[:, None], 0, 255).astype(np.uint8)
    mesh.visual.vertex_colors = np.column_stack(
        [colored, np.full(len(colored), 255, dtype=np.uint8)]
    )
    return mesh


class HunyuanSidecarUnavailable(RuntimeError):
    """Raised when the optional local sidecar is not ready."""


class Hunyuan3DService:
    def __init__(self, base_url: str = HUNYUAN_SIDECAR_URL, timeout_s: float = HUNYUAN_TIMEOUT_S) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s

    def is_available(self, timeout_s: float = 0.25) -> bool:
        try:
            response = httpx.get(f"{self.base_url}/health", timeout=timeout_s)
            return response.status_code == 200 and response.json().get("status") == "ok"
        except (httpx.HTTPError, ValueError):
            return False

    def ensure_loaded(self) -> dict[str, str]:
        try:
            response = httpx.get(f"{self.base_url}/health", timeout=2.0)
            response.raise_for_status()
            body = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise HunyuanSidecarUnavailable(
                f"Hunyuan sidecar is unavailable at {self.base_url}; start the optional 2GP service or use TripoSR"
            ) from exc
        if body.get("status") != "ok":
            raise HunyuanSidecarUnavailable("Hunyuan sidecar is still loading")
        return {"backend": str(body.get("backend", "hunyuan3d-2gp")), "model": str(body.get("model", "unknown"))}

    def extract(
        self,
        _sidecar: dict[str, str],
        image_bytes: bytes,
        resolution: int = 192,
        progress: ProgressCallback | None = None,
    ) -> trimesh.Trimesh:
        if progress is not None:
            progress("RECONSTRUCTION", 5, "sending image to Hunyuan3D")
        payload = {
            "image": base64.b64encode(image_bytes).decode("ascii"),
            "seed": 1234,
            "octree_resolution": resolution,
            "num_inference_steps": 5,
            "guidance_scale": 5.0,
        }
        try:
            response = httpx.post(
                f"{self.base_url}/generate",
                json=payload,
                timeout=self.timeout_s,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HunyuanSidecarUnavailable("Hunyuan sidecar generation unavailable") from exc
        if response.content[:4] != b"glTF":
            raise RuntimeError("Hunyuan sidecar returned a non-GLB response")
        if progress is not None:
            progress("RECONSTRUCTION", 92, "received Hunyuan3D mesh")
        try:
            mesh = trimesh.load(io.BytesIO(response.content), file_type="glb", force="mesh")
        except Exception as exc:  # noqa: BLE001 - normalize loader errors at the provider boundary
            raise RuntimeError("Hunyuan sidecar returned an unreadable GLB") from exc
        if not isinstance(mesh, trimesh.Trimesh) or len(mesh.vertices) == 0 or len(mesh.faces) == 0:
            raise RuntimeError("Hunyuan sidecar returned an empty mesh")
        if not np.isfinite(mesh.vertices).all():
            raise RuntimeError("Hunyuan sidecar returned non-finite vertices")
        apply_default_wood_material(mesh)
        if progress is not None:
            progress("RECONSTRUCTION", 98, "reconstruction complete")
        return mesh


hunyuan_service = Hunyuan3DService()

# Registered as a lightweight external-provider slot. The sidecar owns the
# actual Hunyuan weights; the main backend still serializes provider calls with
# the same VRAM manager as its in-process models.
from .vram_manager import vram_manager  # noqa: E402

hunyuan_slot = vram_manager.register("hunyuan", hunyuan_service.ensure_loaded)
