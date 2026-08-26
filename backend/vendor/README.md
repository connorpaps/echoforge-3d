# Vendored Third-Party Code

## `tsr/` — TripoSR inference package (Apache-2.0)

Vendored from [VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR)
at commit `5b52193` (2024-08-28, matches the cached `stabilityai/TripoSR`
HF snapshot) so the backend runs hermetically without a git install step.

Patches applied (documented inline):
- `models/isosurface.py` — `torchmcubes` import now tries the real package
  first and falls back to `echoforge.shims.torchmcubes_stub` (PyMCubes /
  skimage marching cubes) when the CUDA build is unavailable (Windows).
- `system.py` — three FP16-compatibility casts: the preprocessed image is
  cast to the model dtype in `forward`, and the marching-cubes `grid_vertices`
  + MC output are cast to the scene-code dtype in `extract_mesh` (fp32 grid
  vs fp16 decoder previously raised a dtype mismatch).
- `utils.py` — `rembg` import made lazy (heavy optional dependency; the
  backend does its own lightweight foreground preparation).
