"""
Load US registered-apprenticeship data into the US pack's per-subject files.
STATUS: skeleton. It validates inputs and writes the right shape, but ships no
data yet; the two open-data downloads below are needed first.

Plan
  1. Source: apprenticeship.gov open data (RAPIDS, the Registered Apprenticeship
     Partners Information Data System), the "Registered Apprenticeship National
     Results" / occupation files published by the US Department of Labor at
     https://www.apprenticeship.gov/data-and-statistics  (public domain).
     Minimum columns we rely on (names as they appear in the occupation list):
        ONET_SOC_CODE      e.g. "17-3023.00"
        OCCUPATION_TITLE   e.g. "Electrical and Electronic Engineering Technologists"
        RAPIDS_CODE        e.g. "0159"   (used as the "ref")
        TERM_LENGTH_MONTHS or TERM_HOURS (hours / 2000 * 12 -> months, rounded)
        APPRENTICESHIP_TYPE / "DEGREE_BASED" flag if present -> degree: bool
        URL (program finder link) if present, else a search link
  2. Occupation -> subject: NCES CIP-to-SOC crosswalk
     https://nces.ed.gov/ipeds/cipcode/resources.aspx?y=56  ("CIP 2020 - SOC 2018 Crosswalk")
     columns CIP2020Code, CIP2020Title, SOC2018Code, SOC2018Title.
     SOC 2018 codes are the first 7 characters of O*NET-SOC ("17-3023").
     Chain: RAPIDS occupation -> O*NET-SOC -> SOC 2018 -> CIP 2020 (6 digit)
            -> CIP 4-digit family -> subjects via scripts/us/cip_crosswalk.json.
  3. Per subject keep up to --max-per-subject (default 6) apprenticeships,
     preferring degree-based programs, then longer terms, titles unique.
     Shape (same as the UK file, consumed by web/src/scoring.ts handsOnPicks):
        {ref, title, level, months, degree, url, reason}
     "level" has no US equivalent; we emit 6 for degree-based programs and 3
     otherwise so the UK level labels ("Hands-on" / "Degree apprenticeship")
     still read sensibly. "reason" is a one-line plain-words hook; until a
     hand-written table exists it is "Registered apprenticeship in <title>".

Usage (from the repo root; standard library only)
    python3 -I scripts/us/load_apprenticeships.py \
        --rapids data/raw/us/rapids_occupations.csv \
        --cip-soc data/raw/us/CIP2020_SOC2018_Crosswalk.csv
    options: --pack web/public/packs/us  --max-per-subject 6  --dry-run

Until both inputs exist the script exits 2 with a message; nothing is written.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "web" / "public" / "packs" / "us"
CROSSWALK = Path(__file__).resolve().parent / "cip_crosswalk.json"

RAPIDS_REQUIRED = {"ONET_SOC_CODE", "OCCUPATION_TITLE", "RAPIDS_CODE"}
RAPIDS_OPTIONAL = {"TERM_LENGTH_MONTHS", "TERM_HOURS", "APPRENTICESHIP_TYPE", "DEGREE_BASED", "URL"}
CIPSOC_REQUIRED = {"CIP2020Code", "SOC2018Code"}
FINDER_URL = "https://www.apprenticeship.gov/apprenticeship-job-finder?keyword={q}"


def check_columns(found: list[str] | None, required: set[str], label: str) -> None:
    missing = sorted(required - set(found or []))
    if missing:
        raise SystemExit(f"{label}: missing columns {missing}; found {found}")


def soc7(onet: str) -> str:
    """'17-3023.00' -> '17-3023'."""
    return onet.strip()[:7]


def cip4(code: str) -> str:
    """'11.0701' / '110701' -> '11.07'."""
    digits = re.sub(r"\D", "", code)
    return f"{digits[:2]}.{digits[2:4]}"


def load_cip_soc(path: Path) -> dict[str, set[str]]:
    """SOC2018 code -> set of CIP 4-digit families."""
    out: dict[str, set[str]] = defaultdict(set)
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        check_columns(reader.fieldnames, CIPSOC_REQUIRED, "CIP-SOC crosswalk")
        for row in reader:
            soc = (row.get("SOC2018Code") or "").strip()
            cip = (row.get("CIP2020Code") or "").strip()
            if soc and cip and re.search(r"\d", cip):
                out[soc7(soc)].add(cip4(cip))
    return out


def load_subject_cips(path: Path = CROSSWALK) -> dict[str, list[str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, list[str]] = defaultdict(list)
    for m in data["mappings"]:
        for code in m["subjects"]:
            out[m["cip4"]].append(code)
    return out


def months_from(row: dict) -> int:
    v = (row.get("TERM_LENGTH_MONTHS") or "").strip()
    if v:
        try:
            return max(1, int(float(v)))
        except ValueError:
            pass
    h = (row.get("TERM_HOURS") or "").strip()
    if h:
        try:
            return max(1, round(float(h) / 2000 * 12))
        except ValueError:
            pass
    return 24


def is_degree(row: dict) -> bool:
    flag = (row.get("DEGREE_BASED") or "").strip().lower()
    typ = (row.get("APPRENTICESHIP_TYPE") or "").strip().lower()
    return flag in {"1", "y", "yes", "true"} or "degree" in typ


def load_rapids(path: Path, soc_to_cips: dict[str, set[str]], cip_to_subjects: dict[str, list[str]]) -> dict[str, list[dict]]:
    per_subject: dict[str, list[dict]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        check_columns(reader.fieldnames, RAPIDS_REQUIRED, "RAPIDS occupation file")
        for row in reader:
            soc = soc7(row.get("ONET_SOC_CODE") or "")
            title = (row.get("OCCUPATION_TITLE") or "").strip()
            ref = (row.get("RAPIDS_CODE") or "").strip()
            if not (soc and title and ref):
                continue
            degree = is_degree(row)
            entry = {
                "ref": ref,
                "title": title,
                "level": 6 if degree else 3,
                "months": months_from(row),
                "degree": degree,
                "url": (row.get("URL") or "").strip() or FINDER_URL.format(q=re.sub(r"\s+", "+", title)),
                "reason": f"Registered apprenticeship in {title.lower()}",
            }
            for fam in soc_to_cips.get(soc, ()):
                for code in cip_to_subjects.get(fam, ()):
                    per_subject[code].append(entry)
    return per_subject


def write(per_subject: dict[str, list[dict]], pack: Path, max_per_subject: int, dry_run: bool) -> int:
    subj_dir = pack / "subjects"
    touched = 0
    for target in sorted(subj_dir.glob("CAH*.json")):
        data = json.loads(target.read_text(encoding="utf-8"))
        code = data["code"]
        picks: list[dict] = []
        seen: set[str] = set()
        for a in sorted(per_subject.get(code, []), key=lambda a: (not a["degree"], -a["months"], a["title"])):
            if a["title"] in seen:
                continue
            seen.add(a["title"])
            picks.append(a)
            if len(picks) >= max_per_subject:
                break
        data["apprenticeships"] = picks
        touched += 1
        if not dry_run:
            target.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return touched


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--rapids", type=Path, required=True, help="RAPIDS occupation CSV from apprenticeship.gov")
    ap.add_argument("--cip-soc", type=Path, required=True, help="NCES CIP 2020 - SOC 2018 crosswalk CSV")
    ap.add_argument("--pack", type=Path, default=PACK)
    ap.add_argument("--max-per-subject", type=int, default=6)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    missing = [p for p in (args.rapids, args.cip_soc) if not p.exists()]
    if missing:
        print("apprenticeship inputs not downloaded yet: " + ", ".join(str(p) for p in missing), file=sys.stderr)
        print("See data/us/README.md. Nothing written; per-subject files keep apprenticeships: [].", file=sys.stderr)
        return 2

    soc_to_cips = load_cip_soc(args.cip_soc)
    cip_to_subjects = load_subject_cips()
    per_subject = load_rapids(args.rapids, soc_to_cips, cip_to_subjects)
    touched = write(per_subject, args.pack, args.max_per_subject, args.dry_run)
    with_data = sum(1 for v in per_subject.values() if v)
    print(f"{'would update' if args.dry_run else 'updated'} {touched} subject files; {with_data} subjects have apprenticeships")
    return 0


if __name__ == "__main__":
    sys.exit(main())
