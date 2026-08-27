"""WebSocket progress channel — docs/08_TASKS.md Task 2.5.

Clients connect to ``/ws/progress`` and receive JSON events for every running
generation job:

    {"jobId": "...", "stage": "DIFFUSION" | "RECONSTRUCTION" | "DECIMATION"
                      | "AUDIO" | "DONE" | "ERROR",
     "percent": 0-100, "message": "..."}

The client filters by ``jobId`` to follow its own request. The channel is
fan-out (each subscriber gets every event); event delivery is best-effort for
slow clients (newest-wins queue policy in the bus).
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.progress_bus import progress_bus

router = APIRouter(tags=["progress"])


@router.websocket("/ws/progress")
async def ws_progress(websocket: WebSocket) -> None:
    await websocket.accept()
    queue = progress_bus.subscribe()
    try:
        while True:
            event: dict[str, Any] = await queue.get()
            await websocket.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001 — client vanished mid-send
        pass
    finally:
        progress_bus.unsubscribe(queue)
