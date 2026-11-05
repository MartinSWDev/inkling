"""
Validate the hand-authored CIP 2020 -> CAH3 crosswalk and print a coverage report.

The crosswalk (scripts/us/cip_crosswalk.json) is the heart of the US data pack:
it decides which College Scorecard programs (keyed by 4-digit CIP family) feed
which of Inkling's 163 UK subject codes. Scoring stays on the UK codes; only
the course lists change country.

Checks
  * every mapping has a well-formed "cip4" (NN.NN), a title and 1-2 subjects
  * no CIP appears twice
  * every subject code exists in web/public/data/subjects.json
  * every one of the 163 subjects receives at least one CIP
  * "confidence", when present, is "low"

Run from the repo root (no third-party packages needed):
    python3 -I scripts/us/build_crosswalk.py            # validate + report
    python3 -I scripts/us/build_crosswalk.py --quiet    # errors only, exit code
    python3 -I scripts/us/build_crosswalk.py --subjects-out path.json
        also writes {code: [cip4, ...]} for other tools

Exit status is 1 when any check fails.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CROSSWALK = Path(__file__).resolve().parent / "cip_crosswalk.json"
SUBJECTS = ROOT / "web" / "public" / "data" / "subjects.json"

CIP4_RE = re.compile(r"^\d{2}\.\d{2}$")
CODE_RE = re.compile(r"^CAH\d{2}-\d{2}-\d{2}$")


def load_subject_codes(path: Path = SUBJECTS) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data["subjects"] if isinstance(data, dict) else data
    return {s["code"]: s.get("display_name", s.get("name", "")) for s in items}


def load_crosswalk(path: Path = CROSSWALK) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["mappings"] if isinstance(data, dict) else data


def validate(mappings: list[dict], codes: dict[str, str]) -> tuple[list[str], dict[str, list[str]]]:
    """Return (errors, {subject_code: [cip4, ...]})."""
    errors: list[str] = []
    seen = Counter()
    by_subject: dict[str, list[str]] = defaultdict(list)
    for i, m in enumerate(mappings):
        where = f"mapping #{i} ({m.get('cip4', '?')})"
        cip = m.get("cip4")
        if not isinstance(cip, str) or not CIP4_RE.match(cip):
            errors.append(f"{where}: cip4 must look like 'NN.NN'")
            continue
        seen[cip] += 1
        if not isinstance(m.get("title"), str) or not m["title"].strip():
            errors.append(f"{where}: missing title")
        subjects = m.get("subjects")
        if not isinstance(subjects, list) or not 1 <= len(subjects) <= 2:
            errors.append(f"{where}: subjects must be a list of 1-2 codes")
            continue
        if len(set(subjects)) != len(subjects):
            errors.append(f"{where}: duplicate subject in list")
        for code in subjects:
            if not isinstance(code, str) or not CODE_RE.match(code):
                errors.append(f"{where}: malformed subject code {code!r}")
            elif code not in codes:
                errors.append(f"{where}: unknown subject code {code}")
            else:
                by_subject[code].append(cip)
        conf = m.get("confidence")
        if conf is not None and conf != "low":
            errors.append(f"{where}: confidence must be 'low' or absent, got {conf!r}")
        extra = set(m) - {"cip4", "title", "subjects", "confidence", "note"}
        if extra:
            errors.append(f"{where}: unexpected keys {sorted(extra)}")
    for cip, n in seen.items():
        if n > 1:
            errors.append(f"cip4 {cip} appears {n} times")
    missing = [c for c in codes if c not in by_subject]
    for code in missing:
        errors.append(f"subject {code} ({codes[code]}) receives no CIP")
    return errors, by_subject


def report(mappings: list[dict], codes: dict[str, str], by_subject: dict[str, list[str]]) -> str:
    counts = Counter(len(by_subject.get(c, [])) for c in codes)
    low = [m for m in mappings if m.get("confidence") == "low"]
    two = sum(1 for m in mappings if len(m.get("subjects", [])) == 2)
    series = Counter(m["cip4"][:2] for m in mappings if isinstance(m.get("cip4"), str))
    lines = [
        f"CIP families mapped: {len(mappings)} ({two} map to two subjects, {len(mappings) - two} to one)",
        f"CIP families marked confidence=low: {len(low)}",
        f"Subjects: {len(codes)} total; with 0 CIPs: {counts[0]}, with 1 CIP: {counts[1]}, "
        f"with 2+ CIPs: {sum(v for k, v in counts.items() if k >= 2)}",
        "CIP two-digit series covered: " + ", ".join(f"{k}({v})" for k, v in sorted(series.items())),
        "",
        "Subjects with a single CIP (thinnest coverage):",
    ]
    for code in sorted(codes):
        cips = by_subject.get(code, [])
        if len(cips) == 1:
            lines.append(f"  {code}  {codes[code]:<55} <- {cips[0]}")
    lines.append("")
    lines.append("Subjects fed only by low-confidence CIPs:")
    low_cips = {m["cip4"] for m in low}
    for code in sorted(codes):
        cips = by_subject.get(code, [])
        if cips and all(c in low_cips for c in cips):
            lines.append(f"  {code}  {codes[code]:<55} <- {', '.join(cips)}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--crosswalk", type=Path, default=CROSSWALK)
    ap.add_argument("--subjects", type=Path, default=SUBJECTS)
    ap.add_argument("--subjects-out", type=Path, help="write {code: [cip4,...]} here")
    ap.add_argument("--quiet", action="store_true", help="print errors only")
    args = ap.parse_args(argv)

    codes = load_subject_codes(args.subjects)
    mappings = load_crosswalk(args.crosswalk)
    errors, by_subject = validate(mappings, codes)
    if not args.quiet:
        print(report(mappings, codes, by_subject))
        print()
    if errors:
        print(f"{len(errors)} problem(s):", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
    else:
        print("crosswalk OK")
    if args.subjects_out:
        args.subjects_out.write_text(json.dumps({c: sorted(v) for c, v in sorted(by_subject.items())}, indent=1) + "\n")
        print(f"wrote {args.subjects_out}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
