"""Fallback for the ``torchmcubes`` CUDA extension.

The TripoSR pipeline (vendored in backend/vendor/tsr) calls
``torchmcubes.marching_cubes(volume, isovalue)`` to extract a surface from a
density volume. The real package requires a CUDA-capable C++ build (MSVC +
libtorch ABI) which is not available on every Windows machine, so this shim
implements the same contract with two pure-wheel backends:

  1. ``PyMCubes`` (C++ marching cubes, ~5× faster than skimage) — preferred.
  2. scikit-image's Cython lewiner implementation — fallback.

Contract (matching torchmcubes):
    marching_cubes(volume: torch.Tensor[3D], isovalue: float)
        -> (vertices: torch.Tensor[N, 3] fp32, triangles: torch.Tensor[M, 3] int64)

Both backends return vertex coordinates in (axis0, axis1, axis2) order like
torchmcubes, so no permutation is applied here; the vendored tsr code applies
its own fixed [2, 1, 0] swap afterwards. The stub runs on CPU and the caller
moves the result back to the volume's device.

Installation: register this module as ``torchmcubes`` in ``sys.modules``
*before* importing the vendored ``tsr`` package (see backend/main.py).
"""

from __future__ import annotations

import numpy as np
import torch

try:  # preferred: C++ PyMCubes wheel
    from mcubes import marching_cubes as _marching_cubes

    _BACKEND = "PyMCubes"
except ImportError:  # fallback: scikit-image lewiner
    from skimage.measure import marching_cubes as _marching_cubes

    _BACKEND = "skimage"


def backend_name() -> str:
    """Name of the active marching-cubes backend (for logs/tests)."""
    return _BACKEND


def marching_cubes(volume: torch.Tensor, isovalue: float) -> tuple[torch.Tensor, torch.Tensor]:
    """Extract a triangle mesh from a 3-D density volume.

    Mirrors ``torchmcubes.marching_cubes``: accepts a CUDA (or CPU) 3-D tensor
    and returns vertex/face index tensors on the same device.
    """
    if volume.ndim != 3:
        raise ValueError(f"torchmcubes.marching_cubes expects a 3-D volume, got shape {tuple(volume.shape)}")

    device = volume.device
    vol = volume.detach().cpu().numpy().astype(np.float32)

    if _BACKEND == "PyMCubes":
        verts, faces = _marching_cubes(vol, float(isovalue))
        verts = verts.astype(np.float32)
        faces = faces.astype(np.int64)
    else:
        verts, faces, _normals, _values = _marching_cubes(
            vol,
            level=float(isovalue),
            method="lewiner",
            gradient_direction="ascent",
        )
        verts = verts.astype(np.float32)
        faces = faces.astype(np.int64)

    v = torch.from_numpy(verts).to(device)
    f = torch.from_numpy(faces).to(device)
    return v, f
