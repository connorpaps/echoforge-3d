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
    # World frame contract: feet sit on y=0, x/z centered on origin, and the
    # asset is a sane size (the unit icosphere is ~2 units tall).
    assert abs(bounds["min"][1]) < 1e-6
    assert abs(bounds["min"][0] + bounds["max"][0]) < 1e-3
    assert abs(bounds["min"][2] + bounds["max"][2]) < 1e-3
    assert all(v < 2.5 for v in bounds["size"])

    assert len(result["collisionHulls"]) >= 1
    hull = result["collisionHulls"][0]
    assert len(hull["vertices"]) > 0 and len(hull["faces"]) > 0

    glb = mesh_processing.decode_glb_bytes(result["glbBase64"])
    assert mesh_processing.validate_glb(glb)
    # Vertex colors must survive into the exported GLB (COLOR_0 attribute).
    assert b"COLOR_0" in glb
    # Smooth shading must survive the export boundary too.
    assert b"NORMAL" in glb


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


def test_keep_largest_component_drops_debris():
    big = trimesh.creation.box(extents=[2, 2, 2])
    sliver = trimesh.creation.box(extents=[0.05, 0.05, 0.05]).apply_translation([10, 10, 10])
    mesh = trimesh.util.concatenate([big, sliver])

    cleaned = mesh_processing.keep_largest_component(mesh)
    # Only the big box remains; the debris box is gone.
    assert len(cleaned.vertices) == len(big.vertices)
    assert cleaned.extents.max() > 1.9


def test_keep_largest_component_single_component_unchanged():
    mesh = trimesh.creation.icosphere(subdivisions=2)
    assert mesh_processing.keep_largest_component(mesh) is mesh


def test_orient_upright_stands_on_ground_with_warm_top():
    # Tall box lying along X, warm colors at the +X tip (photo semantics: warm
    # wood/skin = the object's natural top). After orient, height must be +Y,
    # feet on y=0, and the warm end pointing up.
    mesh = trimesh.creation.box(extents=[3.0, 0.5, 0.5])
    verts = mesh.vertices
    colors = np.zeros((len(verts), 4), dtype=np.uint8)
    colors[verts[:, 0] > 1.0] = [200, 120, 60, 255]  # warm end
    colors[verts[:, 0] <= 1.0] = [240, 240, 240, 255]
    colors[:, 3] = 255
    mesh.visual.vertex_colors = colors

    out = mesh_processing.orient_upright(mesh)
    extents = out.extents
    assert extents[1] > 2.5, f"height should align to +Y, got {extents}"
    assert extents[0] < 1.0, f"width should shrink after upright, got {extents}"
    assert abs(out.bounds[0][1]) < 1e-6, "feet must sit on y=0"

    y = out.vertices[:, 1]
    lo, hi = y.min(), y.max()
    top_colors = out.visual.vertex_colors[y > hi - 0.15 * (hi - lo)][:, :3]
    assert top_colors[:, 0].mean() > 150, "warm (red) end must point up"


def test_orient_upright_flips_cold_top():
    # Same box but warm at the -X tip: the flip must put the warm end up too.
    mesh = trimesh.creation.box(extents=[3.0, 0.5, 0.5])
    verts = mesh.vertices
    colors = np.zeros((len(verts), 4), dtype=np.uint8)
    colors[verts[:, 0] < -1.0] = [200, 120, 60, 255]
    colors[verts[:, 0] >= -1.0] = [240, 240, 240, 255]
    colors[:, 3] = 255
    mesh.visual.vertex_colors = colors

    out = mesh_processing.orient_upright(mesh)
    y = out.vertices[:, 1]
    lo, hi = y.min(), y.max()
    top_colors = out.visual.vertex_colors[y > hi - 0.15 * (hi - lo)][:, :3]
    assert top_colors[:, 0].mean() > 150, "warm end must point up regardless of input sign"
    assert abs(out.bounds[0][1]) < 1e-6


def test_orient_upright_front_faces_z():
    # Tall box with height along Z and warm colors on the +X end (the model's
    # photo-facing side). After orient: height on Y AND the warm "front" must
    # face world +Z (the convention the frontend yaws toward the camera).
    mesh = trimesh.creation.box(extents=[0.5, 0.5, 3.0])
    verts = mesh.vertices
    colors = np.zeros((len(verts), 4), dtype=np.uint8)
    colors[verts[:, 0] > 0.2] = [200, 120, 60, 255]
    colors[verts[:, 0] <= 0.2] = [240, 240, 240, 255]
    colors[:, 3] = 255
    mesh.visual.vertex_colors = colors

    out = mesh_processing.orient_upright(mesh)
    assert out.extents[1] > 2.5, f"height should align to +Y, got {out.extents}"
    assert abs(out.bounds[0][1]) < 1e-6

    z = out.vertices[:, 2]
    lo, hi = z.min(), z.max()
    front_colors = out.visual.vertex_colors[z > hi - 0.15 * (hi - lo)][:, :3]
    assert front_colors[:, 0].mean() > 150, "warm front must face +Z"


def test_flip_mesh_vertical_regrounds_and_reverses_height():
    mesh = trimesh.creation.box(extents=[1.0, 2.0, 1.0])
    mesh.apply_translation([0.0, 1.0, 0.0])
    colors = np.zeros((len(mesh.vertices), 4), dtype=np.uint8)
    colors[mesh.vertices[:, 1] > 1.5] = [220, 20, 20, 255]
    colors[mesh.vertices[:, 1] <= 1.5] = [20, 20, 220, 255]
    mesh.visual.vertex_colors = colors

    out = mesh_processing.flip_mesh_vertical(mesh.copy())

    assert abs(float(out.bounds[0][1])) < 1e-6
    y = np.asarray(out.vertices)[:, 1]
    top_colors = np.asarray(out.visual.vertex_colors)[y > y.max() - 0.1][:, :3]
    assert top_colors[:, 2].mean() > top_colors[:, 0].mean()
