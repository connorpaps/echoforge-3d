"""Shared rate limiter for expensive backend operations."""

from typing import Any, Callable, get_type_hints

from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import GENERATION_RATE_LIMIT

limiter = Limiter(key_func=get_remote_address)


def reset_rate_limit_storage() -> None:
    """Clear in-process counters when a new application instance is created."""
    limiter._storage.reset()  # noqa: SLF001 - slowapi exposes storage privately


def rate_limited(func: Callable[..., Any]) -> Callable[..., Any]:
    """Resolve postponed annotations before slowapi inspects an endpoint."""
    func.__annotations__ = get_type_hints(func, func.__globals__)
    return limiter.limit(GENERATION_RATE_LIMIT)(func)