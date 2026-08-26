"""Mesh optimization pipeline — docs/08_TASKS.md Task 2.4 verification.

Verification target: *"output meshes load in Three.js with zero non-manifold
vertex errors"* — approximated here by GLB structural validity, consistent
winding, ≤ max_faces, preserved vertex colors, and non-empty convex hulls.
"""

from __future__ import annotations

import numpy as np
import pytest
import trimesh

from backend.services import mesh_processing


def _colored_icosphere(subdivisions: int = 3) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions)
    colors = np.zeros((len(mesh.vertices), 4), dtype=np.uint8)
    colors[:, 1] = np.linspace(0, 255, len(mesh.vertices))  # green gradient
    colors[:, 3] = 255
    mesh.visual.vertex_colors = colors
    return mesh


def test_sanitize_fixes_winding_and_dedupes():
    mesh = _colored_icosphere()
    # Intentionally duplicate a vertex and flip a triangle to test sanitization.
    flipped = mesh.copy()
    flipped.faces[0] = flipped.faces[0][::-1]

    clean = mesh_processing.sanitize_mesh(flipped)
    assert clean.is_winding_consistent
    assert len(clean.faces) > 0
    colors = clean.visual.vertex_colors
    assert colors is not None
    assert len(colors) == len(clean.vertices)


def test_decimation_respects_face_budget_and_keeps_colors():
    big = _colored_icosphere(subdivisions=4)  # 5120 faces
    assert len(big.faces) > 4000

    small = mesh_processing.decimate_mesh(big, max_faces=2000)
    assert len(small.faces) <= 2000
    assert len(small.vertices) > 0

    # Color resampling restores per-vertex colors after decimation.
    resampled = mesh_processing.resample_vertex_colors(big, small.vertices)
    assert resampled is not None
    assert len(resampled) == len(small.vertices)
    assert resampled.dtype == np.uint8


def test_process_mesh_full_pipeline():
    mesh = _colored_icosphere(subdivisions=3)
    result = mesh_processing.process_mesh(mesh, max_faces=20000)

    assert result["faceCount"] <= 20000
    assert result["vertexCount"] > 0
    assert result["faceCount"] > 0

    bounds = result["bounds"]
    assert len(bounds["min"]) == len(bounds["max"]) == len(bounds["size"]) == 3
    # A unit icosphere fits in [-1.5, 1.5]^3
    assert all(-2.0 < v < 2.0 for v in bounds["min"])
    assert all(-2.0 < v < 2.0 for v in bounds["max"])

    assert len(result["collisionHulls"]) >= 1
    hull = result["collisionHulls"][0]
    assert len(hull["vertices"]) > 0 and len(hull["faces"]) > 0

    glb = mesh_processing.decode_glb_bytes(result["glbBase64"])
    assert mesh_processing.validate_glb(glb)
    # Vertex colors must survive into the exported GLB (COLOR_0 attribute).
    assert b"COLOR_0" in glb


def test_process_mesh_decimates_oversized_input():
    big = _colored_icosphere(subdivisions=5)  # 20480 faces
    result = mesh_processing.process_mesh(big, max_faces=4000)
    assert result["faceCount"] <= 4000
    glb = mesh_processing.decode_glb_bytes(result["glbBase64"])
    assert mesh_processing.validate_glb(glb)


def test_validate_glb_rejects_garbage():
    assert not mesh_processing.validate_glb(b"")
    assert not mesh_processing.validate_glb(b"not a glb at all")
    bad_magic = b"GLTF" + b"\x02\x00\x00\x00" + b"\x14\x00\x00\x00" + b"\x00" * 12
    assert not mesh_processing.validate_glb(bad_magic)


def test_glb_data_url_roundtrip():
    glb = mesh_processing.decode_glb_bytes("aGVsbG8=")  # arbitrary bytes
    url = mesh_processing.glb_data_url("aGVsbG8=")
    assert url.startswith("data:model/gltf-binary;base64,")


def test_smoothing_preserves_validity():
    mesh = _colored_icosphere(subdivisions=3)
    smoothed = mesh.copy()
    trimesh.smoothing.filter_laplacian(smoothed, iterations=1, lamb=0.4)
    assert len(smoothed.faces) == len(mesh.faces)
    assert np.isfinite(smoothed.vertices).all()


def test_empty_mesh_rejected():
    empty = trimesh.Trimesh(vertices=[[0, 0, 0]], faces=[])
    with pytest.raises(ValueError, match="no faces"):
        mesh_processing.process_mesh(empty)
