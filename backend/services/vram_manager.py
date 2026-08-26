"""SequentialVRAMManager — serial GPU worker enforcing the VRAM safety invariant.

docs/08_TASKS.md (Task 2.2) + AGENTS.md guardrail #3: never load multiple heavy
PyTorch models concurrently on CUDA. All generative backend tasks (TripoSR,
SDXL-Turbo) route through this manager, which guarantees:

  * Exactly one GPU job runs at a time (asyncio lock).
  * Before a job starts, every previously-loaded model slot is unloaded
    (``del model`` semantics via :meth:`ModelSlot.unload`) and the CUDA
    allocator is flushed with ``gc.collect()`` + ``torch.cuda.empty_cache()``
    + ``torch.cuda.ipc_collect()``.
  * ``torch.cuda.max_memory_reserved`` stays below ``VRAM_LIMIT_GB`` (verified
    in backend/tests/test_vram_manager.py on CUDA hardware).

Model lifecycle: services register lazily-loaded :class:`ModelSlot` objects.
Slots own the model reference; the manager decides *when* they are loaded and
evicted. On CPU-only machines every CUDA call is a safe no-op, so the full
pipeline (and its tests) runs anywhere.
"""

from __future__ import annotations

import asyncio
import gc
import logging
from typing import Any, Callable, Generic, TypeVar

import torch

from ..config import CUDA_AVAILABLE, CUDA_DEVICE_ID, VRAM_LIMIT_GB

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ModelSlot(Generic[T]):
    """A lazily-loaded, evictable model held by the VRAM manager."""

    def __init__(self, name: str, loader: Callable[[], T]) -> None:
        self.name = name
        self._loader = loader
        self._model: T | None = None
        self.load_count = 0

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def ensure_loaded(self) -> T:
        """Load (once) and return the model. Call under the manager lock."""
        if self._model is None:
            logger.info("[VRAM] loading model slot '%s' ...", self.name)
            self._model = self._loader()
            self.load_count += 1
            logger.info("[VRAM] model slot '%s' loaded (load #%d)", self.name, self.load_count)
        return self._model

    def unload(self) -> None:
        """Drop the model reference and flush the CUDA allocator."""
        if self._model is not None:
            logger.info("[VRAM] unloading model slot '%s'", self.name)
        self._model = None
        if CUDA_AVAILABLE:
            gc.collect()
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<ModelSlot name={self.name!r} loaded={self.is_loaded}>"


def release_cuda_memory() -> None:
    """Aggressive allocator flush used between jobs (and on OOM recovery)."""
    gc.collect()
    if CUDA_AVAILABLE:
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()


class SequentialVRAMManager:
    """Serializes GPU work and evicts every model between jobs."""

    def __init__(self, vram_limit_gb: float = VRAM_LIMIT_GB) -> None:
        self.vram_limit_gb = vram_limit_gb
        self._lock = asyncio.Lock()
        self._slots: dict[str, ModelSlot[Any]] = {}

    # -- registration ---------------------------------------------------------

    def register(self, name: str, loader: Callable[[], T]) -> ModelSlot[T]:
        """Register a model slot. Loading is deferred until first use."""
        if name in self._slots:
            raise ValueError(f"Model slot '{name}' is already registered")
        slot: ModelSlot[T] = ModelSlot(name, loader)
        self._slots[name] = slot
        return slot

    def slot(self, name: str) -> ModelSlot[Any]:
        return self._slots[name]

    def slots(self) -> list[ModelSlot[Any]]:
        return list(self._slots.values())

    # -- memory bookkeeping ----------------------------------------------------

    @staticmethod
    def vram_status_mb() -> dict[str, Any]:
        """CUDA allocator snapshot for /health and the frontend VRAM meter."""
        if not CUDA_AVAILABLE:
            return {
                "available": False,
                "deviceName": None,
                "vramTotalMB": 0,
                "vramAllocatedMB": 0,
                "vramReservedMB": 0,
                "vramPeakReservedMB": 0,
            }
        return {
            "available": True,
            "deviceName": torch.cuda.get_device_name(CUDA_DEVICE_ID),
            "vramTotalMB": torch.cuda.get_device_properties(CUDA_DEVICE_ID).total_memory // (2**20),
            "vramAllocatedMB": torch.cuda.memory_allocated(CUDA_DEVICE_ID) // (2**20),
            "vramReservedMB": torch.cuda.memory_reserved(CUDA_DEVICE_ID) // (2**20),
            "vramPeakReservedMB": torch.cuda.max_memory_reserved(CUDA_DEVICE_ID) // (2**20),
        }

    # -- execution ---------------------------------------------------------------

    async def run(self, slot_name: str, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """Run ``func(model, *args, **kwargs)`` for ``slot_name`` under the lock.

        All previously loaded slots are evicted before the job, and again
        afterwards, so the resident model is never replaced by the next job
        while still alive.
        """
        async with self._lock:
            self._evict_all()
            slot = self._slots[slot_name]
            try:
                model = await asyncio.to_thread(slot.ensure_loaded)
                return await asyncio.to_thread(func, model, *args, **kwargs)
            finally:
                self._evict_all()

    def _evict_all(self) -> None:
        for slot in self._slots.values():
            slot.unload()
        release_cuda_memory()


# Module-level singleton shared by routers and services.
vram_manager = SequentialVRAMManager()
