# EchoForge mesh backends

EchoForge keeps TripoSR as a safe fallback and can use an optional local Hunyuan3D-2GP sidecar for higher-quality single-image shape reconstruction.

## Why Hunyuan3D-2GP

- The full 1.1B Hunyuan3D-2 turbo shape model was tested on the project machine, an RTX 2070 with 8 GB VRAM.
- The isolated sidecar uses Hunyuan3D-2GP `mmgp` profile 4 and `mc` surface extraction, avoiding the optional `diso` C++ extension.
- A real chair request completed in 6.21 seconds and returned a valid 111,724-face, vertex-colored GLB before EchoForge post-processing.
- EchoForge still sanitizes, orients, regrounds, decimates, and validates the result at the existing 20,000-face cap.

## Local setup

The sidecar is intentionally outside the EchoForge Python environment because its CUDA dependencies conflict with the main backend. The tested layout is:

```text
G:\EchoForge_App\hunyuan3d-2gp
G:\hf-cache
G:\EchoForge_App\hunyuan3d-cache
```

The isolated environment was created with Python 3.10 and the repo's requirements, excluding only `diso` because the current machine does not have the MSVC C++ build toolchain. `scikit-image` provides the supported `mc` fallback.

Start it from Git Bash:

```bash
bash scripts/gpu/start_hunyuan_sidecar.sh
```

The first run downloads the model cache to `G:\hf-cache`. Do not run this sidecar concurrently with another heavy CUDA model unless the workload is explicitly coordinated. The EchoForge backend serializes its own model calls, but a separate sidecar is a separate process and therefore needs this operational constraint.

Start the normal backend with:

```bash
HF_HOME='G:\\hf-cache' .venv/Scripts/python.exe -m uvicorn backend.main:app --port 8000
```

`ECHOFORGE_MESH_BACKEND=auto` is the default. It selects Hunyuan when `http://127.0.0.1:8081/health` reports ready, and otherwise uses TripoSR. Set `ECHOFORGE_MESH_BACKEND=triposr` to force the baseline or `hunyuan` to require the sidecar.

## Licensing

Hunyuan3D-2 and Hunyuan3D-2GP are subject to Tencent's Hunyuan non-commercial/community license terms and the licenses of their dependencies. This path must not be used for commercial or public production work without reviewing and satisfying those terms. The sidecar is local-only and does not upload input images to an external service.

## Quality verification

For a model comparison, record the input fixture, backend and upstream revision, parameters, elapsed time, peak VRAM, raw and processed face counts, bounds, connected components, and a screenshot from the actual EchoForge viewport. A successful GLB response alone is not evidence of a good reconstruction.
