"""Mesh optimization pipeline — docs/08_TASKS.md Task 2.4.

TripoSR's raw 256³ marching-cubes output can exceed 100k faces and carry
inverted/degenerate triangles. Before the asset reaches the client it is:

  1. Sanitized (winding fix, degenerate removal, duplicate merge).
  2. Decimated to ≤ ``max_faces`` (quadric simplification via fast-simplification).
  3. Smoothed (Laplacian, one light pass) and normal-fixed again.
  4. Re-vertex-colored by resampling the *original* mesh (decimation backends
     do not reliably carry vertex attributes).
  5. Packaged: convex collision hull, axis-aligned bounds, and GLB bytes.

GLB export embeds vertex colors as glTF ``COLOR_0`` so the frontend renders
the mesh with TripoSR's texture without any UV baking.
"""

from __future__ import annotations

import io
from typing import Any, Callable

import numpy as np
import trimesh

from ..config import MESH_MAX_FACES

ProgressCallback = Callable[[str, int, str], None]


def _noop_progress(stage: str, percent: int, message: str) -> None:  # pragma: no cover
    pass


def resample_vertex_colors(original: trimesh.Trimesh, target_vertices: np.ndarray) -> np.ndarray | None:
    """Copy vertex colors from ``original`` onto ``target_vertices``.

    Uses a scipy KD-tree nearest-*vertex* lookup (no native deps like
    ``rtree``). Decimated vertices sit on collapsed original edges, so the
    nearest original vertex's colour is visually indistinguishable from a
    surface point sample for TripoSR's smooth per-vertex colour fields.
    """
    colors = original.visual.vertex_colors
    if original.visual.kind != "vertex" or colors is None or len(colors) != len(original.vertices):
        return None

    from scipy.spatial import cKDTree

    tree = cKDTree(np.asarray(original.vertices, dtype=np.float64))
    _dist, nearest = tree.query(np.asarray(target_vertices, dtype=np.float64), k=1)
    return np.clip(np.asarray(colors)[nearest], 0, 255).astype(np.uint8)


def sanitize_mesh(mesh: trimesh.Trimesh, vertex_colors: np.ndarray | None = None) -> trimesh.Trimesh:
    """Remove degenerate faces, merge duplicate vertices, fix winding.

    ``vertex_colors`` (indexed by the *input* mesh's vertices) are carried
    through ``process()`` — trimesh remaps them when it merges vertices.
    """
    mesh = trimesh.Trimesh(
        vertices=np.asarray(mesh.vertices, dtype=np.float64),
        faces=np.asarray(mesh.faces, dtype=np.int64),
        vertex_colors=np.asarray(vertex_colors) if vertex_colors is not None else None,
        process=True,
    )
    if len(mesh.faces) == 0:
        raise ValueError("mesh has no faces after sanitization")
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()
    mesh.fix_normals()
    return mesh


def decimate_mesh(mesh: trimesh.Trimesh, max_faces: int) -> trimesh.Trimesh:
    """Quadric edge-collapse decimation down to ``max_faces`` faces."""
    if len(mesh.faces) <= max_faces:
        return mesh
    try:
        # NOTE: trimesh's signature is (percent, face_count, aggression) — the
        # first positional arg is a *reduction fraction*, so pass face_count by
        # keyword to avoid a bogus target_reduction ValueError.
        simplified = mesh.simplify_quadric_decimation(face_count=max_faces)
    except ValueError as exc:  # backend (fast-simplification/open3d) unavailable
        raise RuntimeError(
            "quadric decimation backend unavailable — install fast-simplification"
        ) from exc
    if simplified is None or len(simplified.faces) == 0:
        raise RuntimeError("decimation produced an empty mesh")
    return simplified


