"""Image decoding + foreground preparation tests."""

from __future__ import annotations

import base64
import io

import numpy as np
import pytest
from PIL import Image

from backend.services.image_utils import (
    ImageDecodeError,
    decode_image,
    prepare_foreground,
)


def _png_bytes(color=(255, 0, 0), size=(64, 48), alpha=None) -> bytes:
    mode = "RGBA" if alpha is not None else "RGB"
    img = Image.new(mode, size, (*color, alpha) if alpha is not None else color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_decode_image_plain_base64():
    payload = base64.b64encode(_png_bytes()).decode("ascii")
    img = decode_image(payload)
    assert img.size == (64, 48)


def test_decode_image_data_url():
    payload = "data:image/png;base64," + base64.b64encode(_png_bytes()).decode("ascii")
    img = decode_image(payload)
    assert img.size == (64, 48)


def test_decode_image_rejects_garbage():
    with pytest.raises(ImageDecodeError):
        decode_image("!!!not-base64!!!")
    with pytest.raises(ImageDecodeError):
        decode_image(base64.b64encode(b"not an image").decode("ascii"))
    with pytest.raises(ImageDecodeError):
        decode_image("")


def test_decode_image_rejects_oversized_payload(monkeypatch):
    from backend.services import image_utils as image_utils_module

    monkeypatch.setattr(image_utils_module, "MAX_IMAGE_BYTES", 100)
    payload = base64.b64encode(_png_bytes()).decode("ascii")
    assert len(payload) > 100
    with pytest.raises(ImageDecodeError, match="exceeds"):
        decode_image(payload)


def test_prepare_foreground_square_crop_and_resize():
    img = Image.open(io.BytesIO(_png_bytes(size=(120, 60)))).convert("RGBA")
    out = prepare_foreground(img, size=512)
    assert out.mode == "RGB"
    assert out.size == (512, 512)


def test_prepare_foreground_keeps_upload_alpha():
    # Fully transparent image → all pixels keep alpha 0 → white composite.
    rgba = Image.new("RGBA", (100, 100), (10, 10, 10, 0))
    out = prepare_foreground(rgba, size=128)
    arr = np.asarray(out)
    assert arr.shape == (128, 128, 3)
    assert arr.min() >= 250  # white canvas


def test_prepare_foreground_flood_fill_erases_border():
    # Object = bright center square on a dark border; flood fill should clear
    # the border and keep the center.
    img = np.full((100, 100, 3), 10, dtype=np.uint8)
    img[30:70, 30:70] = (200, 200, 200)
    out = prepare_foreground(Image.fromarray(img), size=128)
    arr = np.asarray(out)
    # Border of the output is white (background removed → composite).
    assert arr[0, 0].tolist() == [255, 255, 255]
    assert arr[127, 127].tolist() == [255, 255, 255]
    # Center stays the bright object color (approximately).
    center = arr[64, 64]
    assert center[0] > 150
