"""
Load Australian apprenticeship / traineeship qualifications into the AU pack's
per-subject files.
STATUS: skeleton. It validates inputs and writes the right shape, but ships no
data yet; the downloads below are needed first.

Plan
  1. Source: training.gov.au (TGA), the national register of VET
     qualifications. Export the current qualifications list (TGA search ->
     Qualifications -> export CSV, or the TGA web-services / data.gov.au
     "training.gov.au" extracts). Minimum columns we rely on (matched
     case-insensitively, first hit wins):
        code      "Code" / "National Code" / "Qualification Code"   e.g. "CPC30220"
        title     "Title" / "Qualification Title"                   e.g. "Certificate III in Carpentry"
        field     "Field of Education" / "ASCED" / "FOE"             e.g. "040311" or "040311 - Carpentry and Joinery"
        status    "Status" (optional; only "Current" rows are kept when present)
        duration  "Nominal Duration" / "Duration (months)" (optional)
     Only AQF Certificate III, Certificate IV, Diploma and Advanced Diploma
     qualifications are kept (from an "AQF Level" column, else the title).
  2. Optional: --approved, a CSV of qualification codes approved as
     Australian Apprenticeships / traineeships (each state training authority
     publishes one; any CSV with a code column). When given, only those
     qualifications are kept; otherwise every Cert III-Advanced Diploma is a
     candidate "hands-on route".
  3. Qualification -> subject: its ASCED field through
     scripts/au/asced_crosswalk.json (detailed -> narrow -> broad, plus title
     rules), the same resolver load_cricos.py uses.
  4. Per subject keep up to --max-per-subject (default 6), preferring higher
     AQF levels, then approved apprenticeships, then title. Shape (same as the
     UK file, consumed by web/src/scoring.ts handsOnPicks):
        {ref, title, level, months, degree, url, reason}
     level = AQF level (Cert III 3, Cert IV 4, Diploma 5, Advanced Diploma 6),
     degree = false, url = https://training.gov.au/Training/Details/<code>,
     months = nominal duration if given, else 36 / 24 / 24 / 24 by level,
     reason = "Nationally recognised <title>" until a hand-written table exists.

Usage (from the repo root; standard library only)
    python3 -I scripts/au/load_apprenticeships.py \
        --qualifications data/raw/au/tga_qualifications.csv \
        [--approved data/raw/au/approved_apprenticeships.csv]
    options: --pack web/public/packs/au  --max-per-subject 6  --dry-run

Until the qualifications file exists the script exits 2; nothing is written.
The app hides the Apprenticeships tab for AU while every subject has none.
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PACK = ROOT / "web" / "public" / "packs" / "au"
CROSSWALK = HERE / "asced_crosswalk.json"
TGA_URL = "https://training.gov.au/Training/Details/{code}"

COLS = {
    "code": ("national code", "qualification code", "code"),
    "title": ("qualification title", "title", "name"),
    "field": ("field of education", "asced", "foe"),
    "status": ("status",),
    "aqf": ("aqf level", "level"),
    "duration": ("nominal duration", "duration"),
}
LEVELS = [(re.compile(r"advanced diploma", re.I), 6), (re.compile(r"\bdiploma\b", re.I), 5),
          (re.compile(r"certificate iv\b|certificate 4\b", re.I), 4), (re.compile(r"certificate iii\b|certificate 3\b", re.I), 3)]
DEFAULT_MONTHS = {3: 36, 4: 24, 5: 24, 6: 24}


def _crosswalk():
    spec = importlib.util.spec_from_file_location("au_build_crosswalk", HERE / "build_crosswalk.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod.Crosswalk(mod.load_raw(CROSSWALK))


def find_cols(fieldnames: list[str] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    names = {re.sub(r"[^a-z0-9]+", " ", (f or "").lower()).strip(): f for f in (fieldnames or [])}
    for key, wanted in COLS.items():
        for w in wanted:
            hit = next((orig for n, orig in names.items() if n == w), None) or \
                  next((orig for n, orig in names.items() if w in n), None)
            if hit:
                out[key] = hit
                break
    return out


def aqf_level(row: dict, cols: dict[str, str]) -> int | None:
    raw = (row.get(cols.get("aqf", ""), "") or "").strip()
    m = re.search(r"\d", raw)
    if m and int(m.group()) in DEFAULT_MONTHS:
        return int(m.group())
    text = raw + " " + (row.get(cols["title"], "") or "")
    for rx, lvl in LEVELS:
        if rx.search(text):
            return lvl
    return None


def months_from(row: dict, cols: dict[str, str], level: int) -> int:
    raw = (row.get(cols.get("duration", ""), "") or "").strip().lower()
    m = re.search(r"(\d+(?:\.\d+)?)", raw)
    if m:
        n = float(m.group(1))
        if "year" in raw:
            n *= 12
        elif "week" in raw:
            n /= 4.33
        if n >= 1:
            return round(n)
    return DEFAULT_MONTHS[level]


def load_approved(path: Path | None) -> set[str] | None:
    if path is None:
        return None
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        cols = find_cols(reader.fieldnames)
        if "code" not in cols:
            raise SystemExit(f"{path}: no code column; found {reader.fieldnames}")
        return {(r.get(cols["code"]) or "").strip().upper() for r in reader if (r.get(cols["code"]) or "").strip()}


def load_qualifications(path: Path, cw, approved: set[str] | None) -> dict[str, list[dict]]:
    per_subject: dict[str, list[dict]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        cols = find_cols(reader.fieldnames)
        missing = [k for k in ("code", "title", "field") if k not in cols]
        if missing:
            raise SystemExit(f"{path}: missing columns {missing}; found {reader.fieldnames}")
        for row in reader:
            if "status" in cols and (row.get(cols["status"]) or "").strip().lower() not in ("", "current"):
                continue
            code = (row.get(cols["code"]) or "").strip().upper()
            title = re.sub(r"\s+", " ", (row.get(cols["title"]) or "")).strip()
            if not code or not title:
                continue
            if approved is not None and code not in approved:
                continue
            level = aqf_level(row, cols)
            if level is None:
                continue
            subjects, _ = cw.resolve([row.get(cols["field"])], title)
            entry = {
                "ref": code,
                "title": title,
                "level": level,
                "months": months_from(row, cols, level),
                "degree": False,
                "url": TGA_URL.format(code=code),
                "reason": f"Nationally recognised {title}",
                "_approved": approved is not None,
            }
            for s in subjects:
                per_subject[s].append(entry)
    return per_subject


def write(per_subject: dict[str, list[dict]], pack: Path, max_per_subject: int, dry_run: bool) -> int:
    touched = 0
    for target in sorted((pack / "subjects").glob("CAH*.json")):
        data = json.loads(target.read_text(encoding="utf-8"))
        picks: list[dict] = []
        seen: set[str] = set()
        for a in sorted(per_subject.get(data["code"], []), key=lambda a: (-a["level"], not a["_approved"], a["title"])):
            if a["title"] in seen:
                continue
            seen.add(a["title"])
            picks.append({k: v for k, v in a.items() if not k.startswith("_")})
            if len(picks) >= max_per_subject:
                break
        data["apprenticeships"] = picks
        touched += 1
        if not dry_run:
            target.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return touched


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--qualifications", type=Path, required=True, help="training.gov.au qualifications CSV")
    ap.add_argument("--approved", type=Path, help="optional CSV of codes approved as apprenticeships / traineeships")
    ap.add_argument("--pack", type=Path, default=PACK)
    ap.add_argument("--max-per-subject", type=int, default=6)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    missing = [p for p in (args.qualifications, args.approved) if p is not None and not p.exists()]
    if missing:
        print("apprenticeship inputs not downloaded yet: " + ", ".join(str(p) for p in missing), file=sys.stderr)
        print("See data/au/README.md. Nothing written; per-subject files keep apprenticeships: [].", file=sys.stderr)
        return 2

    cw = _crosswalk()
    approved = load_approved(args.approved)
    per_subject = load_qualifications(args.qualifications, cw, approved)
    touched = write(per_subject, args.pack, args.max_per_subject, args.dry_run)
    with_data = sum(1 for v in per_subject.values() if v)
    print(f"{'would update' if args.dry_run else 'updated'} {touched} subject files; {with_data} subjects have apprenticeships")
    return 0


if __name__ == "__main__":
    sys.exit(main())
