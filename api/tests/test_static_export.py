import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("export_static_data", ROOT / "scripts" / "export_static_data.py")
export_static_data = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(export_static_data)

from api.main import content, subjects  # noqa: E402


def test_static_export_matches_api(tmp_path):
    files = export_static_data.write(tmp_path)
    assert files["content.json"] == content()
    assert files["subjects.json"] == subjects()
    for name in ("content.json", "subjects.json"):
        assert json.loads((tmp_path / name).read_text()) == files[name]


def test_shipped_static_data_matches_api():
    data = ROOT / "web" / "public" / "data"
    assert json.loads((data / "content.json").read_text()) == content()
    assert json.loads((data / "subjects.json").read_text()) == subjects()
