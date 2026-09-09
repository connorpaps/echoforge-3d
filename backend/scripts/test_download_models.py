import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "backend" / "scripts" / "download_models.py"
spec = importlib.util.spec_from_file_location("download_models", MODULE_PATH)
download_models = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(download_models)


class DownloadModelsTests(unittest.TestCase):
    def test_explicit_cache_dir_resolves_to_hub_directory(self):
        self.assertEqual(
            download_models.resolve_hub_cache("G:/hf-cache").replace("\\", "/"),
            "G:/hf-cache/hub",
        )

    def test_aliases_cover_the_documented_optional_models(self):
        self.assertEqual(
            set(download_models.MODEL_ALIASES),
            {"triposr", "sdxl", "audiogen", "smolvlm"},
        )


if __name__ == "__main__":
    unittest.main()
