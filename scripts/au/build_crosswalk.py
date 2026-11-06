"""
Validate the hand-authored ASCED -> CAH3 crosswalk and print a coverage report.

The crosswalk (scripts/au/asced_crosswalk.json) is the heart of the Australian
data pack: it decides which CRICOS courses (keyed by their ASCED Field of
Education) feed which of Inkling's 163 UK subject codes. Scoring stays on the
UK codes; only the course lists change country.

Field codes come at three levels and all three are mapped, because CRICOS rows
sometimes carry only a narrow or broad field:
    broad    "01"       12 fields
    narrow   "0101"     ~70 fields
    detailed "010101"   ~350 fields
The loader resolves detailed -> narrow -> broad. "title_rules" then refine a
course by its name within listed field prefixes (individual languages, Celtic,
developmental psychology... which ASCED does not separate).

Checks
  * every mapping has a well-formed "asced" code (2, 4 or 6 digits), a title and 1-2 subjects
  * no code appears twice; every detailed field's narrow and every narrow's broad is present
  * every subject code exists in web/public/data/subjects.json
  * every one of the 163 subjects is reached by a field or a title rule
  * "confidence", when present, is "low"; title-rule patterns compile

Run from the repo root (no third-party packages needed):
    python3 -I scripts/au/build_crosswalk.py            # validate + report
    python3 -I scripts/au/build_crosswalk.py --quiet    # errors only, exit code
    python3 -I scripts/au/build_crosswalk.py --subjects-out path.json
        also writes {code: [asced, ...]} for other tools

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
CROSSWALK = Path(__file__).resolve().parent / "asced_crosswalk.json"
SUBJECTS = ROOT / "web" / "public" / "data" / "subjects.json"

ASCED_RE = re.compile(r"^(\d{2}|\d{4}|\d{6})$")
CODE_RE = re.compile(r"^CAH\d{2}-\d{2}-\d{2}$")
LEVEL = {2: "broad", 4: "narrow", 6: "detailed"}


def load_subject_codes(path: Path = SUBJECTS) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data["subjects"] if isinstance(data, dict) else data
    return {s["code"]: s.get("display_name", s.get("name", "")) for s in items}


def load_raw(path: Path = CROSSWALK) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def normalise_field(raw) -> str | None:
    """Turn whatever a spreadsheet holds into an ASCED code string, or None.

    Accepts '010101', '10101' (leading zero lost to Excel), 10101.0, '0101',
    '101', '01', '1', '010100' / '010000' (narrow / broad padded to six),
    '010101 - Mathematics', 'Mathematics (010101)'. Pure names return None;
    resolve those with Crosswalk.code_for_name().
    """
    if raw is None:
        return None
    if isinstance(raw, float) and raw.is_integer():
        raw = int(raw)
    s = str(raw).strip()
    if not s:
        return None
    m = re.match(r"^\s*(\d{1,6})(?:\.0+)?\b", s) or re.search(r"\((\d{1,6})\)\s*$", s)
    if not m:
        return None
    d = m.group(1)
    if len(d) in (5, 3, 1):
        d = "0" + d
    if len(d) == 6 and d.endswith("0000"):
        d = d[:2]
    elif len(d) == 6 and d.endswith("00"):
        d = d[:4]
    return d if ASCED_RE.match(d) else None


def _name_key(name: str) -> str:
    s = name.lower().replace("&", " and ")
    s = re.sub(r"\bn\.?\s*e\.?\s*c\.?", "nec", s)
    s = re.sub(r"\(.*?\)", " ", s)
    s = re.sub(r"^\s*\d+\s*[-:]?\s*", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


class Crosswalk:
    """Resolve a CRICOS course (field codes/names + title) to subject codes."""

    def __init__(self, raw: dict):
        self.by_code: dict[str, list[str]] = {m["asced"]: list(m["subjects"]) for m in raw["mappings"]}
        self.titles: dict[str, str] = {m["asced"]: m["title"] for m in raw["mappings"]}
        # names can repeat across levels ("Pharmacy" is narrow 0605 and detailed 060501): prefer the most specific
        self.by_name: dict[str, str] = {}
        for m in sorted(raw["mappings"], key=lambda m: len(m["asced"])):
            self.by_name[_name_key(m["title"])] = m["asced"]
        self.rules = [(re.compile(r["pattern"], re.I), tuple(r.get("fields") or ()), list(r["subjects"]))
                      for r in raw.get("title_rules", [])]

    def code_for(self, raw) -> str | None:
        code = normalise_field(raw)
        if code:
            return code
        if raw is None or not str(raw).strip():
            return None
        return self.by_name.get(_name_key(str(raw)))

    def subjects_for_code(self, code: str | None) -> tuple[str | None, list[str]]:
        """Most specific mapped code (detailed -> narrow -> broad) and its subjects."""
        while code:
            if code in self.by_code:
                return code, self.by_code[code]
            code = code[:-2] if len(code) > 2 else None
        return None, []

    def resolve(self, field_values: list, title: str = "") -> tuple[list[str], list[str]]:
        """Return (subjects, unmapped_field_labels). field_values: raw cells,
        most specific first per field group, e.g. [detailed1, narrow1, broad1]."""
        code = None
        for v in field_values:
            code = self.code_for(v)
            if code:
                break
        if not code:
            labels = [str(v).strip() for v in field_values if v is not None and str(v).strip()]
            return [], labels[:1]
        hit, subjects = self.subjects_for_code(code)
        if not hit:
            return [], [code]
        matched: list[str] = []
        for pat, fields, subs in self.rules:
            if fields and not any(code.startswith(f) for f in fields):
                continue
            if pat.search(title or ""):
                matched += [s for s in subs if s not in matched]
        return (matched or list(subjects)), []


def validate(raw: dict, codes: dict[str, str]) -> tuple[list[str], dict[str, list[str]], dict[str, list[str]]]:
    """Return (errors, {subject: [asced, ...]}, {subject: [rule pattern, ...]})."""
    mappings = raw.get("mappings", [])
    errors: list[str] = []
    seen = Counter()
    by_subject: dict[str, list[str]] = defaultdict(list)
    by_rule: dict[str, list[str]] = defaultdict(list)

    def check_subjects(where: str, subjects) -> list[str]:
        if not isinstance(subjects, list) or not 1 <= len(subjects) <= 2:
            errors.append(f"{where}: subjects must be a list of 1-2 codes")
            return []
        if len(set(subjects)) != len(subjects):
            errors.append(f"{where}: duplicate subject in list")
        ok = []
        for code in subjects:
            if not isinstance(code, str) or not CODE_RE.match(code):
                errors.append(f"{where}: malformed subject code {code!r}")
            elif code not in codes:
                errors.append(f"{where}: unknown subject code {code}")
            else:
                ok.append(code)
        return ok

    for i, m in enumerate(mappings):
        where = f"mapping #{i} ({m.get('asced', '?')})"
        a = m.get("asced")
        if not isinstance(a, str) or not ASCED_RE.match(a):
            errors.append(f"{where}: asced must be a 2, 4 or 6 digit string")
            continue
        seen[a] += 1
        if not isinstance(m.get("title"), str) or not m["title"].strip():
            errors.append(f"{where}: missing title")
        for code in check_subjects(where, m.get("subjects")):
            by_subject[code].append(a)
        conf = m.get("confidence")
        if conf is not None and conf != "low":
            errors.append(f"{where}: confidence must be 'low' or absent, got {conf!r}")
        extra = set(m) - {"asced", "title", "subjects", "confidence", "note"}
        if extra:
            errors.append(f"{where}: unexpected keys {sorted(extra)}")
    for a, n in seen.items():
        if n > 1:
            errors.append(f"asced {a} appears {n} times")
        if len(a) > 2 and a[:-2] not in seen:
            errors.append(f"asced {a}: parent field {a[:-2]} is not mapped")

    for i, r in enumerate(raw.get("title_rules", [])):
        where = f"title_rule #{i} ({r.get('pattern', '?')})"
        try:
            re.compile(r.get("pattern", ""), re.I)
        except re.error as e:
            errors.append(f"{where}: bad regex: {e}")
        for f in r.get("fields") or []:
            if not isinstance(f, str) or f not in seen:
                errors.append(f"{where}: field prefix {f!r} is not a mapped ASCED code")
        for code in check_subjects(where, r.get("subjects")):
            by_rule[code].append(r["pattern"])
        extra = set(r) - {"pattern", "fields", "subjects", "note"}
        if extra:
            errors.append(f"{where}: unexpected keys {sorted(extra)}")

    for code in codes:
        if code not in by_subject and code not in by_rule:
            errors.append(f"subject {code} ({codes[code]}) is reached by no ASCED field or title rule")
    return errors, by_subject, by_rule


def report(raw: dict, codes: dict[str, str], by_subject: dict[str, list[str]], by_rule: dict[str, list[str]]) -> str:
    mappings = raw.get("mappings", [])
    levels = Counter(LEVEL.get(len(m.get("asced", "")), "?") for m in mappings)
    detailed = [m for m in mappings if len(m.get("asced", "")) == 6]
    counts = Counter(len(by_subject.get(c, [])) for c in codes)
    low = [m for m in mappings if m.get("confidence") == "low"]
    two = sum(1 for m in mappings if len(m.get("subjects", [])) == 2)
    broad = Counter(m["asced"][:2] for m in detailed)
    lines = [
        f"ASCED fields mapped: {len(mappings)} (detailed {levels['detailed']}, narrow {levels['narrow']}, broad {levels['broad']}); "
        f"{two} map to two subjects, {len(mappings) - two} to one",
        f"Fields marked confidence=low: {len(low)}",
        f"Title rules: {len(raw.get('title_rules', []))}",
        f"Subjects: {len(codes)} total; reached by fields: {sum(1 for c in codes if by_subject.get(c))}, "
        f"by title rules only: {sum(1 for c in codes if not by_subject.get(c) and by_rule.get(c))}, "
        f"unreached: {sum(1 for c in codes if not by_subject.get(c) and not by_rule.get(c))}",
        f"Subjects by number of fields: 0: {counts[0]}, 1: {counts[1]}, 2+: {sum(v for k, v in counts.items() if k >= 2)}",
        "Detailed fields per broad field: " + ", ".join(f"{k}({v})" for k, v in sorted(broad.items())),
        "",
        "Subjects with a single field (thinnest coverage):",
    ]
    for code in sorted(codes):
        f = by_subject.get(code, [])
        if len(f) == 1:
            lines.append(f"  {code}  {codes[code]:<55} <- {f[0]}")
    lines.append("")
    lines.append("Subjects reached only by title rules (need course names to match):")
    for code in sorted(codes):
        if not by_subject.get(code) and by_rule.get(code):
            lines.append(f"  {code}  {codes[code]:<55} <- /{by_rule[code][0]}/")
    lines.append("")
    lines.append("Subjects fed only by low-confidence fields:")
    low_codes = {m["asced"] for m in low}
    for code in sorted(codes):
        f = by_subject.get(code, [])
        if f and all(a in low_codes for a in f):
            lines.append(f"  {code}  {codes[code]:<55} <- {', '.join(f)}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--crosswalk", type=Path, default=CROSSWALK)
    ap.add_argument("--subjects", type=Path, default=SUBJECTS)
    ap.add_argument("--subjects-out", type=Path, help="write {code: [asced,...]} here")
    ap.add_argument("--quiet", action="store_true", help="print errors only")
    args = ap.parse_args(argv)

    codes = load_subject_codes(args.subjects)
    raw = load_raw(args.crosswalk)
    errors, by_subject, by_rule = validate(raw, codes)
    if not args.quiet:
        print(report(raw, codes, by_subject, by_rule))
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