def compute_convex_hulls(mesh: trimesh.Trimesh) -> list[dict[str, Any]]:
    """Per-component convex hulls for physics colliders (AGENTS.md #5)."""
    hulls: list[dict[str, Any]] = []
    for component in mesh.split(only_watertight=False):
        try:
            hull = component.convex_hull
        except Exception:  # noqa: BLE001 — degenerate geometry: skip hull
            continue
        if hull is None or len(hull.faces) == 0:
            continue
        hulls.append(
            {
                "vertices": np.asarray(hull.vertices, dtype=np.float32).tolist(),
                "faces": np.asarray(hull.faces, dtype=np.int32).tolist(),
            }
        )
    return hulls


def process_mesh(
    mesh: trimesh.Trimesh,
    max_faces: int = MESH_MAX_FACES,
    progress: ProgressCallback | None = None,
) -> dict[str, Any]:
    """Full optimization pipeline. Returns GLB bytes + asset metadata."""
    progress = progress or _noop_progress
    progress("DECIMATION", 0, "sanitizing mesh")

    # Capture colors *before* any deduplication so they stay index-aligned.
    raw_colors = (
        np.asarray(mesh.visual.vertex_colors, dtype=np.uint8).copy()
        if mesh.visual.kind == "vertex"
        else None
    )
    original = sanitize_mesh(mesh, raw_colors)
    original_colors = (
        np.asarray(original.visual.vertex_colors, dtype=np.uint8).copy()
        if original.visual.kind == "vertex" and len(original.visual.vertex_colors) == len(original.vertices)
        else None
    )

    progress("DECIMATION", 20, f"decimating {len(original.faces)} faces")
    working = decimate_mesh(original, max_faces)

    progress("DECIMATION", 55, "smoothing surface")
    # One light Laplacian pass; keep the shape, drop faceting artifacts.
    if len(working.faces) > 4:
        try:
            trimesh.smoothing.filter_laplacian(working, iterations=1, lamb=0.4)
        except Exception:  # noqa: BLE001 — smoothing is best-effort
            pass
    working = sanitize_mesh(working)

    # Re-attach colors by resampling the original surface (robust to vertex
    # reindexing from decimation + sanitization).
    if original_colors is not None and len(working.vertices):
        sampled = resample_vertex_colors(original, working.vertices)
        if sampled is not None and len(sampled) == len(working.vertices):
            working.visual.vertex_colors = sampled

    progress("DECIMATION", 80, "baking collision hull")
    hulls = compute_convex_hulls(working)

    bounds_min = np.asarray(working.bounds[0], dtype=np.float32).tolist()
    bounds_max = np.asarray(working.bounds[1], dtype=np.float32).tolist()
    extents = np.asarray(working.extents, dtype=np.float32).tolist()
    center = np.asarray(working.bounding_box.centroid, dtype=np.float32).tolist()

    progress("DECIMATION", 95, "exporting GLB")
    glb_bytes = working.export(file_type="glb")

    return {
        "glbBase64": _encode_glb(glb_bytes),
        "glbSizeBytes": len(glb_bytes),
        "faceCount": len(working.faces),
        "vertexCount": len(working.vertices),
        "bounds": {
            "min": bounds_min,
            "max": bounds_max,
            "center": center,
            "size": extents,
        },
        "collisionHulls": hulls,
    }


def _encode_glb(glb_bytes: bytes) -> str:
    import base64

    return base64.b64encode(glb_bytes).decode("ascii")


def glb_data_url(glb_base64: str) -> str:
    """Wrap GLB bytes into a client-loadable data URL."""
    return f"data:model/gltf-binary;base64,{glb_base64}"


def decode_glb_bytes(glb_base64: str) -> bytes:
    import base64

    return base64.b64decode(glb_base64)


def validate_glb(glb_bytes: bytes) -> bool:
    """Cheap structural validation: magic header + chunk lengths."""
    if len(glb_bytes) < 20:
        return False
    if glb_bytes[:4] != b"glTF":
        return False
    (version,) = np.frombuffer(glb_bytes[4:8], dtype="<u4")
    (length,) = np.frombuffer(glb_bytes[8:12], dtype="<u4")
    if version != 2:
        return False
    return length == len(glb_bytes)
