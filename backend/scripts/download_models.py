"""EchoForge 3D — Open-Weights Model Pre-Caching Script.

Downloads the backend generative model weights into the local Hugging
Face cache (~/.cache/huggingface/hub) so runtime inference endpoints
don't block on network fetches.

Models:
  - stabilityai/TripoSR          (image-to-3D mesh)
  - stabilityai/sdxl-turbo       (single-step texture/diffusion)
  - facebook/audiogen-medium     (text-to-audio) — PUBLIC (not gated;
                                  verified via the HF API 2026-08-26). Weights
                                  ~3.9 GB: state_dict.bin + EnCodec
                                  compression_state_dict.bin. Needs audiocraft
                                  installed (see requirements-audiocraft.txt).
  - HuggingFaceTB/SmolVLM-Instruct (viewport visual QA / NPC dialogue)

Run:  .venv/Scripts/python.exe backend/scripts/download_models.py
"""
import argparse
import os
from pathlib import Path

# Default the HF cache to a project-local dir. On this machine C: is full,
# so we keep weights on the project drive (G:). Override anytime via the
# HF_HOME or HF_HUB_CACHE environment variables.
os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parents[2] / ".hf-cache"))

from huggingface_hub import snapshot_download

MODELS = [
    {
        "repo_id": "stabilityai/TripoSR",
        "allow_patterns": ["*.yaml", "*.ckpt", "*.json"],
    },
    {
        "repo_id": "stabilityai/sdxl-turbo",
        "allow_patterns": ["*.json", "*.fp16.safetensors", "*.txt"],  # fp16 only (spec loads SDXL with variant="fp16")
    },
    {
        "repo_id": "facebook/audiogen-medium",
        "allow_patterns": ["*"],
    },
    {
        "repo_id": "HuggingFaceTB/SmolVLM-Instruct",
        "allow_patterns": ["*.json", "*.safetensors", "*.txt"],
    },
]
MODEL_ALIASES = {
    "triposr": "stabilityai/TripoSR",
    "sdxl": "stabilityai/sdxl-turbo",
    "audiogen": "facebook/audiogen-medium",
    "smolvlm": "HuggingFaceTB/SmolVLM-Instruct",
}


def resolve_hub_cache(cache_dir: str | None = None) -> str:
    if cache_dir:
        return str(Path(cache_dir) / "hub")
    if os.environ.get("HF_HUB_CACHE"):
        return os.environ["HF_HUB_CACHE"]
    return str(Path(os.environ["HF_HOME"]) / "hub")


def download_all(selected: list[str] | None = None, cache_dir: str | None = None) -> None:
    if cache_dir:
        os.environ["HF_HOME"] = cache_dir
        os.environ["HF_HUB_CACHE"] = str(Path(cache_dir) / "hub")
    hub_cache = resolve_hub_cache(cache_dir)
    selected_repos = {MODEL_ALIASES[name] for name in selected} if selected else None
    models = [
        model for model in MODELS
        if selected_repos is None or model["repo_id"] in selected_repos
    ]
    print("Starting EchoForge 3D model pre-caching...")
    results: list[tuple[str, str]] = []

    for model in models:
        repo_id = model["repo_id"]
        if model.get("gated") and not os.environ.get("HF_TOKEN"):
            print(f"[SKIP] {repo_id} is gated (needs accepted license + HF_TOKEN).")
            results.append((repo_id, "skipped (gated)"))
            continue

        print(f"[DOWNLOAD] {repo_id} ...")
        try:
            snapshot_download(
                repo_id=repo_id,
                allow_patterns=model.get("allow_patterns"),
                cache_dir=hub_cache,
                resume_download=True,
            )
            results.append((repo_id, "ok"))
        except Exception as exc:  # noqa: BLE001 — report and continue
            print(f"[FAIL] {repo_id}: {exc}")
            results.append((repo_id, f"failed: {exc}"))

    print("\n=== Pre-cache summary ===")
    for repo_id, status in results:
        print(f"  {repo_id}: {status}")
    failed = [r for r in results if r[1] != "ok"]
    if failed:
        print(f"\n{len(failed)} model(s) not cached — see messages above.")
    else:
        print("\nAll requested open-weight models successfully cached locally!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cache EchoForge open-weight models")
    parser.add_argument(
        "--models",
        nargs="+",
        choices=[*MODEL_ALIASES],
        help="model aliases to download; defaults to all",
    )
    parser.add_argument("--cache-dir", help="Hugging Face cache root")
    args = parser.parse_args()
    download_all(args.models, args.cache_dir)
