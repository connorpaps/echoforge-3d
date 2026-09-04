"""Generation endpoints.

POST /api/v1/generate-mesh      — image (base64) → optimized GLB asset
POST /api/v1/generate-texture   — prompt → SDXL-Turbo PNG
POST /api/v1/generate-audio     — prompt → loopable WAV (AudioGen / fallback)

All route GPU work through the SequentialVRAMManager (serial, one model
resident at a time) and publish live progress events to the WebSocket channel.
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import time
import uuid
from typing import Callable

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..config import (
    API_V1_PREFIX,
    AUDIO_DURATION_DEFAULT,
    MESH_BACKEND,
    MAX_AUDIO_SECONDS,
    MESH_MAX_FACES,
    MESH_RESOLUTION,
    MAX_PROMPT_CHARS,
    SDXL_GUIDANCE,
    SDXL_SIZE,
    SDXL_STEPS,
)
from ..services import audio_service, hunyuan_service, mesh_processing, sdxl_service, tsr_service
from ..services.image_utils import ImageDecodeError, decode_image
from ..services.progress_bus import progress_bus
from ..services.vram_manager import vram_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_V1_PREFIX, tags=["generate"])

ProgressCallback = Callable[[str, int, str], None]


# --- request / response models -------------------------------------------------

class GenerateMeshRequest(BaseModel):
    prompt: str = Field(default="", max_length=MAX_PROMPT_CHARS)
    imageBase64: str = Field(min_length=1, description="base64 or data-URL encoded image")
    resolution: int = Field(default=MESH_RESOLUTION, ge=64, le=512)
    maxFaces: int = Field(default=MESH_MAX_FACES, ge=500, le=50000)


class GenerateMeshResponse(BaseModel):
    jobId: str
    glbUrl: str
    bounds: dict
    faceCount: int
    vertexCount: int
    glbSizeBytes: int
    elapsedMs: int


class GenerateTextureRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_CHARS)
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)
    steps: int = Field(default=SDXL_STEPS, ge=1, le=4)
    size: int = Field(default=SDXL_SIZE, ge=256, le=1024)


class GenerateAudioRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=MAX_PROMPT_CHARS)
    durationSec: float = Field(
        default=AUDIO_DURATION_DEFAULT, ge=1.0, le=MAX_AUDIO_SECONDS
    )
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)


class GenerateTextureResponse(BaseModel):
    jobId: str
    imageBase64: str
    seed: int | None
    elapsedMs: int


# --- helpers -------------------------------------------------------------------

def _new_job() -> str:
    return uuid.uuid4().hex[:12]


def _make_progress(job_id: str) -> ProgressCallback:
    def report(stage: str, percent: int, message: str) -> None:
        progress_bus.publish_sync(
            {"jobId": job_id, "stage": stage, "percent": int(percent), "message": message}
        )

    return report


def _publish_terminal(job_id: str, event: dict) -> None:
    progress_bus.publish_sync({"jobId": job_id, **event})


async def _select_mesh_backend() -> str:
    """Select Hunyuan only when explicitly requested or healthy in auto mode."""
    if MESH_BACKEND == "hunyuan":
        return "hunyuan"
    if MESH_BACKEND == "auto" and await asyncio.to_thread(hunyuan_service.hunyuan_service.is_available):
        return "hunyuan"
    return "triposr"


# --- endpoints ------------------------------------------------------------------

@router.post("/generate-mesh", response_model=GenerateMeshResponse)
async def generate_mesh(request: GenerateMeshRequest) -> GenerateMeshResponse:
    job_id = _new_job()
    report = _make_progress(job_id)
    started = time.monotonic()

    # Validate the payload before reserving any GPU time.
    try:
        decode_image(request.imageBase64)
    except ImageDecodeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        backend_name = await _select_mesh_backend()
        if backend_name == "hunyuan":
            extract = hunyuan_service.hunyuan_service.extract
        else:
            extract = tsr_service.tsr_service.extract
        report("RECONSTRUCTION", 0, f"queued for GPU ({backend_name})")
        mesh = await vram_manager.run(
            backend_name,
            extract,
            _image_bytes(request.imageBase64),
            request.resolution,
            report,
        )
        processed = await asyncio.to_thread(
            mesh_processing.process_mesh,
            mesh,
            request.maxFaces,
            report,
            backend_name == "hunyuan",
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — surface as a 500 with a progress ERROR
        logger.exception("generate-mesh failed (job %s)", job_id)
        _publish_terminal(job_id, {"stage": "ERROR", "percent": 0, "message": str(exc)})
        raise HTTPException(status_code=500, detail=f"mesh generation failed: {exc}") from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    _publish_terminal(
        job_id,
        {
            "stage": "DONE",
            "percent": 100,
            "message": f"mesh ready — {processed['faceCount']} faces in {elapsed_ms} ms",
        },
    )
    return GenerateMeshResponse(
        jobId=job_id,
        glbUrl=mesh_processing.glb_data_url(processed["glbBase64"]),
        bounds=processed["bounds"],
        faceCount=processed["faceCount"],
        vertexCount=processed["vertexCount"],
        glbSizeBytes=processed["glbSizeBytes"],
        elapsedMs=elapsed_ms,
    )


@router.post("/generate-texture", response_model=GenerateTextureResponse)
async def generate_texture(request: GenerateTextureRequest) -> GenerateTextureResponse:
    job_id = _new_job()
    report = _make_progress(job_id)
    started = time.monotonic()

    try:
        report("DIFFUSION", 0, "queued for GPU")
        png_bytes = await vram_manager.run(
            "sdxl-turbo",
            sdxl_service.sdxl_service.generate,
            request.prompt,
            request.steps,
            SDXL_GUIDANCE,
            request.seed,
            request.size,
            report,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("generate-texture failed (job %s)", job_id)
        _publish_terminal(job_id, {"stage": "ERROR", "percent": 0, "message": str(exc)})
        raise HTTPException(status_code=500, detail=f"texture generation failed: {exc}") from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    _publish_terminal(job_id, {"stage": "DONE", "percent": 100, "message": f"texture ready in {elapsed_ms} ms"})
    return GenerateTextureResponse(
        jobId=job_id,
        imageBase64=base64.b64encode(png_bytes).decode("ascii"),
        seed=request.seed,
        elapsedMs=elapsed_ms,
    )


@router.post("/generate-audio")
async def generate_audio(request: GenerateAudioRequest) -> StreamingResponse:
    job_id = _new_job()
    report = _make_progress(job_id)
    started = time.monotonic()

    try:
        report("AUDIO", 0, "queued for GPU")
        wav_bytes, synthetic = await vram_manager.run(
            "audiogen",
            audio_service.audio_service.generate,
            request.prompt,
            request.durationSec,
            request.seed,
            report,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("generate-audio failed (job %s)", job_id)
        _publish_terminal(job_id, {"stage": "ERROR", "percent": 0, "message": str(exc)})
        raise HTTPException(status_code=500, detail=f"audio generation failed: {exc}") from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    _publish_terminal(
        job_id,
        {"stage": "DONE", "percent": 100, "message": f"audio ready in {elapsed_ms} ms"},
    )
    # The wav is returned as a binary stream (docs/04_API_CONTRACTS.md). The
    # synthetic flag lets the frontend label fallback audio honestly.
    return StreamingResponse(
        io.BytesIO(wav_bytes),
        media_type="audio/wav",
        headers={
            "X-EchoForge-Synthetic": "true" if synthetic else "false",
            "X-EchoForge-Job": job_id,
        },
    )


def _image_bytes(image_base64: str) -> bytes:
    """Strip an optional data-URL prefix and return raw image bytes."""
    body = image_base64.strip()
    if body.startswith("data:"):
        body = body.split(",", 1)[1]
    return base64.b64decode(body)
