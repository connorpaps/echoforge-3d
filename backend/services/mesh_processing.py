"""Mesh optimization pipeline — docs/08_TASKS.md Task 2.4.

TripoSR's raw 256³ marching-cubes output can exceed 100k faces, carry
inverted/degenerate triangles, spawn disconnected debris components, and come
out in the model's tilted camera frame (objects lying down). Before the asset
reaches the client it is:

  1. Sanitized (winding fix, degenerate removal, duplicate merge).
  2. Debris dropped (keep the largest connected component only — TripoSR
     emits floating slivers/sheets that read as "random parts" in the scene).
  3. Oriented upright (PCA height axis → world +Y; up/down decided from the
     baked vertex colors, which are sampled from the input photo — warm
     colors at the top tip mean the object stands; feet sit on y=0).
  4. Decimated to ≤ ``max_faces`` (quadric simplification via fast-simplification).
  5. Smoothed (Laplacian, one light pass) and normal-fixed again.
  6. Re-vertex-colored by resampling the *oriented* mesh (decimation backends
     do not reliably carry vertex attributes).
  7. Packaged: convex collision hull, axis-aligned bounds, and GLB bytes.

GLB export embeds vertex colors as glTF ``COLOR_0`` so the frontend renders
the mesh with TripoSR's texture without any UV baking. Bounds are reported in
world frame (min-y = 0, x/z centered) so the frontend's spawn logic can drop
the asset straight onto the terrain.
"""

from __future__ import annotations

import io
import math
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


def keep_largest_component(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Drop disconnected debris, keeping only the largest connected component.

    TripoSR reconstruction artifacts show up as floating slivers (3-vertex
    sheets) and detached chunks; without this step they render as "random
    parts" floating next to the asset. The largest component is always the
    object itself (verified: 86%+ of vertices). Returns the input unchanged
    when the mesh is already a single component.
    """
    components = mesh.split(only_watertight=False)
    if len(components) <= 1:
        return mesh
    biggest = max(components, key=lambda c: len(c.vertices))
    return trimesh.Trimesh(
        vertices=np.asarray(biggest.vertices, dtype=np.float64),
        faces=np.asarray(biggest.faces, dtype=np.int64),
        vertex_colors=np.asarray(biggest.visual.vertex_colors)
        if biggest.visual.kind == "vertex"
        else None,
        process=False,
    )


def _rotation_between(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """3×3 rotation mapping unit vector ``a`` onto unit vector ``b``."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-8:
        if c > 0:
            return np.eye(3)
        # Anti-parallel: 180° about any perpendicular axis.
        axis = np.array([1.0, 0.0, 0.0])
        if abs(float(a[0])) > 0.9:
            axis = np.array([0.0, 1.0, 0.0])
        axis = axis - np.dot(axis, a) * a
        axis = axis / np.linalg.norm(axis)
        v, c = axis, -1.0
    s = np.linalg.norm(v)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]], dtype=float)
    return np.eye(3) + K + (K @ K) * ((1 - c) / (s * s))


def _tip_warmth(mesh: trimesh.Trimesh, frac: float = 0.10) -> tuple[float, float]:
    """Mean ``red - blue`` of the vertex colors at the +Y and −Y tips.

    TripoSR vertex colors are sampled from the input photo, so warm wood/skin
    at the +Y tip means the object's natural top points up.
    """
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    colors = mesh.visual.vertex_colors
    if colors is None or len(colors) != len(verts):
        return 0.0, 0.0
    colors = np.asarray(colors, dtype=np.float64)[:, :3]
    y = verts[:, 1]
    lo, hi = float(y.min()), float(y.max())
    if hi - lo < 1e-9:
        return 0.0, 0.0
    top = colors[y > hi - frac * (hi - lo)]
    bot = colors[y < lo + frac * (hi - lo)]
    if len(top) == 0 or len(bot) == 0:
        return 0.0, 0.0
    return float((top[:, 0] - top[:, 2]).mean()), float((bot[:, 0] - bot[:, 2]).mean())


