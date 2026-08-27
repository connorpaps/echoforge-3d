"""Live API battery for Phase 3 — run against the real GPU backend on :8000.

Covers: /health, /api/v1/generate-audio (WAV contract, duration, seamless
loop, synthetic flag), /api/v1/npc-dialogue (fallback + validation),
/api/v1/generate-texture (PNG), /api/v1/generate-mesh (REAL TripoSR on CUDA →
valid GLB, face budget, world-frame bounds, vertex colors), the live
WebSocket progress stream, and the VRAM ceiling after the GPU jobs.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import threading
import time
import wave

import httpx
import numpy as np
import trimesh
import websockets
from PIL import Image

BASE = "http://127.0.0.1:8000"
WS = "ws://127.0.0.1:8000/ws/progress"

results: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, bool(cond), detail))
    print(("  PASS " if cond else "  FAIL ") + name + (f"  [{detail}]" if detail else ""))


def frame_data_url() -> str:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (70, 120, 200)).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> None:
    print("== /health ==")
    r = httpx.get(f"{BASE}/health", timeout=15)
    body = r.json()
    check("health status ok", body["status"] == "ok")
    check(
        "cuda available",
        body["cuda"]["available"],
        body["cuda"].get("deviceName") or "no gpu",
    )

    print("== generate-audio (real endpoint, procedural fallback path) ==")
    r = httpx.post(
        f"{BASE}/api/v1/generate-audio",
        json={"prompt": "wind through pine trees", "durationSec": 3, "seed": 7},
        timeout=120,
    )
    check("audio 200", r.status_code == 200, r.text[:120] if r.status_code != 200 else "")
    check("audio content-type audio/wav", r.headers.get("content-type", "").startswith("audio/wav"))
    check(
        "audio synthetic flag present",
        r.headers.get("x-echoforge-synthetic") in ("true", "false"),
        r.headers.get("x-echoforge-synthetic", ""),
    )
    check("audio job header", bool(r.headers.get("x-echoforge-job")))
    with wave.open(io.BytesIO(r.content), "rb") as w:
        rate = w.getframerate()
        n = w.getnframes()
        channels = w.getnchannels()
        sampwidth = w.getsampwidth()
        raw = w.readframes(n)
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32767.0
    dur = n / rate
    check("audio 16kHz mono 16-bit", rate == 16000 and channels == 1 and sampwidth == 2)
    check("audio duration ~= 3s", abs(dur - 3.0) < 0.05, f"{dur:.3f}s")
    seam = abs(float(samples[-1]) - float(samples[0]))
    check("audio seamless loop (seam < 0.02)", seam < 0.02, f"seam={seam:.4f}")
    mid = float(np.max(np.abs(samples)))
    check("audio audible (peak > 0.1)", mid > 0.1, f"peak={mid:.3f}")

    print("== npc-dialogue (SmolVLM fallback path) ==")
    r = httpx.post(
        f"{BASE}/api/v1/npc-dialogue",
        json={"frameBase64": frame_data_url(), "persona": "be terse"},
        timeout=120,
    )
    nb = r.json() if r.status_code == 200 else {}
    check("npc 200", r.status_code == 200, r.text[:120] if r.status_code != 200 else "")
    check("npc returns dialogue text", len(nb.get("dialogueText", "")) > 10, nb.get("dialogueText", "")[:60])
    check("npc marks fallback synthetic", nb.get("synthetic") is True)
    check("npc jobId", bool(nb.get("jobId")))
    r = httpx.post(f"{BASE}/api/v1/npc-dialogue", json={"frameBase64": "not base64!!"}, timeout=30)
    check("npc rejects garbage frame (400)", r.status_code == 400)
    r = httpx.post(f"{BASE}/api/v1/npc-dialogue", json={"persona": "x"}, timeout=30)
    check("npc requires frame (422)", r.status_code == 422)

    print("== generate-texture (real SDXL-Turbo on CUDA) ==")
    r = httpx.post(
        f"{BASE}/api/v1/generate-texture",
        json={"prompt": "ancient stone castle at dusk", "seed": 42},
        timeout=240,
    )
    tb = r.json() if r.status_code == 200 else {}
    check("texture 200", r.status_code == 200, r.text[:120] if r.status_code != 200 else "")
    if tb.get("imageBase64"):
        png = base64.b64decode(tb["imageBase64"])
        check("texture is PNG", png[:8] == b"\x89PNG\r\n\x1a\n")
        check("texture non-trivial size", len(png) > 10_000, f"{len(png)} bytes")
    check("texture echoes seed", tb.get("seed") == 42)
    check("texture elapsed > 0", tb.get("elapsedMs", 0) > 0, f"{tb.get('elapsedMs')}ms")

    print("== generate-mesh (REAL TripoSR on CUDA) ==")
    with open("e2e/fixtures/concept.png", "rb") as f:
        img = base64.b64encode(f.read()).decode("ascii")
    started = time.monotonic()
    r = httpx.post(
        f"{BASE}/api/v1/generate-mesh",
        json={"prompt": "concept art", "imageBase64": img},
        timeout=420,
    )
    wall = time.monotonic() - started
    mb = r.json() if r.status_code == 200 else {}
    check("mesh 200", r.status_code == 200, r.text[:200] if r.status_code != 200 else "")
    if r.status_code == 200:
        glb = base64.b64decode(mb["glbUrl"].split(",", 1)[1])
        mesh = trimesh.load(io.BytesIO(glb), file_type="glb", force="mesh")
        check("mesh decimated <= 20k faces", mesh.faces.shape[0] <= 20000, f"{mesh.faces.shape[0]} faces")
        check("mesh has real geometry", mesh.vertices.shape[0] > 500, f"{mesh.vertices.shape[0]} verts")
        bounds = mb["bounds"]
        check("mesh regrounded (min-y ~ 0)", abs(bounds["min"][1]) < 0.005, f"min-y={bounds['min'][1]:.4f}")
        parts = mesh.split()
        check("mesh single component", len(parts) == 1, f"{len(parts)} components")
        # TripoSR GLBs carry COLOR_0 vertex colors with no material — verify in
        # the GLB JSON directly (trimesh's Scene/visual aggregation is lossy).
        gltf_json = json.loads(
            glb[20 : 20 + int.from_bytes(glb[12:16], "little")].decode("utf-8", "replace")
        )
        has_color = any(
            "COLOR_0" in prim.get("attributes", {})
            for mesh_def in gltf_json.get("meshes", [])
            for prim in mesh_def.get("primitives", [])
        )
        check("mesh carries COLOR_0 vertex colors", has_color)
        check(
            "mesh report matches",
            mb["faceCount"] == mesh.faces.shape[0] and mb["vertexCount"] == mesh.vertices.shape[0],
        )
        print(f"      wall {wall:.1f}s · server {mb['elapsedMs']}ms · {mb['glbSizeBytes']} bytes")

    print("== VRAM ceiling after GPU jobs ==")
    r = httpx.get(f"{BASE}/health", timeout=15)
    vram = r.json()["cuda"]["vramReservedMB"]
    check("vram reserved < 6 GB ceiling", vram < 6144, f"{vram / 1024:.2f} GB")

    print("== WebSocket live progress (audio job) ==")
    check("ws progress stream", asyncio.run(ws_audio()), "AUDIO ticks + DONE")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n=== {passed}/{len(results)} live API checks passed ===")
    if passed != len(results):
        raise SystemExit(1)


async def ws_audio() -> bool:
    """Subscribe to /ws/progress while a generate-audio job runs live."""
    captured: dict = {}
    stage_events: list[str] = []
    all_events: list[dict] = []

    def fire() -> None:
        resp = httpx.post(
            f"{BASE}/api/v1/generate-audio",
            json={"prompt": "rain on a tent", "durationSec": 2},
            timeout=120,
        )
        captured["job"] = resp.headers.get("x-echoforge-job", "")
        captured["status"] = resp.status_code

    try:
        async with websockets.connect(WS) as ws:
            thread = threading.Thread(target=fire)
            thread.start()
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                try:
                    event = json.loads(await asyncio.wait_for(ws.recv(), timeout=15))
                except asyncio.TimeoutError:
                    # The server publishes events DURING the POST, so they can
                    # arrive before the response sets captured["job"]. If the
                    # job is already known, nothing more is coming.
                    if captured.get("job"):
                        break
                    continue
                # Buffer every event until we know our jobId, then filter.
                if not captured.get("job"):
                    all_events.append(event)
                    continue
                if event.get("jobId") == captured.get("job"):
                    stage_events.append(event["stage"])
                    if event["stage"] == "DONE":
                        break
    except Exception as exc:  # noqa: BLE001
        print(f"      ws error: {exc}")
        return False
    thread.join(timeout=30)
    job = captured.get("job", "")
    # Events buffered before the response may already be ours.
    mine = [e for e in all_events if e.get("jobId") == job or not job]
    stage_events = stage_events or [e["stage"] for e in mine]
    ok_status = captured.get("status") == 200
    has_audio = "AUDIO" in stage_events
    ends_done = bool(stage_events) and stage_events[-1] == "DONE"
    print(f"      stages={stage_events} · job_status={captured.get('status')}")
    return ok_status and has_audio and ends_done


if __name__ == "__main__":
    main()
