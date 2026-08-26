"""EchoForge 3D — Open-Weights Model Pre-Caching Script.

Downloads the backend generative model weights into the local Hugging
Face cache (~/.cache/huggingface/hub) so runtime inference endpoints
don't block on network fetches.

Models:
  - stabilityai/TripoSR          (image-to-3D mesh)
  - stabilityai/sdxl-turbo       (single-step texture/diffusion)
  - facebook/audiogen-medium     (text-to-audio) — GATED: requires an
                                  accepted license + HF_TOKEN, so it is
                                  skipped unless HF_TOKEN is set.
  - HuggingFaceTB/SmolVLM-Instruct (viewport visual QA / NPC dialogue)

Run:  .venv/Scripts/python.exe backend/scripts/download_models.py
"""
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
        "gated": True,
    },
    {
        "repo_id": "HuggingFaceTB/SmolVLM-Instruct",
        "allow_patterns": ["*.json", "*.safetensors", "*.txt"],
    },
]


def download_all() -> None:
    print("Starting EchoForge 3D model pre-caching...")
    results: list[tuple[str, str]] = []

    for model in MODELS:
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
    download_all()
