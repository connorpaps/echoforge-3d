import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "start_local.py"

spec = importlib.util.spec_from_file_location("echoforge_start_local", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load start_local module")
launcher = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = launcher
spec.loader.exec_module(launcher)


class LocalLauncherTests(unittest.TestCase):
    def test_default_specs_do_not_start_the_heavy_sidecar(self):
        specs = launcher.build_specs(with_hunyuan=False)
        self.assertEqual([spec.name for spec in specs], ["backend", "frontend"])
        self.assertFalse(any("start_hunyuan_sidecar" in part for spec in specs for part in spec.command))

    def test_hunyuan_is_explicitly_opt_in(self):
        specs = launcher.build_specs(with_hunyuan=True)
        self.assertEqual([spec.name for spec in specs], ["backend", "frontend", "hunyuan"])
        self.assertTrue(any("start_hunyuan_sidecar" in part for spec in specs for part in spec.command))


if __name__ == "__main__":
    unittest.main()
