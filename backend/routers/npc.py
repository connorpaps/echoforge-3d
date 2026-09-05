"""Vision-aware NPC dialogue endpoint (Task 3.3).

POST /api/v1/npc-dialogue — viewport frame (base64) + persona → dialogue text.

The frame is captured client-side from the WebGL canvas and decoded server-side
before any GPU work is reserved. GPU inference routes through the
SequentialVRAMManager (``smolvlm`` slot); when SmolVLM is unavailable the
service returns a deterministic fallback line (``synthetic=true``).
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Callable

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..config import API_V1_PREFIX, MAX_PROMPT_CHARS
from ..rate_limit import rate_limited
from ..services import smolvlm_service
from ..services.image_utils import ImageDecodeError, decode_image
from ..services.progress_bus import progress_bus
from ..services.vram_manager import vram_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_V1_PREFIX, tags=["npc"])

ProgressCallback = Callable[[str, int, str], None]


class NpcDialogueRequest(BaseModel):
    frameBase64: str = Field(min_length=1, description="base64 or data-URL PNG frame")
    persona: str = Field(default=smolvlm_service.DEFAULT_PERSONA, max_length=MAX_PROMPT_CHARS)


class NpcDialogueResponse(BaseModel):
    jobId: str
    dialogueText: str
    synthetic: bool
    elapsedMs: int


async def npc_dialogue(request: NpcDialogueRequest) -> NpcDialogueResponse:
    job_id = uuid.uuid4().hex[:12]
    started = time.monotonic()

    def report(stage: str, percent: int, message: str) -> None:
        progress_bus.publish_sync(
            {"jobId": job_id, "stage": stage, "percent": int(percent), "message": message}
        )

    # Validate the payload before reserving any GPU time.
    try:
        decode_image(request.frameBase64)
    except ImageDecodeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        report("NPC", 0, "queued for vision model")
        dialogue_text, synthetic = await vram_manager.run(
            "smolvlm",
            smolvlm_service.smolvlm_service.dialogue,
            request.frameBase64,
            request.persona,
            report,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("npc-dialogue failed (job %s)", job_id)
        report("NPC", 0, "NPC dialogue failed")
        raise HTTPException(status_code=500, detail="NPC dialogue failed") from exc

    elapsed_ms = int((time.monotonic() - started) * 1000)
    report("NPC", 100, "response ready")
    return NpcDialogueResponse(
        jobId=job_id,
        dialogueText=dialogue_text,
        synthetic=synthetic,
        elapsedMs=elapsed_ms,
    )


@router.post("/npc-dialogue", response_model=NpcDialogueResponse)
@rate_limited
async def _npc_dialogue_http(request: Request, payload: NpcDialogueRequest) -> NpcDialogueResponse:
    return await npc_dialogue(payload)
