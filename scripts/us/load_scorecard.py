"""
Load College Scorecard field-of-study data into the US pack's per-subject files.

Inputs (download by hand; US government sites may be blocked from build boxes)
  https://collegescorecard.ed.gov/data  ->
    "Most Recent Data by Field of Study"   -> Most-Recent-Cohorts-Field-of-Study.csv
    "Most Recent Institution-Level Data"   -> Most-Recent-Cohorts-Institution.csv
  Save them anywhere (data/raw/us/ is the convention; it is git-ignored).

Usage (from the repo root; standard library only, pandas is NOT required)
    python3 -I scripts/us/load_scorecard.py \
        --fos  data/raw/us/Most-Recent-Cohorts-Field-of-Study.csv \
        --inst data/raw/us/Most-Recent-Cohorts-Institution.csv
    options: --max-per-subject 200   --pack web/public/packs/us   --dry-run

What it does
  1. Reads the institution file into {UNITID: {name, city, state, url, locale,
     control, region, adm_rate, net_price}}.
  2. Streams the field-of-study file, keeping bachelor's rows (CREDLEV == 3),
     normalising CIPCODE to the 4-digit "NN.NN" family, and dropping rows with
     no IPEDSCOUNT2 (no recent graduates).
  3. Maps each CIP family to subject codes via scripts/us/cip_crosswalk.json.
  4. For each subject, keeps at most --max-per-subject courses, preferring
     larger programs (IPEDSCOUNT2 desc), one row per (institution, CIP).
  5. Writes web/public/packs/us/subjects/<code>.json:
        {code, attribution, courses:[...], jobs:[copied from UK file],
         apprenticeships:[kept from the existing file]}
     course shape: {title, provider, url, ucas_code: null,
                    setting: city|suburb|town|rural|null, town: "CITY, ST",
                    earnings: int|null, state: "ST"}
  6. Updates course_count in web/public/packs/us/data/subjects.json.

Column names tolerated
  FoS:  UNITID, INSTNM, CONTROL, CIPCODE, CIPDESC, CREDLEV, CREDDESC, IPEDSCOUNT2,
        EARN_MDN_4YR (fallbacks: EARN_MDN_HI_2YR, EARN_MDN_1YR, EARN_MDN_HI_1YR)
  Inst: UNITID, INSTNM, CITY, STABBR, REGION, LOCALE, INSTURL, ADM_RATE, NPT4_PUB, NPT4_PRIV
  Suppressed values ("PrivacySuppressed", "NULL", "") become null.

Attribution: "Contains College Scorecard data from the U.S. Department of
Education (public domain)."
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
UK_SUBJECTS_DIR = ROOT / "web" / "public" / "subjects"
CROSSWALK = Path(__file__).resolve().parent / "cip_crosswalk.json"

ATTRIBUTION = "Contains College Scorecard data from the U.S. Department of Education (public domain)."
BACHELORS_CREDLEV = "3"
EARN_COLUMNS = ("EARN_MDN_4YR", "EARN_MDN_HI_2YR", "EARN_MDN_1YR", "EARN_MDN_HI_1YR")
SUPPRESSED = {"", "NULL", "PrivacySuppressed", "NA", "N/A", "null"}

REQUIRED_FOS = {"UNITID", "INSTNM", "CIPCODE", "CIPDESC", "CREDLEV", "IPEDSCOUNT2"}
REQUIRED_INST = {"UNITID", "INSTNM", "CITY", "STABBR", "LOCALE", "INSTURL"}

csv.field_size_limit(1 << 24)


def clean(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return None if v in SUPPRESSED else v


def to_int(v: str | None) -> int | None:
    v = clean(v)
    if v is None:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def to_float(v: str | None) -> float | None:
    v = clean(v)
    if v is None:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def cip4(raw: str | None) -> str | None:
    """'1101' / '11.01' / '11.0101' / '110101' / '1101.0' -> '11.01'."""
    raw = clean(raw)
    if raw is None:
        return None
    digits = re.sub(r"\D", "", raw)
    if "." in raw:
        head, _, tail = raw.partition(".")
        digits = head.zfill(2) + tail
    if len(digits) < 4:
        digits = digits.zfill(4)
    return f"{digits[:2]}.{digits[2:4]}"


def setting_from_locale(locale: str | None) -> str | None:
    n = to_int(locale)
    if n is None:
        return None
    if 11 <= n <= 13:
        return "city"
    if 21 <= n <= 23:
        return "suburb"
    if 31 <= n <= 33:
        return "town"
    if 41 <= n <= 43:
        return "rural"
    return None


def normalise_url(url: str | None) -> str | None:
    url = clean(url)
    if not url:
        return None
    url = url.strip().strip("/")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    else:
        url = re.sub(r"^http://", "https://", url, flags=re.I)
    return url


def title_from_cipdesc(desc: str | None) -> str:
    desc = clean(desc) or ""
    return desc.rstrip(". ").strip()


def check_columns(found: list[str] | None, required: set[str], label: str) -> None:
    missing = sorted(required - set(found or []))
    if missing:
        raise SystemExit(f"{label}: missing columns {missing}; found {found[:12] if found else found}...")


def load_institutions(path: Path) -> dict[str, dict]:
    inst: dict[str, dict] = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        check_columns(reader.fieldnames, REQUIRED_INST, "institution file")
        for row in reader:
            uid = clean(row.get("UNITID"))
            if not uid:
                continue
            inst[uid] = {
                "name": clean(row.get("INSTNM")),
                "city": clean(row.get("CITY")),
                "state": clean(row.get("STABBR")),
                "url": normalise_url(row.get("INSTURL")),
                "setting": setting_from_locale(row.get("LOCALE")),
                "region": to_int(row.get("REGION")),
                "control": to_int(row.get("CONTROL")),
                "adm_rate": to_float(row.get("ADM_RATE")),
                "net_price": to_int(row.get("NPT4_PUB")) or to_int(row.get("NPT4_PRIV")),
            }
    return inst


def load_crosswalk(path: Path = CROSSWALK) -> dict[str, list[str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, list[str]] = {}
    for m in data["mappings"]:
        out[m["cip4"]] = list(m["subjects"])
    return out


def pick_earnings(row: dict) -> int | None:
    for col in EARN_COLUMNS:
        if col in row:
            v = to_int(row[col])
            if v is not None:
                return v
    return None


def collect_courses(fos_path: Path, inst: dict[str, dict], cip_to_subjects: dict[str, list[str]]) -> tuple[dict[str, list[tuple[int, dict]]], dict]:
    """Return ({code: [(count, course), ...]}, stats)."""
    per_subject: dict[str, list[tuple[int, dict]]] = defaultdict(list)
    stats = {"rows": 0, "bachelors": 0, "with_grads": 0, "mapped": 0, "unmapped_cips": defaultdict(int), "no_inst": 0}
    seen: set[tuple[str, str, str]] = set()
    with fos_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        check_columns(reader.fieldnames, REQUIRED_FOS, "field-of-study file")
        for row in reader:
            stats["rows"] += 1
            if clean(row.get("CREDLEV")) != BACHELORS_CREDLEV:
                continue
            stats["bachelors"] += 1
            count = to_int(row.get("IPEDSCOUNT2"))
            if count is None or count <= 0:
                continue
            stats["with_grads"] += 1
            fam = cip4(row.get("CIPCODE"))
            subjects = cip_to_subjects.get(fam or "")
            if not subjects:
                stats["unmapped_cips"][fam] += 1
                continue
            uid = clean(row.get("UNITID")) or ""
            info = inst.get(uid)
            provider = (info or {}).get("name") or clean(row.get("INSTNM"))
            if not provider:
                stats["no_inst"] += 1
                continue
            city = (info or {}).get("city")
            state = (info or {}).get("state")
            course = {
                "title": title_from_cipdesc(row.get("CIPDESC")),
                "provider": provider,
                "url": (info or {}).get("url"),
                "ucas_code": None,
                "setting": (info or {}).get("setting"),
                "town": ", ".join(p for p in (city, state) if p) or None,
                "earnings": pick_earnings(row),
                "state": state,
            }
            stats["mapped"] += 1
            for code in subjects:
                key = (code, uid, fam or "")
                if key in seen:
                    continue
                seen.add(key)
                per_subject[code].append((count, course))
    return per_subject, stats


def write_subject_files(per_subject: dict[str, list[tuple[int, dict]]], codes: list[str], pack: Path, max_per_subject: int, dry_run: bool) -> dict[str, int]:
    subj_dir = pack / "subjects"
    subj_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for code in codes:
        ranked = sorted(per_subject.get(code, []), key=lambda t: (-t[0], t[1]["provider"], t[1]["title"]))
        courses = [c for _, c in ranked[:max_per_subject]]
        target = subj_dir / f"{code}.json"
        existing = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
        uk_file = UK_SUBJECTS_DIR / f"{code}.json"
        jobs = existing.get("jobs")
        if not jobs and uk_file.exists():
            jobs = json.loads(uk_file.read_text(encoding="utf-8")).get("jobs", [])
        payload = {
            "code": code,
            "attribution": ATTRIBUTION,
            "courses": courses,
            "jobs": jobs or [],
            "apprenticeships": existing.get("apprenticeships", []),
        }
        counts[code] = len(courses)
        if not dry_run:
            target.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return counts


def update_course_counts(pack: Path, counts: dict[str, int], dry_run: bool) -> None:
    path = pack / "data" / "subjects.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    for s in data["subjects"]:
        s["course_count"] = counts.get(s["code"], 0)
    if not dry_run:
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fos", required=True, type=Path, help="Most-Recent-Cohorts-Field-of-Study.csv")
    ap.add_argument("--inst", required=True, type=Path, help="Most-Recent-Cohorts-Institution.csv")
    ap.add_argument("--pack", type=Path, default=PACK, help="pack directory (default web/public/packs/us)")
    ap.add_argument("--max-per-subject", type=int, default=200)
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = ap.parse_args(argv)

    for p in (args.fos, args.inst):
        if not p.exists():
            raise SystemExit(f"missing input: {p}\nSee data/us/README.md for where to download the Scorecard files.")
    subjects_path = args.pack / "data" / "subjects.json"
    if not subjects_path.exists():
        raise SystemExit(f"{subjects_path} not found; run python3 -I scripts/us/build_pack.py first")
    codes = [s["code"] for s in json.loads(subjects_path.read_text(encoding="utf-8"))["subjects"]]

    cip_to_subjects = load_crosswalk()
    print(f"reading institutions from {args.inst} ...")
    inst = load_institutions(args.inst)
    print(f"  {len(inst)} institutions")
    print(f"reading field-of-study rows from {args.fos} ...")
    per_subject, stats = collect_courses(args.fos, inst, cip_to_subjects)
    print(f"  rows {stats['rows']}, bachelor's {stats['bachelors']}, with graduates {stats['with_grads']}, mapped {stats['mapped']}")
    if stats["unmapped_cips"]:
        top = sorted(stats["unmapped_cips"].items(), key=lambda kv: -kv[1])[:15]
        print("  unmapped CIP families (add to cip_crosswalk.json?): " + ", ".join(f"{k}x{v}" for k, v in top))

    counts = write_subject_files(per_subject, codes, args.pack, args.max_per_subject, args.dry_run)
    update_course_counts(args.pack, counts, args.dry_run)
    empty = [c for c in codes if counts.get(c, 0) == 0]
    print(f"{'would write' if args.dry_run else 'wrote'} {len(codes)} subject files; "
          f"{sum(counts.values())} courses total; {len(empty)} subjects with no courses")
    if empty:
        shown = ", ".join(empty[:25]) + (f" ... (+{len(empty) - 25} more)" if len(empty) > 25 else "")
        print("  empty: " + shown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