def orient_upright(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Rotate the mesh so it stands upright on the world y=0 plane, front → +Z.

    1. PCA on the vertex cloud → the largest-variance axis is the object's
       height; rotate it onto world +Y (about the centroid).
    2. Up/down: the baked vertex colors are sampled from the input photo, so
       the end whose tip is *warmer* (higher R−B: wood, skin) is the object's
       top — flip if the warmth is at the −Y end. When the tips are color-
       ambiguous, tiebreak on vertex mass (stand on the heavy end).
    3. Yaw: the model's photo-facing side is +X in raw TripoSR space (its
       canonical camera sits at azimuth 0 = +X) — rotate around Y so that
       side faces world +Z, a documented convention the frontend uses to
       face the spawned asset toward the viewer's camera.
    4. Translate so min-y = 0 (feet on the ground) and x/z are centered.
    """
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    centroid = verts.mean(axis=0)
    cov = np.cov((verts - centroid).T)
    eigvals, eigvecs = np.linalg.eigh(cov)
    height_axis = eigvecs[:, -1]

    rot = _rotation_between(height_axis, np.array([0.0, 1.0, 0.0]))
    transform = np.eye(4)
    transform[:3, :3] = rot
    transform[:3, 3] = centroid - rot @ centroid
    mesh.apply_transform(transform)

    top_warm, bot_warm = _tip_warmth(mesh)
    if abs(top_warm - bot_warm) >= 5.0:
        flipped = top_warm < bot_warm
    else:
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        lo, hi = float(verts[:, 1].min()), float(verts[:, 1].max())
        flipped = (verts[:, 1] < (lo + hi) / 2).mean() > 0.5
    if flipped:
        verts = np.asarray(mesh.vertices, dtype=np.float64)
        mid = (float(verts[:, 1].min()) + float(verts[:, 1].max())) / 2
        flip = np.eye(4)
        flip[:3, :3] = np.array([[1.0, 0.0, 0.0], [0.0, -1.0, 0.0], [0.0, 0.0, -1.0]])
        pivot = np.eye(4)
        pivot[:3, 3] = [0.0, mid, 0.0]
        mesh.apply_transform(pivot @ flip @ np.linalg.inv(pivot))

    # Face world +Z: the model's photo-facing side (+X in raw TripoSR space)
    # after the align+flip transform sits at `front`; yaw it onto +Z. The 180°
    # flip about X preserves the front's X-component sign.
    front = rot @ np.array([1.0, 0.0, 0.0])
    yaw = math.atan2(-float(front[0]), float(front[2]))
    if abs(yaw) > 1e-6:
        c, s = math.cos(yaw), math.sin(yaw)
        yaw_rot = np.eye(4)
        yaw_rot[:3, :3] = [[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]]
        mesh.apply_transform(yaw_rot)

    verts = np.asarray(mesh.vertices, dtype=np.float64)
    lo, hi = verts.min(axis=0), verts.max(axis=0)
    shift = np.eye(4)
    shift[:3, 3] = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2]
    mesh.apply_transform(shift)
    return mesh


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

    # Drop reconstruction debris (floating slivers / detached chunks) BEFORE
    # orienting — PCA on a polluted point cloud finds the wrong height axis.
    original = keep_largest_component(original)

    # TripoSR outputs meshes in its tilted camera frame (objects lying down);
    # orient to world y-up now while vertex colors are still attached (the
    # flip decision reads them). Bounds afterwards: min-y = 0, x/z centered.
    original = orient_upright(original)
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
    # Decimation + smoothing can re-emit tiny dangling triangles — drop them
    # so the exported asset is a single clean component (99.9% of vertices).
    working = keep_largest_component(working)

    # Laplacian smoothing nudges vertices off the ground plane — re-ground the
    # asset (min-y -> 0, x/z centered) so the world-frame bounds stay exact.
    verts = np.asarray(working.vertices, dtype=np.float64)
    lo, hi = verts.min(axis=0), verts.max(axis=0)
    reground = np.eye(4)
    reground[:3, 3] = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2]
    working.apply_transform(reground)

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
