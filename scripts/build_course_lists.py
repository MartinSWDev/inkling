"""Build per-subject course lists for the reveal from the HESA database.

Run from the repo root: python scripts/build_course_lists.py
Reads data/processed/inkling.db read-only; writes web/public/subjects/<code>.json
(up to 16 full-time courses, at most one per provider, each with a course URL,
its campus setting/town from data/campus_settings.json via COURSELOCATION.csv).
Campus settings tagged by Muse Spark Open from HESA location data.
"""
import csv
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
    relevance = {}
    rel_path = ROOT / "data" / "course_relevance.json"
    if rel_path.exists():
        relevance = json.loads(rel_path.read_text()).get("subjects", {})
    # Campus settings: course id -> setting/town via COURSELOCATION + the
    # Spark Open tags; fall back to the provider's majority setting.
    campus = json.loads((ROOT / "data" / "campus_settings.json").read_text())
    loc_tags = campus.get("locations", {})
    prov_tags = campus.get("providers", {})
    course_setting: dict[str, dict] = {}
    loc_csv = ROOT / "data" / "raw" / "on_2026_10_20_13_24_40" / "COURSELOCATION.csv"
    if loc_csv.exists():
        with open(loc_csv, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                cid = f"{row['UKPRN']}:{row['KISCOURSEID']}:{row['KISMODE']}"
                tag = loc_tags.get(f"{row['UKPRN']}:{row['LOCID']}")
                if tag:
                    course_setting.setdefault(cid, {"setting": tag["setting"], "town": tag.get("town")})
                elif cid not in course_setting and row["UKPRN"] in prov_tags:
                    course_setting[cid] = {"setting": prov_tags[row["UKPRN"]], "town": None, "_fallback": True}
                # A tagged location later in the file beats the provider fallback.
                if tag and course_setting.get(cid, {}).get("_fallback"):
                    course_setting[cid] = {"setting": tag["setting"], "town": tag.get("town")}
    subjects = db.execute("SELECT code, name, level FROM subjects WHERE level >= 2 ORDER BY code").fetchall()
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
            f"""SELECT c.id, c.title, p.name AS provider, c.url, c.ucas_code, c.ukprn
                FROM courses c
                JOIN course_subjects cs ON cs.course_id = c.id
                JOIN providers p ON p.ukprn = c.ukprn
                WHERE cs.cah_code IN ({marks}) AND c.mode = 'Full-time'
                  AND c.url IS NOT NULL AND c.url != ''
                  AND lower(c.title) NOT LIKE '%foundation%'
                ORDER BY p.name, c.title""", codes).fetchall()
        # Prefer titles that contain the subject's key word, universities first.
        stop = {"studies", "science", "sciences", "general", "others", "non", "specific", "with"}
        keywords = [w.strip("(),").lower() for w in subj["name"].replace("-", " ").split() if len(w.strip("(),")) > 3 and w.lower() not in stop]
        def contains_kw(title: str) -> bool:
            low = title.lower()
            return any(k in low for k in keywords) if keywords else False
        def is_uni(provider: str) -> bool:
            return "univers" in provider.lower() or provider.strip().isupper() and "UNIVERSITY" in provider
        matched = [r for r in rows if contains_kw(r["title"])]
        pool = matched if len(matched) >= 4 else rows
        pool = sorted(pool, key=lambda r: (0 if contains_kw(r["title"]) else 1, 0 if is_uni(r["provider"]) else 1, r["provider"], r["title"]))
        # Spark Open relevance ratings win when present: score >= 2 and not a
        # variant; fall back to score 1 when fewer than 3 courses remain.
        scores = relevance.get(code) or {}
        if scores:
            def rel(r):
                e = scores.get(r["title"])
                return e if e and not e.get("variant") else None
            strong = [r for r in rows if (rel(r) or {}).get("score", 0) >= 2]
            if len({r["ukprn"] for r in strong}) < 3:
                strong += [r for r in rows if (rel(r) or {}).get("score", 0) == 1]
            if strong:
                pool = sorted(strong, key=lambda r: (-(rel(r) or {"score": 0})["score"],
                                                     0 if is_uni(r["provider"]) else 1, r["provider"], r["title"]))
        picked, seen = [], set()
        for r in pool:
            if r["ukprn"] in seen:
                continue
            seen.add(r["ukprn"])
            provider = r["provider"]
            if provider == provider.upper() and len(provider) > 3:
                provider = provider.title()
            tag = course_setting.get(r["id"]) or {}
            picked.append({"title": r["title"], "provider": provider, "url": r["url"], "ucas_code": r["ucas_code"],
                           "setting": tag.get("setting"), "town": tag.get("town")})
            if len(picked) >= 16:
                break
        if not picked:
            empty.append(code)
        total += len(picked)
        (OUT / f"{code}.json").write_text(json.dumps(
            {"code": code, "attribution": ATTRIBUTION, "courses": picked}, indent=1))
    print(f"subjects: {len(subjects)}, course entries: {total}, subjects with no courses: {len(empty)} {empty[:8]}")


if __name__ == "__main__":
    main()
