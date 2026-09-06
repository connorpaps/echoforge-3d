#!/usr/bin/env python3
"""Read-only first-run diagnostics for EchoForge 3D."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
REDACTION_PATTERN = re.compile(
    r"(?:HF_TOKEN|[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Check:
    key: str
    ok: bool
    message: str
    optional: bool = False


def check_path(path: Path) -> bool:
    """Return whether a required local path exists."""
    return path.exists()


def port_is_open(port: int, host: str = "127.0.0.1") -> bool:
    """Check a loopback listener without contacting external hosts."""
    try:
        with socket.create_connection((host, port), timeout=0.35):
            return True
    except OSError:
        return False


def resolve_command(command: str) -> str | None:
    """Resolve executables, including Windows .cmd shims such as pnpm."""
    return shutil.which(command) or (
        shutil.which(f"{command}.cmd") if os.name == "nt" else None
    )


def command_is_available(command: str) -> bool:
    return resolve_command(command) is not None


def _safe_message(message: str) -> str:
    """Remove secret-like variable names from human and JSON output."""
    return REDACTION_PATTERN.sub("[redacted]", message)


def summarize(checks: Iterable[Check]) -> str:
    lines = ["EchoForge 3D doctor", ""]
    for check in checks:
        marker = "OK" if check.ok else ("WARN" if check.optional else "FAIL")
        scope = "optional" if check.optional else "required"
        lines.append(f"[{marker}] {check.key}: {_safe_message(check.message)} ({scope})")
    required_failures = sum(1 for check in checks if not check.ok and not check.optional)
    optional_failures = sum(1 for check in checks if not check.ok and check.optional)
    lines.extend(
        [
            "",
            f"Required failures: {required_failures}",
            f"Optional warnings: {optional_failures}",
        ]
    )
    return "\n".join(lines)


def _version(command: str, *args: str) -> str | None:
    executable = resolve_command(command)
    if executable is None:
        return None
    try:
        result = subprocess.run(
            [executable, *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    output = (result.stdout or result.stderr).strip().splitlines()
    return output[0][:100] if output else None


def _health_check() -> Check:
    if not port_is_open(8000):
        return Check("backend", False, "not listening on the documented port", optional=True)
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/health", timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("status") != "ok":
            return Check("backend", False, "health endpoint returned a non-ok status", optional=True)
        cuda = payload.get("cuda") or {}
        device = cuda.get("deviceName")
        return Check(
            "backend",
            True,
            "health endpoint is responding" + (f"; GPU detected: {device}" if device else ""),
            optional=True,
        )
    except (OSError, ValueError, urllib.error.URLError):
        return Check("backend", False, "health endpoint did not return valid JSON", optional=True)


def _gpu_check() -> Check:
    if not command_is_available("nvidia-smi"):
        return Check("gpu", False, "nvidia-smi is not available", optional=True)
    output = _version(
        "nvidia-smi",
        "--query-gpu=name,memory.total",
        "--format=csv,noheader,nounits",
    )
    return Check("gpu", output is not None, "NVIDIA GPU detected" if output else "NVIDIA query failed", optional=True)


def collect_checks() -> list[Check]:
    python_path = ROOT / ".venv" / "Scripts" / "python.exe"
    checks = [
        Check("node", _version("node", "--version") is not None, _version("node", "--version") or "node is unavailable"),
        Check("pnpm", _version("pnpm", "--version") is not None, _version("pnpm", "--version") or "pnpm is unavailable"),
        Check("git", _version("git", "--version") is not None, _version("git", "--version") or "git is unavailable"),
        Check("package manifest", check_path(ROOT / "package.json"), "package.json is present"),
        Check("frontend env template", check_path(ROOT / ".env.local.example"), ".env.local.example is present"),
        Check("backend requirements", check_path(ROOT / "backend" / "requirements.txt"), "backend requirements are present"),
        Check("project Python", check_path(python_path), "project virtual environment is present", optional=True),
        Check("frontend port", port_is_open(3000), "listening on 127.0.0.1:3000" if port_is_open(3000) else "not listening on the documented port", optional=True),
        Check("backend port", port_is_open(8000), "listening on 127.0.0.1:8000" if port_is_open(8000) else "not listening on the documented port", optional=True),
        Check("Hunyuan sidecar", port_is_open(8081), "listening on 127.0.0.1:8081" if port_is_open(8081) else "not listening; TripoSR fallback may be used", optional=True),
        _health_check(),
        _gpu_check(),
    ]
    cache_root = Path(os.environ.get("HF_HOME", "G:/hf-cache"))
    checks.append(
        Check(
            "model cache",
            cache_root.exists(),
            "configured cache directory exists" if cache_root.exists() else "configured cache directory is not present yet",
            optional=True,
        )
    )
    return checks


def main() -> int:
    parser = argparse.ArgumentParser(description="Run read-only EchoForge setup diagnostics")
    parser.add_argument("--json", action="store_true", help="emit machine-readable results")
    args = parser.parse_args()
    checks = collect_checks()
    if args.json:
        print(json.dumps([asdict(check) | {"message": _safe_message(check.message)} for check in checks], indent=2))
    else:
        print(summarize(checks))
    return 1 if any(not check.ok and not check.optional for check in checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
