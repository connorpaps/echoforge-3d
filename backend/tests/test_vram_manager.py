"""SequentialVRAMManager — docs/08_TASKS.md Task 2.2 verification.

Verification target from the task: *"peak VRAM remains under 6.0 GB during
model swaps"*. On CUDA hardware we allocate two dummy 1.5 GB models through
separate slots and assert:

  * ``torch.cuda.max_memory_reserved`` never exceeds the 6.0 GB ceiling;
  * eviction actually returns memory between jobs (reserved back to baseline);
  * slots are reloaded (evicted) between runs of the same name.

Without CUDA, the serialization and eviction *semantics* are still verified
with plain Python counters.
"""

from __future__ import annotations

import asyncio
import threading
import time

import pytest
import torch

from backend.services.sdxl_service import SDXLService
from backend.services.tsr_service import TripoSRService
from backend.services.vram_manager import SequentialVRAMManager, release_cuda_memory

CUDA = torch.cuda.is_available()
DUMMY_BYTES = int(1.5 * 2**30)  # 1.5 GiB fp16 tensor per dummy model


def _dummy_loader(name: str):
    def loader():
        if CUDA:
            return {"name": name, "tensor": torch.zeros(DUMMY_BYTES // 2, dtype=torch.float16, device="cuda")}
        return {"name": name, "tensor": torch.zeros(8)}

    return loader


async def _run_once(manager: SequentialVRAMManager, name: str) -> int:
    def work(model) -> int:
        time.sleep(0.01)
        return int(model["tensor"].sum().item())

    return await manager.run(name, work)


@pytest.mark.asyncio
async def test_serializes_concurrent_jobs():
    """Two jobs on different slots never interleave."""
    manager = SequentialVRAMManager()
    manager.register("a", _dummy_loader("a"))
    manager.register("b", _dummy_loader("b"))
    order: list[str] = []

    async def job(name: str) -> None:
        def work(_model) -> None:
            order.append(f"{name}:start")
            time.sleep(0.05)
            order.append(f"{name}:end")

        await manager.run(name, work)

    await asyncio.gather(job("a"), job("b"), job("a"))
    assert order == ["a:start", "a:end", "b:start", "b:end", "a:start", "a:end"]


@pytest.mark.asyncio
async def test_evicts_between_runs():
    """Slots are unloaded (and reloaded) between jobs of the same name."""
    manager = SequentialVRAMManager()
    manager.register("a", _dummy_loader("a"))

    await _run_once(manager, "a")
    await _run_once(manager, "a")
    slot = manager.slot("a")
    assert slot.load_count == 2  # evicted and reloaded on the second run


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("slot_name", "service", "attribute"),
    [
        ("triposr", TripoSRService(), "_model"),
        ("sdxl-turbo", SDXLService(), "_pipe"),
    ],
)
async def test_manager_eviction_clears_provider_owned_reference(slot_name, service, attribute):
    """Manager eviction must clear the provider's own model reference too."""
    model = object()
    setattr(service, attribute, model)
    manager = SequentialVRAMManager()
    manager.register(slot_name, lambda: model, service.unload)

    await manager.run(slot_name, lambda loaded: loaded)

    assert getattr(service, attribute) is None


@pytest.mark.asyncio
@pytest.mark.skipif(not CUDA, reason="requires CUDA hardware")
async def test_peak_vram_under_6gb_during_model_swaps():
    """The headline invariant from docs/08_TASKS.md Task 2.2."""
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.empty_cache()
    baseline = torch.cuda.memory_reserved() // (2**20)

    manager = SequentialVRAMManager(vram_limit_gb=6.0)
    manager.register("heavy-a", _dummy_loader("a"))
    manager.register("heavy-b", _dummy_loader("b"))

    await _run_once(manager, "heavy-a")
    await _run_once(manager, "heavy-b")

    peak_mb = torch.cuda.max_memory_reserved() // (2**20)

    assert peak_mb < 6.0 * 1024, f"peak VRAM {peak_mb} MB exceeded the 6.0 GB ceiling"

    # Nothing may remain *allocated* after eviction (the caching allocator may
    # still hold reserved blocks, which is fine — they are freed on flush).
    allocated_after_mb = torch.cuda.memory_allocated() // (2**20)
    assert allocated_after_mb - baseline < 64, (
        f"VRAM still allocated after swap: {allocated_after_mb}MB baseline={baseline}MB"
    )

    # An explicit flush must return cached blocks to the driver.
    release_cuda_memory()
    reserved_after_mb = torch.cuda.memory_reserved() // (2**20)
    assert reserved_after_mb - baseline < 256, (
        f"VRAM not released after swap: reserved={reserved_after_mb}MB baseline={baseline}MB"
    )

    # Loading both simultaneously would have required ~3 GiB+; the manager must
    # have kept them apart (peak stays under the single-model footprint + slack).
    assert peak_mb - baseline < int(2.2 * 1024), f"peak {peak_mb}MB implies both models were resident"


def test_vram_status_mb_shape():
    manager = SequentialVRAMManager()
    status = manager.vram_status_mb()
    assert set(status) == {
        "available",
        "deviceName",
        "vramTotalMB",
        "vramAllocatedMB",
        "vramReservedMB",
        "vramPeakReservedMB",
    }
    assert status["available"] is CUDA
    if CUDA:
        assert status["vramTotalMB"] > 0


def test_register_duplicate_name_rejected():
    manager = SequentialVRAMManager()
    manager.register("a", lambda: object())
    with pytest.raises(ValueError):
        manager.register("a", lambda: object())


# --- GpuWatchdog -------------------------------------------------------------

def _wait_for_threads() -> None:
    for t in threading.enumerate():
        if t.name == "gpu-watchdog" and t is not threading.current_thread():
            t.join(timeout=5)


def test_watchdog_disarm_prevents_exit():
    """A job that finishes (disarm) before the deadline never fires."""
    from backend.services.vram_manager import gpu_watchdog

    gpu_watchdog.disarm()
    gpu_watchdog.arm("triposr", 0.5)
    assert gpu_watchdog.is_armed()
    time.sleep(0.1)  # well before the deadline
    gpu_watchdog.disarm()  # normal path: the job finished inside the deadline
    _wait_for_threads()
    assert not gpu_watchdog.is_armed()


def test_watchdog_fires_and_force_exits(monkeypatch):
    """A job that outlives its deadline triggers os._exit(2)."""
    from backend.services.vram_manager import gpu_watchdog

    gpu_watchdog.disarm()
    exits: list[int] = []

    def fake_exit(code: int) -> None:
        exits.append(code)
        raise SystemExit(code)

    # Patch BEFORE arming so the firing thread can never kill the pytest
    # process itself.
    monkeypatch.setattr("backend.services.vram_manager.os._exit", fake_exit)
    gpu_watchdog.arm("sdxl-turbo", 0.05)
    time.sleep(0.3)  # outlive the 50 ms deadline — the watchdog must fire
    _wait_for_threads()
    assert exits == [2], f"os._exit not called with 2: {exits}"


@pytest.mark.asyncio
async def test_run_disarms_watchdog_after_success():
    """vram_manager.run() arms around the job and disarms in its finally."""
    from backend.services.vram_manager import gpu_watchdog

    gpu_watchdog.disarm()
    manager = SequentialVRAMManager()
    manager.register("a", _dummy_loader("a"))
    assert not gpu_watchdog.is_armed()
    await _run_once(manager, "a")
    assert not gpu_watchdog.is_armed()


def test_publish_sync_from_worker_thread_is_safe():
    """publish_sync must never crash when no loop is running (e.g., unit tests)."""
    from backend.services.progress_bus import ProgressBus

    bus = ProgressBus()
    # No loop running — must be a silent no-op, not an exception.
    bus.publish_sync({"jobId": "x", "stage": "DONE", "percent": 100, "message": "ok"})
    assert threading.current_thread().name  # sanity
