"""Image decoding + foreground preparation for the generative endpoints.

TripoSR reconstructs the *foreground object*, so input images benefit from
background removal. The reference pipeline uses ``rembg`` (a ~170 MB U²-Net
model); we do the same:

* ``decode_image`` — base64 data-URL → PIL image (with size guards).
* ``prepare_foreground`` — center-crop to square, remove the background with
  rembg (U²-Net), feather it, and composite onto a white canvas. Alpha-bearing
  uploads keep their own alpha.

The old dependency-free border flood-fill heuristic is kept as an offline
fallback (``_estimate_foreground_mask``) — rembg needs a model download on
first use, so if the session can't be created (no onnxruntime / no network /
no disk space) we degrade gracefully instead of failing the request. The
endpoint contract is unchanged either way.

The U²-Net weights land in ``U2NET_HOME`` (pinned to the project drive in
``backend/config.py`` — see knowledge.md "keep big downloads on G:").
"""

from __future__ import annotations

import base64
import binascii
import io
import logging
import re

import numpy as np
from PIL import Image, ImageFilter

from ..config import MAX_IMAGE_BYTES

logger = logging.getLogger(__name__)

_DATA_URL_RE = re.compile(r"^data:(?P<mime>[^;,]+)?(;base64)?,(?P<data>.*)$", re.DOTALL)


class ImageDecodeError(ValueError):
    """Raised when the uploaded base64 payload is not a decodable image."""


# --- rembg (U²-Net) session ------------------------------------------------
# Created lazily so imports, unit tests, and offline runs never trigger a
# ~170 MB model download. Once creation fails the error is cached so we don't
# hammer the network on every request; a process restart clears it.
_rembg_session = None
_rembg_error: Exception | None = None


def _get_rembg_session():
    """Return the shared U²-Net session, raising the cached failure if any."""
    global _rembg_session, _rembg_error
    if _rembg_session is not None:
        return _rembg_session
    if _rembg_error is not None:
        raise _rembg_error
    try:
        from rembg import new_session

        _rembg_session = new_session("u2net")
    except Exception as exc:  # missing onnxruntime / no network / download failure
        _rembg_error = exc
        logger.warning("rembg unavailable (%s); falling back to flood-fill heuristic", exc)
        raise
    return _rembg_session


def _rembg_remove(image: Image.Image) -> Image.Image:
    """Background-remove via rembg U²-Net; raises if the session is unavailable."""
    from rembg import remove

    session = _get_rembg_session()
    return remove(image, session=session, alpha_matting=False)


def decode_image(image_base64: str) -> Image.Image:
    """Decode a base64 (optionally data-URL) image payload into a PIL image."""
    if not isinstance(image_base64, str) or not image_base64.strip():
        raise ImageDecodeError("imageBase64 is required")

    raw = image_base64.strip()
    match = _DATA_URL_RE.match(raw)
    if match and match.group("data"):
        raw = match.group("data")
    elif match:
        # data:image/...;base64, with base64 marker — covered above; tolerate
        # URLs without the base64 marker by treating the body as base64 anyway.
        pass

    if len(raw) > MAX_IMAGE_BYTES:
        raise ImageDecodeError(f"image payload exceeds {MAX_IMAGE_BYTES // (2**20)} MiB limit")

    try:
        payload = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise ImageDecodeError("imageBase64 is not valid base64") from exc

    try:
        image = Image.open(io.BytesIO(payload))
        image.load()
    except Exception as exc:  # PIL raises several error types
        raise ImageDecodeError("imageBase64 is not a decodable image") from exc

    return image


def _estimate_foreground_mask(image: Image.Image, tolerance: int = 24) -> np.ndarray:
    """Flood-fill from the image borders to separate object from background.

    Returns a uint8 mask (0 = background, 255 = foreground) at the input size.

    This is the offline fallback used when rembg can't load its model. It is
    brittle for light objects on light backgrounds (the flood walks through
    soft shadows), which is exactly why rembg is the primary path.
    """
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    h, w = rgb.shape[:2]
    mask = np.full((h, w), 255, dtype=np.uint8)

    # Seed queue with border pixels. Each frontier entry carries the color it
    # hopped from, so the flood only grows across smoothly-connected background
    # regions and stops at hard object edges (chain BFS, one hop <= tolerance).
    tol = int(tolerance)
    frontier: list[tuple[int, int, int, int, int]] = []
    for y in range(h):
        for x in (0, w - 1):
            r, g, b = rgb[y, x]
            frontier.append((y, x, int(r), int(g), int(b)))
    for x in range(w):
        for y in (0, h - 1):
            r, g, b = rgb[y, x]
            frontier.append((y, x, int(r), int(g), int(b)))

    visited = np.zeros((h, w), dtype=bool)
    while frontier:
        y, x, r, g, b = frontier.pop()
        if visited[y, x]:
            continue
        visited[y, x] = True
        mask[y, x] = 0
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                nr, ng, nb = rgb[ny, nx]
                if abs(int(nr) - r) <= tol and abs(int(ng) - g) <= tol and abs(int(nb) - b) <= tol:
                    frontier.append((ny, nx, int(nr), int(ng), int(nb)))

    return mask


def _apply_fallback_mask(image: Image.Image) -> Image.Image:
    """Border flood-fill mask (offline fallback when rembg is unavailable)."""
    proxy = image.resize((256, 256), Image.LANCZOS)
    mask = _estimate_foreground_mask(proxy.convert("RGB"))
    mask = Image.fromarray(mask).resize(image.size, Image.BILINEAR)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2))
    rgba = np.asarray(image).copy()
    rgba[..., 3] = np.asarray(mask, dtype=np.uint8)
    return Image.fromarray(rgba)


def prepare_foreground(image: Image.Image, size: int = 512) -> Image.Image:
    """Center-crop to square, clear the background, return an RGB image."""
    image = image.convert("RGBA")

    # 1) Square center-crop.
    w, h = image.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    image = image.crop((left, top, left + side, top + side))

    # 2) Foreground mask: keep upload alpha when fully transparent regions
    #    exist, otherwise remove the background with rembg (U²-Net), falling
    #    back to the border flood-fill if the model isn't available.
    alpha = np.asarray(image)[..., 3]
    if alpha.min() >= 250:
        try:
            image = _rembg_remove(image).convert("RGBA")
        except Exception:
            logger.exception("rembg failed; using flood-fill fallback")
            image = _apply_fallback_mask(image)

    # 3) Composite onto white and resize to the model's input size.
    canvas = Image.new("RGBA", image.size, (255, 255, 255, 255))
    canvas.alpha_composite(image)
    return canvas.convert("RGB").resize((size, size), Image.LANCZOS)
