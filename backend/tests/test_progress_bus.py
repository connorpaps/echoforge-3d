"""ProgressBus — fan-out event delivery (async + thread-safe paths)."""

from __future__ import annotations

import asyncio
import threading

import pytest

from backend.services.progress_bus import ProgressBus


@pytest.mark.asyncio
async def test_async_publish_fanout():
    bus = ProgressBus()
    q1 = bus.subscribe()
    q2 = bus.subscribe()

    await bus.publish({"jobId": "j1", "stage": "DIFFUSION", "percent": 50, "message": "mid"})

    e1 = await asyncio.wait_for(q1.get(), timeout=1)
    e2 = await asyncio.wait_for(q2.get(), timeout=1)
    assert e1 == e2 == {"jobId": "j1", "stage": "DIFFUSION", "percent": 50, "message": "mid"}

    bus.unsubscribe(q1)
    bus.unsubscribe(q2)


@pytest.mark.asyncio
async def test_sync_publish_from_worker_thread():
    bus = ProgressBus()
    queue = bus.subscribe()

    received: list[dict] = []
    stop = threading.Event()

    def worker():
        for i in range(3):
            bus.publish_sync({"jobId": "w", "stage": "DECIMATION", "percent": i * 33, "message": str(i)})
        stop.set()

    thread = threading.Thread(target=worker)
    thread.start()
    stop.wait(timeout=5)
    thread.join(timeout=5)

    for _ in range(3):
        received.append(await asyncio.wait_for(queue.get(), timeout=1))

    assert [e["percent"] for e in received] == [0, 33, 66]
    bus.unsubscribe(queue)


@pytest.mark.asyncio
async def test_unsubscribe_stops_delivery():
    bus = ProgressBus()
    queue = bus.subscribe()
    bus.unsubscribe(queue)
    await bus.publish({"jobId": "x", "stage": "DONE", "percent": 100, "message": "done"})
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(queue.get(), timeout=0.1)
