import importlib.util
import socket
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "doctor.py"

spec = importlib.util.spec_from_file_location("echoforge_doctor", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load doctor module")
doctor = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = doctor
spec.loader.exec_module(doctor)


class SetupToolsTests(unittest.TestCase):
    def test_check_path_reports_existing_and_missing_paths(self):
        self.assertTrue(doctor.check_path(ROOT / "package.json"))
        self.assertFalse(doctor.check_path(ROOT / "path-that-does-not-exist"))

    def test_check_port_detects_a_listener_without_connecting_to_external_hosts(self):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
            server.bind(("127.0.0.1", 0))
            server.listen(1)
            port = server.getsockname()[1]
            self.assertTrue(doctor.port_is_open(port))

        self.assertFalse(doctor.port_is_open(port))

    def test_summarize_does_not_include_environment_values(self):
        report = doctor.summarize(
            [
                doctor.Check("token", False, "HF_TOKEN is configured", optional=True),
                doctor.Check("root", True, "path exists", optional=False),
            ]
        )
        self.assertNotIn("HF_TOKEN", report)
        self.assertIn("optional", report.lower())
        self.assertIn("required", report.lower())


if __name__ == "__main__":
    unittest.main()
