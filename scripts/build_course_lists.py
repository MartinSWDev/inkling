"""Build per-subject course lists for the reveal from the HESA database.

Run from the repo root: python scripts/build_course_lists.py
Reads data/processed/inkling.db read-only; writes web/public/subjects/<code>.json
(up to 12 full-time courses, at most one per provider, each with a course URL).
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "inkling.db"
OUT = ROOT / "web" / "public" / "subjects"
ATTRIBUTION = "Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0"


def main():
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    subjects = db.execute("SELECT code, level FROM subjects WHERE level >= 2 ORDER BY code").fetchall()
    children: dict[str, list[str]] = {}
    for row in db.execute("SELECT code, parent_code FROM subjects WHERE parent_code IS NOT NULL"):
        children.setdefault(row["parent_code"], []).append(row["code"])
    OUT.mkdir(parents=True, exist_ok=True)
    empty = []
    total = 0
    for subj in subjects:
        code = subj["code"]
        codes = [code, *children.get(code, [])]
        marks = ",".join("?" * len(codes))
        rows = db.execute(
            f"""SELECT c.title, p.name AS provider, c.url, c.ucas_code, c.ukprn
                FROM courses c
                JOIN course_subjects cs ON cs.course_id = c.id
                JOIN providers p ON p.ukprn = c.ukprn
                WHERE cs.cah_code IN ({marks}) AND c.mode = 'Full-time'
                  AND c.url IS NOT NULL AND c.url != ''
                ORDER BY p.name, c.title""", codes).fetchall()
        picked, seen = [], set()
        for r in rows:
            if r["ukprn"] in seen:
                continue
            seen.add(r["ukprn"])
            picked.append({"title": r["title"], "provider": r["provider"], "url": r["url"], "ucas_code": r["ucas_code"]})
            if len(picked) >= 12:
                break
        if not picked:
            empty.append(code)
        total += len(picked)
        (OUT / f"{code}.json").write_text(json.dumps(
            {"code": code, "attribution": ATTRIBUTION, "courses": picked}, indent=1))
    print(f"subjects: {len(subjects)}, course entries: {total}, subjects with no courses: {len(empty)} {empty[:8]}")


if __name__ == "__main__":
    main()
