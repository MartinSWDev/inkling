"""
Export the API's content/subjects payloads as static JSON for the deploy.

The production site is static (Cloudflare Pages, no FastAPI), so the client
fetches web/public/data/content.json and web/public/data/subjects.json
instead of /api/content and /api/subjects. This script reuses the exact
functions in api/main.py, so the output is identical to the API responses.

Run from the repo root:  python scripts/export_static_data.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.main import content, subjects  # noqa: E402

OUT = ROOT / "web" / "public" / "data"


def write(out_dir=OUT):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = {"content.json": content(), "subjects.json": subjects()}
    for name, data in files.items():
        (out_dir / name).write_text(json.dumps(data, ensure_ascii=False))
        print(f"wrote {out_dir / name} ({(out_dir / name).stat().st_size // 1024} KB)")
    return files


if __name__ == "__main__":
    write()
