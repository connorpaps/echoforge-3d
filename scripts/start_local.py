#!/usr/bin/env python3
"""Start and stop the local EchoForge services as one process group."""

from __future__ import annotations

import argparse
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class ServiceSpec:
    name: str
    command: tuple[str, ...]
    port: int
    cwd: Path
    env: dict[str, str]


def resolve_command(command: str) -> str | None:
    return shutil.which(command) or (
        shutil.which(f"{command}.cmd") if os.name == "nt" else None
    )


def port_is_open(port: int, host: str = "127.0.0.1") -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.35):
            return True
    except OSError:
        return False


def _project_python() -> str:
    candidate = ROOT / ".venv" / "Scripts" / "python.exe"
    return str(candidate) if candidate.exists() else sys.executable


def _service_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("HF_HOME", "G:/hf-cache")
    env.setdefault("U2NET_HOME", "G:/hf-cache/u2net")
    return env


def build_specs(with_hunyuan: bool = False) -> list[ServiceSpec]:
    """Build commands without starting processes or loading model weights."""
    env = _service_env()
    pnpm = resolve_command("pnpm") or "pnpm"
    python = _project_python()
    specs = [
        ServiceSpec(
            name="backend",
            command=(
                python,
                "-m",
                "uvicorn",
                "backend.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ),
            port=8000,
            cwd=ROOT,
            env=env,
        ),
        ServiceSpec(
            name="frontend",
            command=(
                pnpm,
                "dev",
                "--hostname",
                "127.0.0.1",
                "-p",
                "3000",
            ),
            port=3000,
            cwd=ROOT,
            env=env,
        ),
    ]
    if with_hunyuan:
        bash = resolve_command("bash") or "bash"
        specs.append(
            ServiceSpec(
                name="hunyuan",
                command=(bash, "scripts/gpu/start_hunyuan_sidecar.sh"),
                port=8081,
                cwd=ROOT,
                env=env,
            )
        )
    return specs


def _assert_ports_free(specs: list[ServiceSpec]) -> None:
    busy = [f"{spec.name} ({spec.port})" for spec in specs if port_is_open(spec.port)]
    if busy:
        raise RuntimeError("Documented ports are already in use: " + ", ".join(busy))


def _terminate(processes: list[subprocess.Popen[object]]) -> None:
    for process in reversed(processes):
        if process.poll() is None:
            process.terminate()
    deadline = time.monotonic() + 5
    for process in reversed(processes):
        remaining = max(0.1, deadline - time.monotonic())
        if process.poll() is None:
            try:
                process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                process.kill()


def _print_specs(specs: list[ServiceSpec]) -> None:
    for spec in specs:
        print(f"{spec.name}: port {spec.port}")
        print("  " + " ".join(spec.command))


def run(specs: list[ServiceSpec]) -> int:
    _assert_ports_free(specs)
    processes: list[subprocess.Popen[object]] = []
    stopping = False

    def stop(_signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True

    previous_sigint = signal.signal(signal.SIGINT, stop)
    previous_sigterm = signal.signal(signal.SIGTERM, stop)
    try:
        for spec in specs:
            print(f"Starting {spec.name} on 127.0.0.1:{spec.port}")
            processes.append(
                subprocess.Popen(
                    list(spec.command),
                    cwd=spec.cwd,
                    env=spec.env,
                    stdin=None,
                    stdout=None,
                    stderr=None,
                    shell=False,
                )
            )
        print("EchoForge is running. Press Ctrl+C to stop all services.")
        while not stopping:
            for spec, process in zip(specs, processes):
                return_code = process.poll()
                if return_code is not None:
                    raise RuntimeError(f"{spec.name} exited unexpectedly with code {return_code}")
            time.sleep(0.5)
        return 0
    finally:
        _terminate(processes)
        signal.signal(signal.SIGINT, previous_sigint)
        signal.signal(signal.SIGTERM, previous_sigterm)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run EchoForge frontend and backend together")
    parser.add_argument(
        "--with-hunyuan",
        action="store_true",
        help="also start the separately managed Hunyuan sidecar",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print commands without starting services",
    )
    args = parser.parse_args()
    specs = build_specs(with_hunyuan=args.with_hunyuan)
    if args.dry_run:
        _print_specs(specs)
        return 0
    try:
        return run(specs)
    except (OSError, RuntimeError) as error:
        print(f"EchoForge launcher error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
