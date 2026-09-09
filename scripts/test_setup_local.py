import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "setup_local.py"
spec = importlib.util.spec_from_file_location("echoforge_setup_local", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load setup_local module")
setup = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = setup
spec.loader.exec_module(setup)


class SetupLocalTests(unittest.TestCase):
    def test_model_specs_have_stable_aliases_and_cache_paths(self):
        self.assertEqual(set(setup.MODEL_SPECS), {"triposr", "sdxl", "audiogen", "smolvlm"})
        self.assertEqual(
            setup.model_cache_path(Path("G:/hf-cache"), "triposr"),
            Path("G:/hf-cache/hub/models--stabilityai--TripoSR"),
        )

    def test_cache_status_distinguishes_present_and_missing_models(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / "hub"
            model = cache / "models--stabilityai--TripoSR"
            (model / "refs").mkdir(parents=True)
            (model / "refs" / "main").write_text("snapshot", encoding="utf-8")
            (model / "snapshots" / "snapshot").mkdir(parents=True)
            status = setup.cache_status(cache.parent)

        self.assertTrue(status["triposr"])
        self.assertFalse(status["sdxl"])
        self.assertFalse(status["audiogen"])
        self.assertFalse(status["smolvlm"])

    def test_port_and_python_requirements_are_reported_without_side_effects(self):
        self.assertTrue(setup.is_supported_python((3, 11)))
        self.assertFalse(setup.is_supported_python((3, 10)))
        self.assertTrue(setup.is_valid_port(8081))
        self.assertFalse(setup.is_valid_port(70000))

    def test_model_space_budget_is_explicit(self):
        self.assertEqual(setup.required_model_space_gb(["triposr", "sdxl"]), 12)

    def test_download_command_is_explicit_and_uses_project_python(self):
        command = setup.build_download_command(
            Path("G:/EchoForge_App/echoforge-3d/.venv/Scripts/python.exe"),
            ["triposr", "sdxl"],
            Path("G:/hf-cache"),
        )
        self.assertEqual(command[0].replace("\\", "/"), "G:/EchoForge_App/echoforge-3d/.venv/Scripts/python.exe")
        normalized_command = "/".join(part.replace("\\", "/") for part in command)
        self.assertIn("backend/scripts/download_models.py", normalized_command)
        self.assertEqual(command[-3:], ["--models", "triposr", "sdxl"])
        self.assertIn("--cache-dir", command)

    def test_hunyuan_check_requires_sidecar_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = setup.check_hunyuan(root)
        self.assertFalse(result.ok)
        self.assertIn("sidecar", result.message.lower())


if __name__ == "__main__":
    unittest.main()
