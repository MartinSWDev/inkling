"""
Build the US data pack from the live UK files + the CIP crosswalk.

Writes
  web/public/packs/us/data/content.json   UK content with US high-school chips,
                                           US extra_names and extended aliases
  web/public/packs/us/data/subjects.json  same 163 subjects (code, object, slot,
                                           neighbours, keywords, profile unchanged),
                                           wording in US English, plus "cips"
  web/public/packs/us/subjects/<code>.json one file per subject so the app never
                                           404s; courses empty until
                                           load_scorecard.py runs; jobs copied
                                           from the UK file; apprenticeships []

Existing per-subject files that already hold Scorecard courses are kept (and
their course_count carried into subjects.json) unless --reset is passed.

Run from the repo root (standard library only):
    python3 -I scripts/us/build_pack.py
    python3 -I scripts/us/build_pack.py --reset     # also wipe loaded courses
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UK_DATA = ROOT / "web" / "public" / "data"
UK_SUBJECTS_DIR = ROOT / "web" / "public" / "subjects"
PACK = ROOT / "web" / "public" / "packs" / "us"
CROSSWALK = Path(__file__).resolve().parent / "cip_crosswalk.json"

ATTRIBUTION = "Contains College Scorecard data from the U.S. Department of Education (public domain)."

# ---------------------------------------------------------------------------
# Chips: US high-school classes. Scoring matches each term as a substring of
# "display_name + name + keywords" of every subject (see web/src/scoring.ts
# expandTerms), so terms are chosen to land on the same subjects the UK chip
# of the same meaning lands on. Keywords are unchanged from the UK pack.
# ---------------------------------------------------------------------------
CHIPS = [
    {"id": "english", "name": "English", "terms": ["english", "books", "writing", "novels"]},
    {"id": "algebra", "name": "Algebra / Pre-Calc", "terms": ["maths", "mathematics", "statistics", "numbers"]},
    {"id": "biology", "name": "Biology", "terms": ["biology", "animals", "plants", "cells"]},
    {"id": "chemistry", "name": "Chemistry", "terms": ["chemistry", "reactions", "molecules"]},
    {"id": "physics", "name": "Physics", "terms": ["physics", "space", "quantum"]},
    {"id": "us_history", "name": "US History", "terms": ["history", "america", "past"]},
    {"id": "world_history", "name": "World History", "terms": ["history", "past", "ancient"]},
    {"id": "government", "name": "Government / Civics", "terms": ["politics", "government", "law", "elections"]},
    {"id": "economics", "name": "Economics", "terms": ["economics", "economy", "markets", "finance"]},
    {"id": "spanish", "name": "Spanish", "terms": ["spanish", "language", "translation"]},
    {"id": "french", "name": "French", "terms": ["french", "language", "translation"]},
    {"id": "computer_science", "name": "Computer Science", "terms": ["coding", "programming", "computers", "data"]},
    {"id": "art", "name": "Art", "terms": ["art", "design", "drawing", "painting"]},
    {"id": "music", "name": "Music", "terms": ["music", "performing", "musician"]},
    {"id": "theater", "name": "Theater", "terms": ["theater", "drama", "acting", "performing", "stage"]},
    {"id": "psychology", "name": "Psychology", "terms": ["psychology", "mind", "behaviour", "behavior"]},
    {"id": "statistics", "name": "Statistics", "terms": ["statistics", "probability", "analytics"]},
    {"id": "environmental_science", "name": "Environmental Science", "terms": ["environment", "ecology", "climate", "sustainability"]},
    {"id": "health_pe", "name": "Health / PE", "terms": ["sport", "fitness", "exercise", "nutrition", "wellbeing"]},
    {"id": "journalism", "name": "Journalism", "terms": ["journalism", "news", "media", "writing"]},
]

EXTRA_NAMES = [
    "Band", "Robotics", "Debate", "Yearbook", "Marketing", "Engineering", "Agriculture", "Culinary",
    "Anatomy", "Sociology", "Philosophy", "Latin", "Mandarin", "Japanese", "German", "Geology",
    "Astronomy", "Film", "Photography", "Dance", "Business", "Accounting", "Nutrition",
]

# ---------------------------------------------------------------------------
# Aliases: typed names -> {code: weight}. Keys are normalised like the client
# (lower-case, non-alphanumerics -> space). Each US chip / extra either reuses
# a UK alias row verbatim ("=uk:<key>") or gets explicit weights where the UK
# index has no equivalent. UK rows are kept too: they are mostly subject names
# and misspellings and remain useful for anything a US student types.
# ---------------------------------------------------------------------------
US_ALIASES: dict[str, str | dict[str, float]] = {
    # chips
    "english": {"CAH19-01-01": 1.0, "CAH19-01-03": 0.8, "CAH19-01-02": 0.6, "CAH19-01-05": 0.5},
    "algebra pre calc": "=uk:maths",
    "algebra": "=uk:maths",
    "pre calc": "=uk:maths",
    "precalculus": "=uk:maths",
    "calculus": "=uk:further maths",
    "ap calculus": "=uk:further maths",
    "geometry": "=uk:maths",
    "trigonometry": "=uk:maths",
    "math": "=uk:maths",
    "us history": "=uk:history",
    "american history": {"CAH20-01-01": 0.8, "CAH19-04-08": 0.6, "CAH15-03-01": 0.3},
    "apush": "=uk:history",
    "world history": "=uk:history",
    "government civics": "=uk:politics",
    "government": "=uk:politics",
    "civics": "=uk:politics",
    "ap government": "=uk:politics",
    "ap gov": "=uk:politics",
    "political science": "=uk:politics",
    "social studies": {"CAH15-01-01": 0.8, "CAH20-01-01": 0.6, "CAH15-03-01": 0.5, "CAH26-01-01": 0.4},
    "computer science": "=uk:computer science",
    "ap computer science": "=uk:computer science",
    "coding": "=uk:computer science",
    "programming": "=uk:computer science",
    "theater": "=uk:drama",
    "theatre": "=uk:drama",
    "health pe": "=uk:pe",
    "health": {"CAH02-06-01": 0.8, "CAH15-04-03": 0.6, "CAH02-06-04": 0.5, "CAH03-02-01": 0.4},
    "physical education": "=uk:pe",
    "gym": "=uk:pe",
    "ap environmental science": "=uk:environmental science",
    "apes": "=uk:environmental science",
    "ap psychology": "=uk:psychology",
    "ap statistics": "=uk:statistics",
    "ap biology": "=uk:biology",
    "ap chemistry": "=uk:chemistry",
    "ap physics": "=uk:physics",
    "ap economics": "=uk:economics",
    "ap spanish": "=uk:spanish",
    "ap french": "=uk:french",
    "ap art history": {"CAH20-01-02": 1.0, "CAH25-01-02": 0.5, "CAH20-01-01": 0.4},
    "ap english": {"CAH19-01-01": 1.0, "CAH19-01-03": 0.8, "CAH19-01-02": 0.6, "CAH19-01-05": 0.5},
    "ap literature": {"CAH19-01-03": 1.0, "CAH19-01-01": 0.8, "CAH19-01-05": 0.5},
    "ap language": {"CAH19-01-02": 1.0, "CAH19-01-01": 0.8, "CAH19-01-05": 0.5, "CAH19-01-07": 0.3},
    "ap human geography": "=uk:human geography",
    "world geography": "=uk:geography",
    # extras
    "band": {"CAH25-02-02": 1.0, "CAH25-02-01": 0.7, "CAH25-01-01": 0.3},
    "marching band": {"CAH25-02-02": 1.0, "CAH25-02-01": 0.7, "CAH25-01-01": 0.3},
    "orchestra": {"CAH25-02-02": 1.0, "CAH25-02-01": 0.7, "CAH25-01-01": 0.3},
    "choir": {"CAH25-02-02": 1.0, "CAH25-02-01": 0.7, "CAH25-01-01": 0.3},
    "robotics": {"CAH10-01-08": 0.8, "CAH10-01-02": 0.7, "CAH11-01-01": 0.6, "CAH11-01-05": 0.6, "CAH10-01-03": 0.5},
    "debate": {"CAH16-01-01": 0.8, "CAH15-03-01": 0.8, "CAH20-02-01": 0.5, "CAH24-01-05": 0.3},
    "speech and debate": {"CAH16-01-01": 0.8, "CAH15-03-01": 0.8, "CAH20-02-01": 0.5, "CAH24-01-05": 0.3},
    "yearbook": {"CAH24-01-04": 0.8, "CAH25-01-03": 0.6, "CAH25-01-04": 0.5, "CAH24-01-03": 0.5},
    "marketing": "=uk:marketing",
    "engineering": "=uk:engineering",
    "agriculture": "=uk:agriculture",
    "ffa": {"CAH06-01-03": 1.0, "CAH06-01-01": 0.7, "CAH06-01-02": 0.6},
    "culinary": {"CAH06-01-06": 1.0, "CAH06-01-08": 0.8, "CAH17-01-06": 0.5, "CAH02-06-02": 0.3},
    "culinary arts": {"CAH06-01-06": 1.0, "CAH06-01-08": 0.8, "CAH17-01-06": 0.5, "CAH02-06-02": 0.3},
    "cooking": {"CAH06-01-06": 1.0, "CAH06-01-08": 0.8, "CAH02-06-02": 0.4},
    "anatomy": {"CAH02-05-04": 0.8, "CAH01-01-01": 0.6, "CAH02-05-03": 0.5, "CAH02-04-01": 0.3},
    "anatomy and physiology": {"CAH02-05-04": 0.8, "CAH01-01-01": 0.6, "CAH02-05-03": 0.5, "CAH02-04-01": 0.3},
    "sociology": "=uk:sociology",
    "philosophy": "=uk:philosophy",
    "latin": {"CAH20-01-05": 1.0, "CAH19-01-07": 0.4, "CAH20-01-01": 0.3},
    "mandarin": {"CAH19-04-06": 1.0, "CAH19-04-09": 0.5, "CAH19-01-07": 0.3},
    "chinese": {"CAH19-04-06": 1.0, "CAH19-04-09": 0.5, "CAH19-01-07": 0.3},
    "japanese": {"CAH19-04-06": 1.0, "CAH19-04-09": 0.5, "CAH19-01-07": 0.3},
    "german": "=uk:german",
    "american sign language": {"CAH19-01-07": 0.8, "CAH19-04-09": 0.5, "CAH02-06-07": 0.4},
    "asl": {"CAH19-01-07": 0.8, "CAH19-04-09": 0.5, "CAH02-06-07": 0.4},
    "geology": "=uk:geology",
    "earth science": "=uk:earth science",
    "astronomy": "=uk:astronomy",
    "film": "=uk:film studies",
    "photography": "=uk:photography",
    "dance": "=uk:dance",
    "business": "=uk:business",
    "accounting": "=uk:accounting",
    "nutrition": "=uk:nutrition",
    # other things US students commonly type
    "pre med": "=uk:pre med",
    "premed": "=uk:pre med",
    "pre law": {"CAH16-01-01": 1.0, "CAH15-03-01": 0.5, "CAH20-02-01": 0.3},
    "criminal justice": {"CAH15-01-01": 0.7, "CAH16-01-01": 0.7, "CAH15-01-02": 0.5, "CAH15-01-03": 0.3},
    "forensics": "=uk:forensic science",
    "kinesiology": {"CAH03-02-01": 1.0, "CAH02-06-05": 0.6, "CAH02-05-04": 0.3},
    "sports medicine": {"CAH03-02-01": 0.8, "CAH02-06-05": 0.8, "CAH01-01-01": 0.3},
    "athletic training": {"CAH03-02-01": 0.8, "CAH02-06-05": 0.8},
    "data science": {"CAH09-01-03": 0.9, "CAH11-01-08": 0.8, "CAH11-01-01": 0.6, "CAH11-01-07": 0.4},
    "woodshop": {"CAH25-01-05": 0.6, "CAH13-01-02": 0.5, "CAH10-01-03": 0.4},
    "shop class": {"CAH10-01-03": 0.6, "CAH13-01-02": 0.5, "CAH10-01-02": 0.4},
    "auto shop": {"CAH10-01-02": 0.7, "CAH10-03-06": 0.5},
    "welding": {"CAH10-01-03": 0.7, "CAH10-03-07": 0.4, "CAH10-01-02": 0.4},
    "drafting": {"CAH13-01-01": 0.7, "CAH25-01-03": 0.6, "CAH10-01-07": 0.4},
    "cad": {"CAH25-01-03": 0.7, "CAH10-01-02": 0.5, "CAH13-01-01": 0.5},
    "ceramics": {"CAH25-01-02": 0.8, "CAH25-01-05": 0.6, "CAH25-01-01": 0.4},
    "fashion": {"CAH25-01-03": 0.8, "CAH10-03-03": 0.6, "CAH25-01-01": 0.4},
    "marine biology": {"CAH03-01-06": 0.8, "CAH03-01-03": 0.7, "CAH26-01-05": 0.5},
    "public speaking": {"CAH24-01-05": 0.6, "CAH15-03-01": 0.5, "CAH16-01-01": 0.4, "CAH25-02-03": 0.3},
    "religion": "=uk:religious studies",
    "bible": {"CAH20-02-02": 1.0, "CAH20-02-01": 0.3},
    "world languages": {"CAH19-04-09": 0.8, "CAH19-01-07": 0.5, "CAH19-04-04": 0.4, "CAH19-04-01": 0.4},
    "jrotc": {"CAH15-03-01": 0.5, "CAH10-01-01": 0.3, "CAH03-02-01": 0.3},
    "student council": {"CAH15-03-01": 0.6, "CAH17-01-04": 0.5, "CAH15-01-03": 0.3},
    "model un": {"CAH15-03-01": 0.9, "CAH15-01-05": 0.6, "CAH16-01-01": 0.3},
    "mock trial": {"CAH16-01-01": 1.0, "CAH15-03-01": 0.4},
    "deca": {"CAH17-01-03": 0.8, "CAH17-01-01": 0.7, "CAH17-01-02": 0.5},
    "hosa": {"CAH02-06-01": 0.7, "CAH02-04-01": 0.6, "CAH01-01-01": 0.5},
}


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text.lower())).strip()


# ---------------------------------------------------------------------------
# Wording: UK -> US. Applied to display_name, plain and why_line only.
# Word-boundary, case-preserving for a leading capital.
# ---------------------------------------------------------------------------
WORD_SWAPS = [
    ("sixth form", "high school"), ("sixth-form", "high-school"), ("A-levels", "AP classes"), ("A-level", "AP"),
    ("GCSEs", "high-school classes"), ("GCSE", "high-school"), ("universities", "colleges"), ("university", "college"),
    ("uni", "college"), ("GP", "doctor"), ("GPs", "doctors"), ("programme", "program"), ("programmes", "programs"),
    ("maths", "math"), ("organise", "organize"), ("organises", "organizes"), ("organised", "organized"),
    ("organising", "organizing"), ("organisations", "organizations"), ("organisation", "organization"),
    ("analyse", "analyze"), ("analysing", "analyzing"), ("analysed", "analyzed"), ("behaviour", "behavior"),
    ("behaviours", "behaviors"), ("colour", "color"), ("colours", "colors"), ("flavour", "flavor"),
    ("flavours", "flavors"), ("neighbourhood", "neighborhood"), ("neighbourhoods", "neighborhoods"),
    ("jewellery", "jewelry"), ("modelling", "modeling"), ("theatre", "theater"), ("theatres", "theaters"),
    ("centre", "center"), ("centres", "centers"), ("favourite", "favorite"), ("practise", "practice"),
    ("licence", "license"), ("defence", "defense"), ("labour", "labor"), ("honours", "honors"),
    ("honour", "honor"), ("humour", "humor"), ("travelling", "traveling"), ("catalogue", "catalog"),
    ("cataloguing", "cataloging"), ("grey", "gray"), ("holidays", "vacations"), ("holiday", "vacation"),
    ("whilst", "while"), ("learnt", "learned"), ("towards", "toward"), ("amongst", "among"),
    ("counselling", "counseling"), ("counsellor", "counselor"), ("counsellors", "counselors"),
    ("specialism", "specialty"), ("specialisms", "specialties"), ("aluminium", "aluminum"), ("fibre", "fiber"),
    ("metre", "meter"), ("metres", "meters"), ("litre", "liter"), ("recognise", "recognize"),
    ("realise", "realize"), ("minimise", "minimize"), ("maximise", "maximize"), ("optimise", "optimize"),
    ("specialise", "specialize"), ("specialised", "specialized"), ("visualise", "visualize"),
    ("physiotherapy", "physical therapy"), ("physiotherapist", "physical therapist"),
    ("physiotherapists", "physical therapists"), ("pharmacist's", "pharmacist's"), ("chemist", "pharmacist"),
    ("fortnight", "two weeks"), ("timetable", "schedule"), ("mobile phone", "cell phone"), ("films", "movies"),
    ("degree", "degree"),
]


def _swap(text: str) -> str:
    for uk, us in WORD_SWAPS:
        if uk == us:
            continue
        pattern = re.compile(r"\b" + re.escape(uk) + r"\b")
        text = pattern.sub(us, text)
        if uk[0].islower():
            cap = re.compile(r"\b" + re.escape(uk[0].upper() + uk[1:]) + r"\b")
            text = cap.sub(us[0].upper() + us[1:], text)
    return text


# Hand overrides where a word swap is not enough (US names for the field, or
# a note on how the US path differs). Any of display_name / plain / why_line.
OVERRIDES: dict[str, dict[str, str]] = {
    "CAH01-01-02": {"plain": "You study the human body, illness and how doctors diagnose and treat patients — in the US that means pre-med, then med school."},
    "CAH01-01-03": {"display_name": "Medical specialties"},
    "CAH01-01-04": {"plain": "You study teeth, gums and mouth health, learning hands-on care and treatment (pre-dental, then dental school in the US)."},
    "CAH02-04-04": {"display_name": "Midwifery (nurse-midwife)", "plain": "You learn to support pregnancy, birth and newborn care with practical science and hands-on care — in the US, as a nurse who specializes after an RN."},
    "CAH02-04-05": {"display_name": "Pediatric nursing", "plain": "You learn to care for babies, kids and teenagers in hospitals and the community, and to support their families."},
    "CAH02-04-06": {"display_name": "Dental hygiene and assisting", "plain": "You learn to support dentists, clean and check teeth, and help patients keep healthy teeth and gums."},
    "CAH02-04-07": {"display_name": "Psychiatric and mental health nursing"},
    "CAH02-04-08": {"display_name": "Developmental disabilities nursing", "plain": "You learn how to support people with developmental disabilities to live healthier, more independent daily lives."},
    "CAH02-05-02": {"display_name": "Clinical laboratory science"},
    "CAH02-06-03": {"display_name": "Optometry"},
    "CAH02-06-05": {"display_name": "Physical therapy"},
    "CAH02-06-07": {"display_name": "Counseling, psychotherapy and occupational therapy"},
    "CAH03-02-01": {"display_name": "Kinesiology and exercise science"},
    "CAH05-01-01": {"display_name": "Veterinary medicine", "plain": "Learn to diagnose, treat and prevent illness and injury in animals, including dental care (pre-vet, then vet school in the US)."},
    "CAH06-01-04": {"display_name": "Land and ranch management", "plain": "You learn how ranches, farms and rural land are run, from crops and timber to buildings and wildlife."},
    "CAH06-01-06": {"display_name": "Culinary and food studies"},
    "CAH09-01-02": {"display_name": "Operations research"},
    "CAH10-01-03": {"display_name": "Industrial and manufacturing engineering"},
    "CAH10-01-04": {"display_name": "Aerospace engineering"},
    "CAH10-03-01": {"display_name": "Mining and minerals engineering"},
    "CAH11-01-07": {"display_name": "Management information systems"},
    "CAH13-01-02": {"display_name": "Construction management"},
    "CAH13-01-04": {"display_name": "Urban and regional planning"},
    "CAH15-01-03": {"display_name": "Public policy", "plain": "You study how services like housing, healthcare and welfare try to reduce inequality and support people."},
    "CAH15-03-01": {"display_name": "Political science"},
    "CAH16-01-01": {"plain": "You study the rules that govern society and how courts interpret and apply them (pre-law, then law school in the US)."},
    "CAH17-01-02": {"display_name": "General business"},
    "CAH19-01-01": {"display_name": "English"},
    "CAH19-01-03": {"display_name": "Literature"},
    "CAH19-04-04": {"display_name": "Spanish and Portuguese studies"},
    "CAH19-04-08": {"display_name": "American studies", "plain": "You study the history, culture, politics and literature of the United States and the wider Americas.", "why_line": "Good if you question how America came to be the way it is."},
    "CAH22-01-02": {"display_name": "Teacher education", "plain": "Learn how to plan lessons, manage classrooms and help kids learn across school subjects."},
    "CAH23-01-01": {"display_name": "Interdisciplinary studies", "plain": "You design your own major by mixing subjects like politics, art and science."},
    "CAH23-01-04": {"display_name": "Liberal arts"},
    "CAH24-01-01": {"display_name": "Library and information science"},
    "CAH24-01-02": {"display_name": "Public relations and advertising"},
    "CAH24-01-05": {"display_name": "Communication and media studies"},
    "CAH25-01-04": {"display_name": "Film and photography"},
    "CAH25-02-03": {"display_name": "Theater"},
    "CAH26-01-02": {"display_name": "Physical geography and atmospheric science"},
    "CAH26-01-06": {"display_name": "Geology and earth sciences"},
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def build_aliases(uk_aliases: dict[str, dict[str, float]], codes: set[str]) -> dict[str, dict[str, float]]:
    out = dict(uk_aliases)
    for raw_key, spec in US_ALIASES.items():
        key = normalise(raw_key)
        if isinstance(spec, str) and spec.startswith("=uk:"):
            row = uk_aliases.get(spec[4:])
            if row is None:
                raise SystemExit(f"alias {key!r} points at missing UK row {spec[4:]!r}")
        else:
            row = spec
        bad = [c for c in row if c not in codes]
        if bad:
            raise SystemExit(f"alias {key!r} uses unknown codes {bad}")
        out[key] = dict(row)
    for chip in CHIPS:
        if normalise(chip["name"]) not in out:
            raise SystemExit(f"chip {chip['name']!r} has no alias row")
    for name in EXTRA_NAMES:
        if normalise(name) not in out:
            raise SystemExit(f"extra {name!r} has no alias row")
    return dict(sorted(out.items()))


def build_content(uk: dict, codes: set[str]) -> dict:
    content = dict(uk)
    content["chips"] = CHIPS
    content["extra_names"] = EXTRA_NAMES
    content["aliases"] = build_aliases(uk.get("aliases", {}), codes)
    return content


def us_subject(s: dict, cips: list[str], course_count: int) -> dict:
    out = dict(s)
    for f in ("display_name", "plain", "why_line"):
        out[f] = _swap(s[f])
    for f, v in OVERRIDES.get(s["code"], {}).items():
        out[f] = v
    out["cips"] = cips
    out["course_count"] = course_count
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reset", action="store_true", help="overwrite per-subject files even if they hold courses")
    args = ap.parse_args(argv)

    uk_content = load_json(UK_DATA / "content.json")
    uk_subjects = load_json(UK_DATA / "subjects.json")
    items = uk_subjects["subjects"]
    codes = {s["code"] for s in items}

    cw = load_json(CROSSWALK)["mappings"]
    cips_for: dict[str, list[str]] = {c: [] for c in codes}
    for m in cw:
        for c in m["subjects"]:
            if c not in codes:
                raise SystemExit(f"crosswalk uses unknown code {c}; run build_crosswalk.py")
            cips_for[c].append(m["cip4"])

    # per-subject files
    subj_dir = PACK / "subjects"
    subj_dir.mkdir(parents=True, exist_ok=True)
    course_counts: dict[str, int] = {}
    written = kept = 0
    for s in items:
        code = s["code"]
        target = subj_dir / f"{code}.json"
        if target.exists() and not args.reset:
            existing = load_json(target)
            if existing.get("courses"):
                course_counts[code] = len(existing["courses"])
                kept += 1
                continue
        uk_file = UK_SUBJECTS_DIR / f"{code}.json"
        jobs = load_json(uk_file).get("jobs", []) if uk_file.exists() else []
        dump_json(target, {"code": code, "attribution": ATTRIBUTION, "courses": [], "jobs": jobs, "apprenticeships": []})
        course_counts[code] = 0
        written += 1

    us_items = [us_subject(s, sorted(cips_for[s["code"]]), course_counts[s["code"]]) for s in items]
    dump_json(PACK / "data" / "subjects.json", {"count": len(us_items), "subjects": us_items})
    dump_json(PACK / "data" / "content.json", build_content(uk_content, codes))

    print(f"wrote {PACK / 'data' / 'content.json'}")
    print(f"wrote {PACK / 'data' / 'subjects.json'} ({len(us_items)} subjects)")
    print(f"per-subject files: {written} written empty, {kept} kept with loaded courses")
    return 0


if __name__ == "__main__":
    sys.exit(main())
