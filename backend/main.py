"""EchoForge 3D — FastAPI AI microservice entrypoint.

Run (dev):
    uvicorn backend.main:app --reload --port 8000

The app exposes:
    GET  /health                 CUDA device + VRAM snapshot
    POST /api/v1/generate-mesh   image → optimized GLB asset
    POST /api/v1/generate-texture prompt → SDXL-Turbo PNG
    WS   /ws/progress            live DIFFUSION/RECONSTRUCTION/DECIMATION ticks

All GPU work is serialized through the SequentialVRAMManager (backend/
services/vram_manager.py) so no two heavy models are ever resident together.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .routers import generate, health, progress

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

APP_VERSION = "0.2.0"


def create_app() -> FastAPI:
    app = FastAPI(
        title="EchoForge 3D AI Microservice",
        description="Sequential-VRAM generative backend (TripoSR, SDXL-Turbo).",
        version=APP_VERSION,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in CORS_ORIGINS if origin.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(generate.router)
    app.include_router(progress.router)

    logger.info("EchoForge backend v%s ready — routers: health, generate, progress", APP_VERSION)
    return app


app = create_app()
