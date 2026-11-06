"""
Load CRICOS courses into the Australian pack's per-subject files.

Input (download by hand; see data/au/README.md)
  data.gov.au -> dataset "CRICOS" -> latest "CRICOS Providers, Courses and
  Locations" spreadsheet (.xlsx). Save it in data/raw/au/ (git-ignored).

Usage (from the repo root)
    python3 -I scripts/au/load_cricos.py --xlsx "data/raw/au/CRICOS Providers, Courses and Locations.xlsx"
    options: --pack web/public/packs/au   --max-per-subject 200
             --include-associate (also keep Associate Degrees)   --dry-run
Needs openpyxl (pip install openpyxl); falls back to pandas if that can read .xlsx.

What it does
  1. Reads every sheet, finds the header row (the release may have title rows
     above it) and maps columns by fuzzy, case-insensitive name (see COLUMNS).
     Sheets are recognised by name ("Institutions", "Courses", "Locations",
     "Course Locations") or, failing that, by the columns they hold.
  2. Keeps courses whose level is a Bachelor Degree or Bachelor Honours Degree
     (plus Associate Degree with --include-associate) and that are not expired.
  3. Resolves Field of Education 1 (detailed -> narrow -> broad; cells may hold
     codes, names or "code - name") and Field of Education 2 (double degrees)
     to subject codes via scripts/au/asced_crosswalk.json, then applies the
     crosswalk's course-name title rules.
  4. Location: first Course Location row for the course (joined to Locations
     by location name when the course-location sheet has no city), else the
     provider's address. setting = "city" for state capitals and the large
     cities (Sydney, Melbourne, Brisbane, Perth, Adelaide, Hobart, Darwin,
     Canberra, Gold Coast, Newcastle, Wollongong, Geelong) or a postcode in
     their metro range (suburb campuses such as Clayton or Callaghan), else
     "regional". town = "City, STATE".
  5. One course per (provider, course name); at most --max-per-subject per
     subject, universities first, then alphabetical by provider and title.
  6. Writes web/public/packs/au/subjects/<code>.json:
        {code, attribution, courses:[...], jobs:[kept / copied from UK file],
         apprenticeships:[kept from the existing file]}
     course shape: {title, provider, url (provider website, https), ucas_code: null,
                    setting: "city"|"regional", town: "City, STATE", earnings: null, state}
     and updates course_count in web/public/packs/au/data/subjects.json.

Attribution: "Contains CRICOS data from the Australian Government Department
of Education, via data.gov.au." (check the licence on the data.gov.au page).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PACK = ROOT / "web" / "public" / "packs" / "au"
UK_SUBJECTS_DIR = ROOT / "web" / "public" / "subjects"
CROSSWALK = HERE / "asced_crosswalk.json"

ATTRIBUTION = "Contains CRICOS data from the Australian Government Department of Education, via data.gov.au."


def _load_crosswalk_module():
    # python3 -I does not put this directory on sys.path, so import by path
    spec = importlib.util.spec_from_file_location("au_build_crosswalk", HERE / "build_crosswalk.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


# ---------------------------------------------------------------------------
# Column detection. Headers are normalised (lower case, non-alphanumerics ->
# space). For each logical column the patterns are tried in order; the first
# header matching a pattern (and none of its excludes) wins.
# ---------------------------------------------------------------------------
_FOE = r"(field of education|foe|field of ed\w*)"
COLUMNS: dict[str, list[tuple[str, tuple[str, ...]]]] = {
    "provider_code": [(r"^cricos provider code$", ()), (r"provider (code|id|number)", ()), (r"^provider$", ())],
    "course_code": [(r"^cricos course code$", ()), (r"course (code|id)", ("vet", "national"))],
    "provider_name": [(r"^(institution|provider) name$", ()), (r"(institution|provider) (legal )?name", ()),
                      (r"^trading name$", ()), (r"^institution$", ())],
    "trading_name": [(r"trading name", ())],
    "provider_type": [(r"(institution|provider) type", ()), (r"^type$", ())],
    "website": [(r"website", ()), (r"web site", ()), (r"web address", ()), (r"^url$", ()), (r"\burl\b", ())],
    "course_name": [(r"^course name$", ()), (r"course (name|title)", ())],
    "course_level": [(r"^course level$", ()), (r"(course|qualification|aqf) level", ()), (r"^level$", ())],
    "foe1_detailed": [(_FOE + r" 1 detailed", ()), (_FOE + r" detailed", (r" 2 ",))],
    "foe1_narrow": [(_FOE + r" 1 narrow", ()), (_FOE + r" narrow", (r" 2 ",))],
    "foe1_broad": [(_FOE + r" 1 broad", ()), (_FOE + r" broad", (r" 2 ",))],
    "foe2_detailed": [(_FOE + r" 2 detailed", ())],
    "foe2_narrow": [(_FOE + r" 2 narrow", ())],
    "foe2_broad": [(_FOE + r" 2 broad", ())],
    "duration": [(r"duration.*week", ()), (r"duration", ())],
    "tuition": [(r"^tuition fee", ()), (r"tuition", ("non tuition", "non-tuition"))],
    "expired": [(r"^expired$", ()), (r"expired", ())],
    "location_name": [(r"^location name$", ()), (r"location name", ()), (r"campus name", ())],
    "city": [(r"^(location )?city$", ()), (r"^(location )?(suburb|town)$", ()), (r"(location|address) (city|suburb|town)", ()),
             (r"\b(city|suburb|town)\b", ())],
    "state": [(r"^(location )?state$", ()), (r"(location|address) state", ()), (r"\bstate\b", ())],
    "postcode": [(r"^(location )?post ?code$", ()), (r"post ?code", ())],
}


def norm_header(h) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(h or "").lower())).strip()


def _pad(s: str) -> str:
    return f" {s} "


def detect_columns(headers: list) -> dict[str, int]:
    normed = [norm_header(h) for h in headers]
    found: dict[str, int] = {}
    used: set[int] = set()
    for key, patterns in COLUMNS.items():
        for pat, excludes in patterns:
            rx = re.compile(pat)
            hit = next((i for i, h in enumerate(normed)
                        if h and i not in used and rx.search(h) and not any(e in _pad(h) for e in excludes)), None)
            if hit is not None:
                found[key] = hit
                if key not in ("provider_name", "trading_name"):
                    used.add(hit)
                break
    # trading name only as a fallback for provider name
    if "provider_name" in found and found.get("trading_name") == found["provider_name"]:
        found.pop("trading_name")
    return found


def _header_score(row: tuple) -> int:
    return len(detect_columns(list(row))) if row and sum(1 for c in row if isinstance(c, str) and c.strip()) >= 2 else 0


# ---------------------------------------------------------------------------
# Spreadsheet reading
# ---------------------------------------------------------------------------
def read_workbook(path: Path) -> dict[str, list[tuple]]:
    """{sheet name: [row tuples]} via openpyxl, else pandas."""
    try:
        import openpyxl  # type: ignore
    except ImportError:
        openpyxl = None
    if openpyxl is not None:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        out = {ws.title: [tuple(r) for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets}
        wb.close()
        return out
    try:
        import pandas as pd  # type: ignore
    except ImportError:
        raise SystemExit("Reading .xlsx needs openpyxl (or pandas with an Excel engine).\n"
                         "Install it with:  pip install openpyxl")
    try:
        frames = pd.read_excel(path, sheet_name=None, header=None, dtype=object)
    except ImportError as e:
        raise SystemExit(f"pandas cannot read .xlsx here ({e}).\nInstall openpyxl with:  pip install openpyxl")
    out = {}
    for name, df in frames.items():
        rows = []
        for r in df.itertuples(index=False, name=None):
            rows.append(tuple(None if (isinstance(v, float) and v != v) else v for v in r))
        out[name] = rows
    return out


class Sheet:
    def __init__(self, name: str, rows: list[tuple]):
        self.name = name
        best, best_i = 0, 0
        for i, r in enumerate(rows[:25]):
            s = _header_score(r)
            if s > best:
                best, best_i = s, i
        self.header_row = best_i
        self.headers = list(rows[best_i]) if rows else []
        self.cols = detect_columns(self.headers) if rows else {}
        self.rows = [r for r in rows[best_i + 1:] if r and any(c is not None and str(c).strip() for c in r)]

    def get(self, row: tuple, key: str):
        i = self.cols.get(key)
        if i is None or i >= len(row):
            return None
        v = row[i]
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    def describe(self) -> str:
        return ", ".join(f"{k}={self.headers[i]!r}" for k, i in sorted(self.cols.items(), key=lambda kv: kv[1]))


def classify(sheets: list[Sheet]) -> dict[str, Sheet]:
    roles: dict[str, Sheet] = {}
    for s in sheets:
        n = norm_header(s.name)
        if "course" in n and "location" in n:
            roles.setdefault("course_locations", s)
        elif "course" in n:
            roles.setdefault("courses", s)
        elif "location" in n:
            roles.setdefault("locations", s)
        elif "institution" in n or "provider" in n:
            roles.setdefault("institutions", s)
    taken = {id(s) for s in roles.values()}
    for s in sheets:  # fall back to the columns a sheet holds
        if id(s) in taken:
            continue
        c = s.cols
        if "course_name" in c and "courses" not in roles:
            roles["courses"] = s
        elif "course_code" in c and ("city" in c or "location_name" in c) and "course_locations" not in roles:
            roles["course_locations"] = s
        elif "location_name" in c and "city" in c and "locations" not in roles:
            roles["locations"] = s
        elif "provider_code" in c and ("website" in c or "provider_type" in c) and "institutions" not in roles:
            roles["institutions"] = s
        else:
            continue
        taken.add(id(s))
    return roles


# ---------------------------------------------------------------------------
# Values
# ---------------------------------------------------------------------------
STATES = {"nsw": "NSW", "new south wales": "NSW", "vic": "VIC", "victoria": "VIC", "qld": "QLD", "queensland": "QLD",
          "wa": "WA", "western australia": "WA", "sa": "SA", "south australia": "SA", "tas": "TAS", "tasmania": "TAS",
          "act": "ACT", "australian capital territory": "ACT", "nt": "NT", "northern territory": "NT"}
MAJOR_CITIES = {"sydney", "melbourne", "brisbane", "perth", "adelaide", "hobart", "darwin", "canberra",
                "gold coast", "newcastle", "wollongong", "geelong"}
# Approximate metro postcode ranges for the cities above (Australia Post
# postcodes are not ABS boundaries; good enough to tag suburb campuses).
METRO_POSTCODES = [
    (2000, 2234), (2555, 2574), (2740, 2786),  # Greater Sydney
    (2265, 2310),                              # Newcastle / Lake Macquarie
    (2500, 2530),                              # Wollongong
    (2600, 2620), (2900, 2914),                # Canberra
    (3000, 3207), (3750, 3810), (3910, 3944), (3975, 3978),  # Greater Melbourne
    (3211, 3228),                              # Geelong
    (4000, 4207), (4300, 4305), (4500, 4519),  # Greater Brisbane
    (4208, 4230),                              # Gold Coast
    (5000, 5199),                              # Adelaide
    (6000, 6199),                              # Perth
    (7000, 7055),                              # Hobart
    (800, 832),                                # Darwin
]
POSTCODE_STATE = [(800, 999, "NT"), (2600, 2618, "ACT"), (2900, 2920, "ACT"), (1000, 2999, "NSW"),
                  (3000, 3999, "VIC"), (4000, 4999, "QLD"), (5000, 5999, "SA"), (6000, 6999, "WA"), (7000, 7999, "TAS")]
BACHELOR_RE = re.compile(r"\bbachelor", re.I)
ASSOCIATE_RE = re.compile(r"\bassociate degree\b", re.I)


def norm_state(v, postcode: int | None = None) -> str | None:
    if v is not None and str(v).strip():
        s = str(v).strip()
        return STATES.get(s.lower(), s.upper() if len(s) <= 3 else s)
    if postcode is not None:
        for lo, hi, st in POSTCODE_STATE:
            if lo <= postcode <= hi:
                return st
    return None


def to_postcode(v) -> int | None:
    if v is None:
        return None
    m = re.search(r"\d{3,4}", str(v))
    return int(m.group()) if m else None


def tidy_city(v) -> str | None:
    if v is None or not str(v).strip():
        return None
    s = re.sub(r"\s+", " ", str(v).strip())
    return s.title() if s.isupper() or s.islower() else s


def setting_for(city: str | None, postcode: int | None) -> str | None:
    if city is None and postcode is None:
        return None
    if city and city.lower() in MAJOR_CITIES:
        return "city"
    if postcode is not None and any(lo <= postcode <= hi for lo, hi in METRO_POSTCODES):
        return "city"
    return "regional"


def normalise_url(url) -> str | None:
    if url is None:
        return None
    url = str(url).strip().strip("/")
    if not url or " " in url or "." not in url:
        return None
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    else:
        url = re.sub(r"^http://", "https://", url, flags=re.I)
    return url


def truthy(v) -> bool:
    if v is None:
        return False
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in {"y", "yes", "true", "1", "expired"}


def key_of(v) -> str:
    """Join key: provider / course codes may be '00116K', 116, '116.0'."""
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip().upper().lstrip("0")


def level_ok(level, include_associate: bool) -> bool:
    if level is None:
        return False
    s = str(level)
    if BACHELOR_RE.search(s) and not re.search(r"\bgraduate\b", s, re.I):
        return True
    return include_associate and bool(ASSOCIATE_RE.search(s))


# ---------------------------------------------------------------------------
# Main collection
# ---------------------------------------------------------------------------
def collect(roles: dict[str, Sheet], cw, include_associate: bool) -> tuple[dict[str, list[tuple[bool, dict]]], dict]:
    courses = roles.get("courses")
    if courses is None:
        raise SystemExit("could not find a Courses sheet (no sheet named like 'Courses' and none with a 'Course Name' column)")
    missing = [k for k in ("course_name", "course_level") if k not in courses.cols]
    if not any(k in courses.cols for k in ("foe1_detailed", "foe1_narrow", "foe1_broad")):
        missing.append("field of education 1 (detailed / narrow / broad)")
    if missing:
        raise SystemExit(f"Courses sheet {courses.name!r}: missing columns {missing}; headers found: {courses.headers}")

    # institutions: provider code -> info
    inst: dict[str, dict] = {}
    s = roles.get("institutions")
    if s is not None:
        for r in s.rows:
            k = key_of(s.get(r, "provider_code"))
            if not k:
                continue
            pc = to_postcode(s.get(r, "postcode"))
            inst[k] = {"name": s.get(r, "provider_name") or s.get(r, "trading_name"), "type": s.get(r, "provider_type"),
                       "url": normalise_url(s.get(r, "website")), "city": tidy_city(s.get(r, "city")),
                       "state": norm_state(s.get(r, "state"), pc), "postcode": pc}

    # locations: (provider, location name) -> place
    places: dict[tuple[str, str], dict] = {}
    s = roles.get("locations")
    if s is not None:
        for r in s.rows:
            pc = to_postcode(s.get(r, "postcode"))
            places[(key_of(s.get(r, "provider_code")), str(s.get(r, "location_name") or "").strip().lower())] = {
                "city": tidy_city(s.get(r, "city")), "state": norm_state(s.get(r, "state"), pc), "postcode": pc}

    # course locations: (provider, course code) -> first place
    course_place: dict[tuple[str, str], dict] = {}
    s = roles.get("course_locations")
    if s is not None:
        for r in s.rows:
            key = (key_of(s.get(r, "provider_code")), key_of(s.get(r, "course_code")))
            if key in course_place:
                continue
            pc = to_postcode(s.get(r, "postcode"))
            place = {"city": tidy_city(s.get(r, "city")), "state": norm_state(s.get(r, "state"), pc), "postcode": pc}
            known = places.get((key[0], str(s.get(r, "location_name") or "").strip().lower()))
            if known:
                # The course-locations sheet has no postcode; the campus list does, and the
                # postcode is what tells a metro suburb (Burwood, Clayton) from a regional town.
                place = {"city": place["city"] or known.get("city"), "state": place["state"] or known.get("state"),
                         "postcode": place["postcode"] or known.get("postcode")}
            course_place[key] = place

    stats = {"rows": 0, "level_kept": 0, "expired": 0, "mapped": 0, "unmapped": Counter(), "dupes": 0, "levels": Counter(),
             "no_place": 0, "no_url": 0}
    per_subject: dict[str, list[tuple[bool, dict]]] = defaultdict(list)
    umbrella: dict[str, list[tuple[bool, dict]]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for r in courses.rows:
        stats["rows"] += 1
        level = courses.get(r, "course_level")
        stats["levels"][str(level)] += 1
        if not level_ok(level, include_associate):
            continue
        if truthy(courses.get(r, "expired")):
            stats["expired"] += 1
            continue
        stats["level_kept"] += 1
        title = re.sub(r"\s+", " ", str(courses.get(r, "course_name") or "")).strip()
        pkey = key_of(courses.get(r, "provider_code"))
        info = inst.get(pkey, {})
        provider = info.get("name") or courses.get(r, "provider_name") or courses.get(r, "trading_name")
        if not title or not provider:
            continue
        provider = re.sub(r"\s+", " ", str(provider)).strip()
        dkey = (provider.lower(), title.lower())
        if dkey in seen:
            stats["dupes"] += 1
            continue

        subjects: list[str] = []
        unmapped: list[str] = []
        for grp in (("foe1_detailed", "foe1_narrow", "foe1_broad"), ("foe2_detailed", "foe2_narrow", "foe2_broad")):
            vals = [courses.get(r, k) for k in grp]
            if not any(v is not None for v in vals):
                continue
            subs, bad = cw.resolve(vals, title)
            subjects += [x for x in subs if x not in subjects]
            unmapped += bad
        for label in unmapped:
            stats["unmapped"][label] += 1
        umb = next((k for k, pat in UMBRELLA.items() if pat.match(title)), None)
        if not subjects and not umb:
            continue
        seen.add(dkey)
        stats["mapped"] += 1

        place = course_place.get((pkey, key_of(courses.get(r, "course_code"))))
        if place is None:
            pc = to_postcode(courses.get(r, "postcode"))
            place = {"city": tidy_city(courses.get(r, "city")), "state": norm_state(courses.get(r, "state"), pc), "postcode": pc}
            if not place["city"] and info:
                place = {"city": info.get("city"), "state": info.get("state"), "postcode": info.get("postcode")}
        if not place.get("city"):
            stats["no_place"] += 1
        state = place.get("state")
        url = info.get("url") or normalise_url(courses.get(r, "website"))
        if not url:
            stats["no_url"] += 1
        is_uni = bool(re.search(r"univ", str(info.get("type") or ""), re.I) or re.search(r"\buniversity\b", provider, re.I))
        course = {
            "title": title,
            "provider": provider,
            "url": url,
            "ucas_code": None,
            "setting": setting_for(place.get("city"), place.get("postcode")),
            "town": ", ".join(p for p in (place.get("city"), state) if p) or None,
            "earnings": None,
            "state": state,
        }
        for code in subjects:
            per_subject[code].append((is_uni, course))
        if umb:
            umbrella[umb].append((is_uni, course))
    stats["umbrella"] = umbrella
    return per_subject, stats


# Subjects that Australian unis teach as a major inside a broader degree rather than as a
# degree of their own. When CRICOS has no courses for one, show the umbrella degree with a note.
UMBRELLA = {
    "arts": re.compile(r"^bachelor of arts( \(honours\))?$", re.I),
    "science": re.compile(r"^bachelor of (advanced )?science( \(honours\))?$", re.I),
    "nursing": re.compile(r"^bachelor of nursing( \(honours\))?$", re.I),
}
_BA = "In Australia this is usually studied as a major within a Bachelor of Arts, so these are Bachelor of Arts courses."
_BSC = "In Australia this is usually studied as a major within a Bachelor of Science, so these are Bachelor of Science courses."
FALLBACK = {
    "CAH19-01-01": ("arts", _BA), "CAH19-01-02": ("arts", _BA), "CAH19-01-03": ("arts", _BA),
    "CAH19-04-01": ("arts", _BA), "CAH19-04-02": ("arts", _BA), "CAH19-04-03": ("arts", _BA), "CAH19-04-05": ("arts", _BA),
    "CAH19-02-01": ("arts", "Celtic languages aren't offered as a degree in Australia. A Bachelor of Arts with a languages or linguistics major is the closest."),
    "CAH19-02-02": ("arts", "Gaelic isn't offered as a degree in Australia. A Bachelor of Arts with a languages or linguistics major is the closest."),
    "CAH19-02-03": ("arts", "Welsh isn't offered as a degree in Australia. A Bachelor of Arts with a languages or linguistics major is the closest."),
    "CAH19-02-04": ("arts", "Celtic languages aren't offered as a degree in Australia. A Bachelor of Arts with a languages or linguistics major is the closest."),
    "CAH15-01-06": ("arts", _BA), "CAH23-01-02": ("arts", _BA),
    "CAH07-01-02": ("science", _BSC), "CAH06-01-05": ("science", _BSC),
    "CAH02-04-05": ("nursing", "Australian nursing degrees cover patients of all ages; children's nursing is a specialisation after you qualify. These are Bachelor of Nursing courses."),
    "CAH02-04-07": ("nursing", "Australian nursing degrees cover mental health; you can specialise after you qualify. These are Bachelor of Nursing courses."),
}


def write_subject_files(per_subject, codes: list[str], pack: Path, max_per_subject: int, dry_run: bool, umbrella=None) -> dict[str, int]:
    subj_dir = pack / "subjects"
    if not dry_run:
        subj_dir.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for code in codes:
        ranked = sorted(per_subject.get(code, []), key=lambda t: (not t[0], t[1]["provider"].lower(), t[1]["title"].lower()))
        note = None
        if not ranked and umbrella and code in FALLBACK:
            kind, note = FALLBACK[code]
            ranked = sorted(umbrella.get(kind, []), key=lambda t: (not t[0], t[1]["provider"].lower(), t[1]["title"].lower()))
            if not ranked:
                note = None
        courses = [c for _, c in ranked[:max_per_subject]]
        target = subj_dir / f"{code}.json"
        existing = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
        jobs = existing.get("jobs")
        uk_file = UK_SUBJECTS_DIR / f"{code}.json"
        if not jobs and uk_file.exists():
            jobs = json.loads(uk_file.read_text(encoding="utf-8")).get("jobs", [])
        payload = {"code": code, "attribution": ATTRIBUTION, "courses": courses, "jobs": jobs or [],
                   "apprenticeships": existing.get("apprenticeships", [])}
        if note:
            payload["note"] = note
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
    ap.add_argument("--xlsx", required=True, type=Path, help="CRICOS Providers, Courses and Locations .xlsx")
    ap.add_argument("--pack", type=Path, default=PACK, help="pack directory (default web/public/packs/au)")
    ap.add_argument("--max-per-subject", type=int, default=200)
    ap.add_argument("--include-associate", action="store_true", help="also keep Associate Degrees")
    ap.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = ap.parse_args(argv)

    if not args.xlsx.exists():
        raise SystemExit(f"missing input: {args.xlsx}\nSee data/au/README.md for where to download the CRICOS spreadsheet.")
    subjects_path = args.pack / "data" / "subjects.json"
    if not subjects_path.exists():
        raise SystemExit(f"{subjects_path} not found; run python3 -I scripts/au/build_pack.py first")
    codes = [s["code"] for s in json.loads(subjects_path.read_text(encoding="utf-8"))["subjects"]]

    mod = _load_crosswalk_module()
    cw = mod.Crosswalk(mod.load_raw(CROSSWALK))

    print(f"reading {args.xlsx} ...")
    book = read_workbook(args.xlsx)
    sheets = [Sheet(name, rows) for name, rows in book.items()]
    roles = classify(sheets)
    for role in ("institutions", "courses", "locations", "course_locations"):
        s = roles.get(role)
        if s is None:
            print(f"  {role:<16} (not found)")
        else:
            print(f"  {role:<16} sheet {s.name!r}: {len(s.rows)} rows, header row {s.header_row + 1}")
            print(f"  {'':<16} columns: {s.describe()}")

    per_subject, stats = collect(roles, cw, args.include_associate)
    print(f"  course rows {stats['rows']}, kept by level {stats['level_kept']} (expired skipped {stats['expired']}), "
          f"mapped {stats['mapped']}, duplicate (provider, name) {stats['dupes']}")
    print(f"  missing location {stats['no_place']}, missing website {stats['no_url']}")
    lv = ", ".join(f"{k} x{v}" for k, v in stats["levels"].most_common(12))
    print(f"  course levels seen: {lv}")
    if stats["unmapped"]:
        print("  unmapped fields of education (add to asced_crosswalk.json?):")
        for label, n in stats["unmapped"].most_common(40):
            print(f"    {n:>5}  {label}")

    counts = write_subject_files(per_subject, codes, args.pack, args.max_per_subject, args.dry_run, stats.get("umbrella"))
    update_course_counts(args.pack, counts, args.dry_run)
    empty = [c for c in codes if counts.get(c, 0) == 0]
    print(f"{'would write' if args.dry_run else 'wrote'} {len(codes)} subject files; "
          f"{sum(counts.values())} course entries total; {len(empty)} subjects with no courses")
    if empty:
        shown = ", ".join(empty[:25]) + (f" ... (+{len(empty) - 25} more)" if len(empty) > 25 else "")
        print("  empty: " + shown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
