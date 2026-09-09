#!/usr/bin/env python3
"""Guided, consent-based local setup for EchoForge 3D."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = ROOT / ".venv" / "Scripts" / "python.exe"


@dataclass(frozen=True)
class Check:
    key: str
    ok: bool
    message: str
    optional: bool = False


MODEL_SPECS = {
    "triposr": {
        "repo_id": "stabilityai/TripoSR",
        "label": "TripoSR",
        "purpose": "image-to-3D mesh fallback",
        "minimum_gb": 5,
    },
    "sdxl": {
        "repo_id": "stabilityai/sdxl-turbo",
        "label": "SDXL-Turbo",
        "purpose": "optional texture generation",
        "minimum_gb": 7,
    },
    "audiogen": {
        "repo_id": "facebook/audiogen-medium",
        "label": "AudioGen",
        "purpose": "optional ambient audio generation",
        "minimum_gb": 4,
    },
    "smolvlm": {
        "repo_id": "HuggingFaceTB/SmolVLM-Instruct",
        "label": "SmolVLM",
        "purpose": "optional vision/NPC dialogue",
        "minimum_gb": 5,
    },
}


def default_cache_dir() -> Path:
    configured = os.environ.get("HF_HOME")
    if configured:
        return Path(configured)
    return Path("G:/hf-cache") if os.name == "nt" else ROOT / ".hf-cache"


def is_valid_port(port: int) -> bool:
    return 1 <= port <= 65535


def is_supported_python(version: tuple[int, int]) -> bool:
    return version >= (3, 11) and version < (3, 13)


def resolve_command(command: str) -> str | None:
    return shutil.which(command) or (
        shutil.which(f"{command}.cmd") if os.name == "nt" else None
    )


def model_cache_path(cache_root: Path, alias: str) -> Path:
    owner, repo = MODEL_SPECS[alias]["repo_id"].split("/", maxsplit=1)
    return cache_root / "hub" / f"models--{owner}--{repo}"


def is_model_cached(cache_root: Path, alias: str) -> bool:
    model_root = model_cache_path(cache_root, alias)
    refs_main = model_root / "refs" / "main"
    snapshots = model_root / "snapshots"
    return refs_main.is_file() and any(snapshots.iterdir()) if snapshots.is_dir() else False


def cache_status(cache_root: Path) -> dict[str, bool]:
    return {alias: is_model_cached(cache_root, alias) for alias in MODEL_SPECS}


def disk_space_gb(cache_root: Path) -> float:
    probe = cache_root if cache_root.exists() else cache_root.parent
    return shutil.disk_usage(probe).free / (1024**3)


def required_model_space_gb(aliases: Iterable[str]) -> int:
    return sum(int(MODEL_SPECS[alias]["minimum_gb"]) for alias in aliases)


def build_download_command(
    python_executable: Path,
    aliases: Iterable[str],
    cache_root: Path,
) -> list[str]:
    return [
        str(python_executable),
        str(ROOT / "backend" / "scripts" / "download_models.py"),
        "--cache-dir",
        str(cache_root),
        "--models",
        *aliases,
    ]


def check_hunyuan(root: Path) -> Check:
    missing: list[str] = []
    if not (root / ".venv" / "Scripts" / "python.exe").exists():
        missing.append("sidecar virtual environment")
    if not (root / "echoforge_sidecar.py").exists():
        missing.append("echoforge_sidecar.py")
    if missing:
        return Check(
            "Hunyuan sidecar",
            False,
            "missing " + " and ".join(missing),
            optional=True,
        )
    return Check("Hunyuan sidecar", True, f"sidecar files found at {root}", optional=True)


def _command_check(key: str, command: str, optional: bool = False) -> Check:
    executable = resolve_command(command)
    return Check(
        key,
        executable is not None,
        f"{command} is available" if executable else f"{command} is not available",
        optional=optional,
    )


def _torch_check() -> Check:
    if not VENV_PYTHON.exists():
        return Check("PyTorch", False, "project virtual environment is not present", optional=True)
    try:
        result = subprocess.run(
            [str(VENV_PYTHON), "-c", "import torch; print(torch.cuda.is_available())"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as error:
        return Check("PyTorch", False, f"could not inspect PyTorch: {error}", optional=True)
    if result.returncode != 0:
        return Check("PyTorch", False, "PyTorch is not importable in .venv", optional=True)
    cuda = result.stdout.strip().lower() == "true"
    return Check(
        "PyTorch/CUDA",
        True,
        "CUDA is available" if cuda else "PyTorch imports, but CUDA is unavailable",
        optional=True,
    )


def collect_checks(cache_root: Path | None = None, hunyuan_root: Path | None = None) -> list[Check]:
    cache = cache_root or default_cache_dir()
    checks = [
        _command_check("Node.js", "node"),
        _command_check("pnpm", "pnpm"),
        _command_check("Python", "python"),
        _command_check("Git", "git"),
        Check("Python version", is_supported_python((sys.version_info.major, sys.version_info.minor)), f"running Python {sys.version_info.major}.{sys.version_info.minor}"),
        Check("package manifest", (ROOT / "package.json").exists(), "package.json is present"),
        Check("backend requirements", (ROOT / "backend" / "requirements.txt").exists(), "backend requirements are present"),
        Check("project venv", VENV_PYTHON.exists(), "project .venv is present", optional=True),
        _command_check("NVIDIA tooling", "nvidia-smi", optional=True),
        _torch_check(),
        Check("cache directory", cache.exists(), f"cache exists at {cache}", optional=True),
    ]
    if hunyuan_root:
        checks.append(check_hunyuan(hunyuan_root))
    return checks


def format_checks(checks: Iterable[Check]) -> str:
    lines = ["EchoForge 3D setup check", ""]
    for check in checks:
        marker = "OK" if check.ok else ("WARN" if check.optional else "FAIL")
        lines.append(f"[{marker}] {check.key}: {check.message}")
    return "\n".join(lines)


def format_model_status(cache_root: Path) -> str:
    lines = ["Model cache"]
    for alias, present in cache_status(cache_root).items():
        spec = MODEL_SPECS[alias]
        marker = "cached" if present else "not cached"
        lines.append(f"- {spec['label']}: {marker} ({spec['purpose']})")
    return "\n".join(lines)


def confirm(prompt: str, assume_yes: bool = False) -> bool:
    if assume_yes:
        return True
    try:
        return input(f"{prompt} [y/N] ").strip().lower() in {"y", "yes"}
    except (EOFError, KeyboardInterrupt):
        print()
        return False


def _run(command: list[str], env: dict[str, str] | None = None) -> int:
    print("$ " + " ".join(command))
    result = subprocess.run(command, cwd=ROOT, env=env, check=False)
    return result.returncode


def ensure_venv() -> int:
    if VENV_PYTHON.exists():
        print(f"[OK] project virtual environment already exists: {VENV_PYTHON}")
        return 0
    return _run([sys.executable, "-m", "venv", str(ROOT / ".venv")])


def install_dependencies(cuda: bool) -> int:
    if ensure_venv() != 0:
        return 1
    requirements = ROOT / "backend" / "requirements.txt"
    if _run([str(VENV_PYTHON), "-m", "pip", "install", "-r", str(requirements)]) != 0:
        return 1
    if cuda:
        return _run(
            [
                str(VENV_PYTHON),
                "-m",
                "pip",
                "install",
                "torch==2.5.0",
                "torchvision==0.20.0",
                "--index-url",
                "https://download.pytorch.org/whl/cu121",
            ]
        )
    return 0


def update_env_file(path: Path, cache_root: Path) -> None:
    settings = {
        "HF_HOME": str(cache_root),
        "U2NET_HOME": str(cache_root / "u2net"),
    }
    existing = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    written: set[str] = set()
    output: list[str] = []
    for line in existing:
        key = line.split("=", maxsplit=1)[0].strip() if "=" in line else ""
        if key in settings:
            output.append(f'{key}="{settings[key]}"')
            written.add(key)
        else:
            output.append(line)
    if output and output[-1].strip():
        output.append("")
    output.extend(f'{key}="{value}"' for key, value in settings.items() if key not in written)
    path.write_text("\n".join(output) + "\n", encoding="utf-8")
    print(f"[OK] cache settings written to {path}")


def download_models(aliases: list[str], cache_root: Path, assume_yes: bool) -> int:
    missing = [alias for alias in aliases if not model_cache_path(cache_root, alias).exists()]
    if not missing:
        print("[OK] selected model weights are already cached")
        return 0
    required_gb = required_model_space_gb(missing)
    available_gb = disk_space_gb(cache_root)
    print(f"[INFO] model download budget: approximately {required_gb} GB; free space: {available_gb:.1f} GB")
    if available_gb < required_gb:
        print(f"[FAIL] not enough free space for the selected models on {cache_root}", file=sys.stderr)
        return 1
    labels = ", ".join(MODEL_SPECS[alias]["label"] for alias in missing)
    if not confirm(f"Download {labels} into {cache_root}? This may use several GB.", assume_yes):
        print("[SKIP] model download cancelled")
        return 0
    return _run(build_download_command(VENV_PYTHON, missing, cache_root), env=os.environ.copy())


def launch(mode: str) -> int:
    command = [str(VENV_PYTHON if VENV_PYTHON.exists() else Path(sys.executable)), str(ROOT / "scripts" / "start_local.py")]
    if mode == "demo":
        command.append("--demo")
    return _run(command, env=os.environ.copy())


def validate_providers() -> int:
    python = VENV_PYTHON if VENV_PYTHON.exists() else Path(sys.executable)
    return _run([str(python), str(ROOT / "scripts" / "doctor.py"), "--json"], env=os.environ.copy())


def guided_setup(args: argparse.Namespace, cache_root: Path) -> int:
    print(format_checks(collect_checks(cache_root, args.hunyuan_root)))
    if not VENV_PYTHON.exists() and confirm("Create the project Python environment and install backend dependencies?", args.yes):
        if install_dependencies(args.cuda) != 0:
            return 1
    if confirm("Download the recommended TripoSR mesh model?", args.yes):
        if download_models(["triposr"], cache_root, args.yes) != 0:
            return 1
    update_env_file(ROOT / ".env.local", cache_root)
    print(format_checks(collect_checks(cache_root, args.hunyuan_root)))
    if confirm("Launch the GPU-free demo now?", False):
        return launch("demo")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Guide EchoForge local dependencies and model setup")
    parser.add_argument("--check", action="store_true", help="only inspect prerequisites, cache, and optional sidecar")
    parser.add_argument("--install", action="store_true", help="create .venv and install pinned backend dependencies")
    parser.add_argument("--cuda", action="store_true", help="install the documented CUDA 12.1 PyTorch wheels")
    parser.add_argument("--download-models", nargs="+", choices=[*MODEL_SPECS, "all"], metavar="MODEL", help="download selected model weights after confirmation")
    parser.add_argument("--cache-dir", type=Path, help="Hugging Face cache directory, defaulting to HF_HOME or G:/hf-cache")
    parser.add_argument("--hunyuan-root", type=Path, default=Path(os.environ.get("HUNYUAN_ROOT", "G:/EchoForge_App/hunyuan3d-2gp")), help="prepared Hunyuan sidecar checkout to validate")
    parser.add_argument("--launch", choices=["demo", "local"], help="launch the GPU-free demo or the local frontend/backend stack")
    parser.add_argument("--validate", action="store_true", help="run the read-only provider and service health probe")
    parser.add_argument("--dry-run", action="store_true", help="show checks and planned actions without installing, downloading, or writing files")
    parser.add_argument("--yes", action="store_true", help="accept setup and model-download confirmations")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cache_root = (args.cache_dir or default_cache_dir()).expanduser()
    if args.dry_run:
        print(format_checks(collect_checks(cache_root, args.hunyuan_root)))
        print("\n" + format_model_status(cache_root))
        print("\n[DRY RUN] No dependencies, models, environment files, or services will be changed.")
        return 0
    if not any((args.check, args.install, args.cuda, args.download_models, args.launch, args.validate)):
        return guided_setup(args, cache_root)
    if args.check:
        checks = collect_checks(cache_root, args.hunyuan_root)
        print(format_checks(checks))
        print("\n" + format_model_status(cache_root))
        return 1 if any(not check.ok and not check.optional for check in checks) else 0
    if args.install or args.cuda:
        if not args.yes and not confirm("Install or update the local Python dependencies?", False):
            print("[SKIP] dependency installation cancelled")
            return 0
        if install_dependencies(args.cuda) != 0:
            return 1
    if args.download_models:
        aliases = list(MODEL_SPECS) if "all" in args.download_models else args.download_models
        if not VENV_PYTHON.exists():
            print("[FAIL] .venv is missing; run with --install first", file=sys.stderr)
            return 1
        if download_models(aliases, cache_root, args.yes) != 0:
            return 1
    if args.install or args.cuda or args.download_models or not any((args.check, args.launch, args.validate)):
        update_env_file(ROOT / ".env.local", cache_root)
    if args.launch:
        return launch(args.launch)
    if args.validate:
        return validate_providers()
    print(format_checks(collect_checks(cache_root, args.hunyuan_root)))
    print("\n" + format_model_status(cache_root))
    print("\nNext: start with `python scripts/start_local.py`, or use `--launch demo` for the no-model walkthrough.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
