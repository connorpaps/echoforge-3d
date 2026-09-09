# EchoForge 3D capability matrix

This matrix describes the focused local v1 release target. EchoForge selects a
small set of Hugging Face task families that serve one worldbuilding workflow;
it is not intended to cover the entire model catalog. “Implemented” means the
path exists in the application and has a local test seam; it does not promise
model quality or a production deployment.

| Capability | Status | Runtime boundary | Verification / caveat |
|---|---|---|---|
| 2D topographic sketch → 3D terrain | Implemented | Browser canvas, depth worker, Three.js/R3F | Frontend unit and Playwright fixture coverage; real WebGPU still hardware-dependent |
| Image → mesh via TripoSR | Implemented baseline | Local FastAPI backend, Hugging Face cache | Requires downloaded weights; CPU is slow |
| Image → mesh via Hunyuan3D-2GP | Optional | Separate local sidecar on `127.0.0.1:8081` | Requires separate environment, GPU, and license review; not redistributed |
| Texture generation via SDXL-Turbo | Applied local path | Backend, serial GPU slot, selected mesh material bridge | Requires weights; preview, apply-to-selected, and local persistence are implemented; full UV/PBR baking remains out of scope |
| Prompt → loopable audio | Implemented with fallback | AudioGen backend or procedural fallback | AudioGen is optional; output quality depends on weights |
| Vision-assisted NPC dialogue | Implemented with fallback | SmolVLM backend | `qwen-vl-utils` and weights required for model path; canned fallback otherwise |
| Push-to-talk voice input | Implemented | Browser speech worker + voice pill | Transcription only; model may be gated and browser-cached |
| Voice-assisted scene generation | Prompt-assisted | Transcription feeds the existing prompt/generation flow | No structured command parser or guaranteed JSON scene operation |
| In-browser NPC TTS | Implemented local path | Kokoro worker in browser | First-run model download and browser support required |
| First-person terrain walk | Implemented | Browser R3F/Rapier viewport | Software-rendered CI checks interaction contracts only |
| Standalone HTML / GLTF export | Implemented | Browser export path | Validate exported assets in a target browser/engine |
| REST API + progress WebSocket | Implemented | FastAPI on localhost | Expensive POST routes default to `10/minute` per client (`ECHOFORGE_GENERATION_RATE_LIMIT`); `/ws/progress?jobId=...` receives only that job, while legacy unfiltered clients receive the stream; no production auth |
| Hermetic E2E | Implemented | Playwright + SwiftShader + fixture workers + valid GLB fixture | Proves the generation bridge, loader, Scene tree, and inspector without model downloads; not a CUDA/WebGPU quality test |
| First-run diagnostics and launcher | Implemented | `scripts/doctor.py`, `scripts/start_local.py` | Starts frontend/backend together; Hunyuan remains explicit because it is heavyweight and separately managed |
| Provider readiness panel | Implemented | Live `/health` data in the workstation left drawer | Shows selected mesh provider, optional paths, browser workers, and explicit fallbacks without loading model weights |
| Multi-user hosted deployment | Not in release scope | None | Authentication, durable jobs, tenancy, and public ingress are not implemented |

## Test baseline

At the current checked-out baseline: **158 frontend unit tests across 36 files**,
**89 core backend tests, 2 downloader tests, and 9 setup/launcher tests passed**,
and **22 hermetic Playwright journeys passed**. GPU-only backend assertions may skip on a
CPU-only runner. Keep historical milestone counts in planning documents as
historical; update release-facing totals only from a fresh test run.
