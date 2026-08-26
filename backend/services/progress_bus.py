"""In-process async pub/sub bus for generation progress events.

GPU work runs in worker threads (via ``asyncio.to_thread``) while FastAPI's
event loop owns the WebSocket endpoints. This bus bridges the two: threads
publish through :meth:`publish_sync` (thread-safe hop onto the loop), and each
connected WebSocket client consumes from its own queue.

Event shape (JSON-serialisable):
    {"jobId": str, "stage": "DIFFUSION"|"RECONSTRUCTION"|"DECIMATION"|"DONE"|"ERROR",
     "percent": int, "message": str}
"""

from __future__ import annotations

import asyncio
import threading
from typing import Any


class ProgressBus:
    """Broadcast progress events to all subscribed WebSocket clients."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    # -- lifecycle ----------------------------------------------------------

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        """Create a subscription queue (call from the event loop thread)."""
        if self._loop is None:
            self._loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        with self._lock:
            self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue[dict[str, Any]]) -> None:
        with self._lock:
            self._subscribers.discard(queue)

    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscribers)

    # -- publishing ----------------------------------------------------------

    async def publish(self, event: dict[str, Any]) -> None:
        """Publish from an async context (event loop thread)."""
        with self._lock:
            targets = list(self._subscribers)
        for queue in targets:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:  # slow client: drop oldest, keep newest
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    def publish_sync(self, event: dict[str, Any]) -> None:
        """Publish from a worker thread (blocks until the loop picks it up)."""
        if self._loop is None or self._loop.is_closed():
            return
        future = asyncio.run_coroutine_threadsafe(self.publish(event), self._loop)
        try:
            future.result(timeout=2.0)
        except (asyncio.TimeoutError, RuntimeError):
            pass  # a slow/closed loop must never stall GPU work


# Module-level singleton shared by routers and services.
progress_bus = ProgressBus()
