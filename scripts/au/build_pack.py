"""
Build the Australian data pack from the live UK files + the ASCED crosswalk.

Writes
  web/public/packs/au/data/content.json   UK content with Australian Year 11-12
                                           subject chips, Australian extra_names
                                           and extended aliases; things, pairs and
                                           questions are carried over unchanged
  web/public/packs/au/data/subjects.json  same 163 subjects (code, object, slot,
                                           neighbours, keywords, profile, name,
                                           parent, sam_labels unchanged), wording
                                           adjusted for Australian usage, plus "asced"
  web/public/packs/au/subjects/<code>.json one file per subject so the app never
                                           404s; courses empty until load_cricos.py
                                           runs; jobs copied from the UK file;
                                           apprenticeships []

Australian English uses British spelling, so unlike the US pack there is no
spelling swap; only UK-system words change (sixth form, A-level, NHS ...).

Existing per-subject files that already hold CRICOS courses are kept (and
their course_count carried into subjects.json) unless --reset is passed.

Run from the repo root (standard library only):
    python3 -I scripts/au/build_pack.py
    python3 -I scripts/au/build_pack.py --reset     # also wipe loaded courses
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
PACK = ROOT / "web" / "public" / "packs" / "au"
CROSSWALK = Path(__file__).resolve().parent / "asced_crosswalk.json"

ATTRIBUTION = "Contains CRICOS data from the Australian Government Department of Education, via data.gov.au."

# ---------------------------------------------------------------------------
# Chips: Australian Year 11-12 subjects (names that read across VCE, HSC, QCE,
# SACE, WACE, TCE). Scoring matches each term as a substring of
# "display_name + name + keywords" of every subject (web/src/scoring.ts
# expandTerms), so terms reuse the UK chip vocabulary of the same meaning.
# ---------------------------------------------------------------------------
CHIPS = [
    {"id": "english", "name": "English", "terms": ["english", "books", "writing", "novels"]},
    {"id": "maths_methods", "name": "Mathematical Methods", "terms": ["maths", "mathematics", "statistics", "numbers"]},
    {"id": "specialist_maths", "name": "Specialist Maths", "terms": ["maths", "mathematics", "physics", "numbers"]},
    {"id": "general_maths", "name": "General Maths", "terms": ["maths", "statistics", "numbers", "finance"]},
    {"id": "biology", "name": "Biology", "terms": ["biology", "animals", "plants", "cells"]},
    {"id": "chemistry", "name": "Chemistry", "terms": ["chemistry", "reactions", "molecules"]},
    {"id": "physics", "name": "Physics", "terms": ["physics", "space", "quantum"]},
    {"id": "psychology", "name": "Psychology", "terms": ["psychology", "mind", "behaviour"]},
    {"id": "legal_studies", "name": "Legal Studies", "terms": ["law", "justice", "courts", "government"]},
    {"id": "business_management", "name": "Business Management", "terms": ["business", "management", "marketing", "enterprise"]},
    {"id": "economics", "name": "Economics", "terms": ["economics", "economy", "markets", "finance"]},
    {"id": "modern_history", "name": "Modern History", "terms": ["history", "past", "politics"]},
    {"id": "ancient_history", "name": "Ancient History", "terms": ["history", "ancient", "archaeology", "classics"]},
    {"id": "geography", "name": "Geography", "terms": ["geography", "maps", "environment", "cities"]},
    {"id": "visual_arts", "name": "Visual Arts", "terms": ["art", "design", "drawing", "painting"]},
    {"id": "music", "name": "Music", "terms": ["music", "performing", "musician"]},
    {"id": "drama", "name": "Drama", "terms": ["drama", "theatre", "acting", "performing", "stage"]},
    {"id": "digital_tech", "name": "Digital Technologies", "terms": ["coding", "programming", "computers", "data"]},
    {"id": "health_pe", "name": "Health & PE", "terms": ["sport", "fitness", "exercise", "nutrition", "wellbeing"]},
    {"id": "languages", "name": "Languages", "terms": ["language", "translation", "japanese", "chinese", "indonesian", "french", "italian"]},
    {"id": "design_tech", "name": "Design & Technology", "terms": ["design", "engineering", "making", "materials"]},
]

EXTRA_NAMES = [
    "Agriculture", "Accounting", "Philosophy", "Japanese", "Indonesian", "Chinese", "Italian", "French",
    "Food Tech", "Media", "Dance", "Software Engineering", "Earth & Environmental Science",
    "Aboriginal Studies", "Religion", "Outdoor Ed", "Robotics", "Debating", "Sociology",
    "Engineering Studies", "Photography", "Film", "Hospitality", "Aviation", "Marine Studies",
]

# ---------------------------------------------------------------------------
# Aliases: typed names -> {code: weight}. Keys are normalised like the client
# (lower-case, non-alphanumerics -> space). Each AU chip / extra either reuses
# a UK alias row verbatim ("=uk:<key>") or gets explicit weights where the UK
# index has no equivalent. UK rows are kept too (subject names, misspellings).
# ---------------------------------------------------------------------------
ENGLISH = {"CAH19-01-01": 1.0, "CAH19-01-03": 0.8, "CAH19-01-02": 0.6, "CAH19-01-05": 0.5}
ASIAN_LANG = {"CAH19-04-06": 1.0, "CAH19-04-09": 0.5, "CAH19-01-07": 0.3}
ANCIENT = {"CAH20-01-05": 1.0, "CAH20-01-01": 0.8, "CAH20-01-03": 0.6, "CAH20-02-02": 0.3}
INDIGENOUS = {"CAH19-04-08": 1.0, "CAH15-01-04": 0.6, "CAH20-01-01": 0.5, "CAH15-01-06": 0.4}
LEGAL = {"CAH16-01-01": 1.0, "CAH15-03-01": 0.5, "CAH15-01-02": 0.4, "CAH15-01-03": 0.3}
EARTH_ENV = {"CAH26-01-06": 0.9, "CAH26-01-04": 0.9, "CAH26-01-02": 0.6, "CAH03-01-03": 0.4}
OUTDOOR = {"CAH03-02-01": 0.8, "CAH26-01-04": 0.6, "CAH22-01-01": 0.4, "CAH17-01-06": 0.3}
DEBATE = {"CAH16-01-01": 0.8, "CAH15-03-01": 0.8, "CAH20-02-01": 0.5, "CAH24-01-05": 0.3}
ROBOTICS = {"CAH10-01-08": 0.8, "CAH10-01-02": 0.7, "CAH11-01-01": 0.6, "CAH11-01-05": 0.6, "CAH10-01-03": 0.5}
LANGUAGES = {"CAH19-04-09": 0.8, "CAH19-04-06": 0.7, "CAH19-01-07": 0.5, "CAH19-04-01": 0.4, "CAH19-04-03": 0.4}
MARINE = {"CAH03-01-03": 0.8, "CAH26-01-05": 0.6, "CAH03-01-06": 0.5, "CAH10-03-04": 0.4}

AU_ALIASES: dict[str, str | dict[str, float]] = {
    # chips
    "english": ENGLISH,
    "english advanced": ENGLISH,
    "english standard": ENGLISH,
    "english extension": {"CAH19-01-03": 1.0, "CAH19-01-05": 0.7, "CAH19-01-01": 0.7},
    "literature": {"CAH19-01-03": 1.0, "CAH19-01-05": 0.7, "CAH19-01-01": 0.7},
    "english language": "=uk:english language",
    "mathematical methods": "=uk:maths",
    "maths methods": "=uk:maths",
    "methods": "=uk:maths",
    "mathematics advanced": "=uk:maths",
    "math": "=uk:maths",
    "specialist maths": "=uk:further maths",
    "specialist mathematics": "=uk:further maths",
    "specialist": "=uk:further maths",
    "maths extension": "=uk:further maths",
    "mathematics extension": "=uk:further maths",
    "general maths": "=uk:maths",
    "general mathematics": "=uk:maths",
    "essential maths": "=uk:maths",
    "essential mathematics": "=uk:maths",
    "mathematics standard": "=uk:maths",
    "mathematical applications": "=uk:maths",
    "legal studies": LEGAL,
    "legal": LEGAL,
    "business management": "=uk:business",
    "business studies": "=uk:business studies",
    "modern history": "=uk:history",
    "ancient history": ANCIENT,
    "visual arts": "=uk:art and design",
    "visual art": "=uk:art and design",
    "visual communication design": {"CAH25-01-03": 1.0, "CAH25-01-02": 0.5, "CAH25-01-01": 0.5},
    "vcd": {"CAH25-01-03": 1.0, "CAH25-01-02": 0.5, "CAH25-01-01": 0.5},
    "theatre": "=uk:drama",
    "theatre studies": "=uk:drama",
    "digital technologies": "=uk:computer science",
    "digital technology": "=uk:computer science",
    "digital solutions": "=uk:computer science",
    "software development": "=uk:software engineering",
    "applied computing": "=uk:computer science",
    "computing": "=uk:computer science",
    "information processes and technology": "=uk:computer science",
    "health pe": "=uk:pe",
    "health and physical education": "=uk:pe",
    "physical education": "=uk:pe",
    "hpe": "=uk:pe",
    "pdhpe": "=uk:pe",
    "languages": LANGUAGES,
    "design technology": "=uk:design and technology",
    "design and technology": "=uk:design and technology",
    "product design and technology": "=uk:design and technology",
    "systems engineering": {"CAH10-01-01": 0.9, "CAH10-01-08": 0.6, "CAH10-01-02": 0.6},
    "industrial technology": {"CAH10-01-03": 0.7, "CAH13-01-02": 0.5, "CAH25-01-03": 0.5},
    # extras
    "agriculture": "=uk:agriculture",
    "agricultural and horticultural studies": {"CAH06-01-03": 1.0, "CAH06-01-02": 0.6, "CAH13-01-03": 0.4},
    "horticulture": {"CAH06-01-03": 0.8, "CAH13-01-03": 0.7, "CAH03-01-05": 0.5},
    "accounting": "=uk:accounting",
    "philosophy": "=uk:philosophy",
    "philosophy and reasoning": "=uk:philosophy",
    "japanese": ASIAN_LANG,
    "indonesian": ASIAN_LANG,
    "chinese": ASIAN_LANG,
    "mandarin": ASIAN_LANG,
    "korean": ASIAN_LANG,
    "vietnamese": ASIAN_LANG,
    "hindi": ASIAN_LANG,
    "italian": "=uk:italian",
    "french": "=uk:french",
    "german": "=uk:german",
    "spanish": "=uk:spanish",
    "food tech": "=uk:food technology",
    "food technology": "=uk:food technology",
    "food studies": "=uk:food technology",
    "food and nutrition": "=uk:food and nutrition",
    "media": "=uk:media studies",
    "media studies": "=uk:media studies",
    "media arts": "=uk:media studies",
    "dance": "=uk:dance",
    "software engineering": "=uk:software engineering",
    "earth environmental science": EARTH_ENV,
    "earth and environmental science": EARTH_ENV,
    "environmental science": "=uk:environmental science",
    "aboriginal studies": INDIGENOUS,
    "aboriginal and torres strait islander studies": INDIGENOUS,
    "indigenous studies": INDIGENOUS,
    "first nations studies": INDIGENOUS,
    "religion": "=uk:religious studies",
    "studies of religion": "=uk:religious studies",
    "religion and society": "=uk:religious studies",
    "religion and ethics": "=uk:religious studies",
    "outdoor ed": OUTDOOR,
    "outdoor education": OUTDOOR,
    "outdoor and environmental studies": OUTDOOR,
    "robotics": ROBOTICS,
    "debating": DEBATE,
    "debate": DEBATE,
    "mock trial": {"CAH16-01-01": 1.0, "CAH15-03-01": 0.4},
    "sociology": "=uk:sociology",
    "society and culture": {"CAH15-01-01": 0.9, "CAH15-01-02": 0.7, "CAH15-01-04": 0.5, "CAH15-01-06": 0.5},
    "community and family studies": {"CAH15-04-02": 0.8, "CAH15-04-01": 0.6, "CAH15-04-03": 0.6},
    "engineering studies": "=uk:engineering studies",
    "photography": "=uk:photography",
    "film": "=uk:film studies",
    "film and tv": "=uk:film studies",
    "hospitality": {"CAH17-01-09": 0.8, "CAH06-01-06": 0.7, "CAH17-01-06": 0.6},
    "aviation": {"CAH10-01-04": 0.8, "CAH17-01-06": 0.7},
    "marine studies": MARINE,
    "marine science": MARINE,
    "marine biology": MARINE,
    # other things Australian students commonly type
    "commerce": {"CAH17-01-01": 0.9, "CAH17-01-08": 0.7, "CAH17-01-07": 0.7, "CAH15-02-01": 0.5},
    "exercise science": {"CAH03-02-01": 1.0, "CAH02-06-05": 0.5},
    "human movement": {"CAH03-02-01": 1.0, "CAH02-06-05": 0.5},
    "paramedicine": {"CAH02-06-01": 0.8, "CAH02-05-02": 0.4, "CAH01-01-02": 0.3},
    "paramedic": {"CAH02-06-01": 0.8, "CAH02-05-02": 0.4, "CAH01-01-02": 0.3},
    "speech pathology": {"CAH02-06-07": 0.8, "CAH19-01-07": 0.6},
    "auslan": {"CAH19-01-06": 1.0, "CAH19-01-07": 0.6, "CAH19-04-09": 0.4},
    "criminology": "=uk:criminology",
    "pre med": "=uk:pre med",
    "textiles": "=uk:textiles",
}


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text.lower())).strip()


# ---------------------------------------------------------------------------
# Wording: UK system words -> Australian. Applied to display_name, plain and
# why_line only. Australian English keeps British spelling. Word-boundary,
# case-preserving for a leading capital. Mostly a safety net: today's UK copy
# barely uses these words, the hand overrides below do the real work.
# ---------------------------------------------------------------------------
WORD_SWAPS = [
    ("sixth form", "Year 12"), ("sixth-form", "Year 12"), ("sixth-former", "Year 12 student"),
    ("sixth-formers", "Year 12 students"), ("A-levels", "Year 12 subjects"), ("A-level", "Year 12 subject"),
    ("A levels", "Year 12 subjects"), ("A level", "Year 12 subject"), ("GCSEs", "Year 10 subjects"),
    ("GCSE", "Year 10"), ("the NHS", "the health system"), ("NHS", "health system"), ("UCAS", "uni admissions"),
    ("council housing", "public housing"), ("Year 13", "Year 12"), ("mobile phone", "mobile"),
]


def _swap(text: str) -> str:
    for uk, au in WORD_SWAPS:
        pattern = re.compile(r"\b" + re.escape(uk) + r"\b")
        text = pattern.sub(au, text)
        if uk[0].islower():
            cap = re.compile(r"\b" + re.escape(uk[0].upper() + uk[1:]) + r"\b")
            text = cap.sub(au[0].upper() + au[1:], text)
    return text


# Hand overrides where Australia names the field differently or the route
# differs. Any of display_name / plain / why_line.
OVERRIDES: dict[str, dict[str, str]] = {
    "CAH01-01-02": {"plain": "You study the human body, illness and how doctors diagnose and treat patients (in Australia, straight from Year 12 or as a graduate-entry MD)."},
    "CAH02-04-02": {"display_name": "Registered nursing (adults)"},
    "CAH02-04-06": {"display_name": "Dental assisting and oral health"},
    "CAH02-04-08": {"display_name": "Disability nursing and support", "plain": "You learn how to support people with intellectual disability to live healthier, more independent daily lives."},
    "CAH02-06-03": {"display_name": "Optometry and vision science"},
    "CAH06-01-04": {"display_name": "Farm and land management", "plain": "You learn how farms, stations and rural land are run, from crops and timber to buildings and wildlife."},
    "CAH13-01-04": {"display_name": "Urban and regional planning"},
    "CAH16-01-01": {"plain": "You study the rules that govern society and how courts interpret and apply them (in Australia, an LLB, often as a double degree, or a JD after another degree)."},
    "CAH19-01-06": {"plain": "You study signed languages like Auslan, Deaf culture and regional varieties of English in depth."},
    "CAH19-04-08": {"display_name": "Australian and American studies", "plain": "You study the history, culture, politics and literature of Australia, the United States and nearby regions, including Aboriginal and Torres Strait Islander studies.", "why_line": "Good if you question how Australia and America shape today's world."},
    "CAH22-01-02": {"display_name": "Teacher education"},
    "CAH23-01-01": {"plain": "You design your own degree by mixing subjects like politics, art and science, often as a double degree."},
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def build_aliases(uk_aliases: dict[str, dict[str, float]], codes: set[str]) -> dict[str, dict[str, float]]:
    out = dict(uk_aliases)
    for raw_key, spec in AU_ALIASES.items():
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


def au_subject(s: dict, asced: list[str], course_count: int) -> dict:
    out = dict(s)
    for f in ("display_name", "plain", "why_line"):
        out[f] = _swap(s[f])
    for f, v in OVERRIDES.get(s["code"], {}).items():
        out[f] = v
    out["asced"] = asced
    out["course_count"] = course_count
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reset", action="store_true", help="overwrite per-subject files even if they hold courses")
    ap.add_argument("--pack", type=Path, default=PACK, help="pack directory (default web/public/packs/au)")
    args = ap.parse_args(argv)
    pack: Path = args.pack

    uk_content = load_json(UK_DATA / "content.json")
    uk_subjects = load_json(UK_DATA / "subjects.json")
    items = uk_subjects["subjects"]
    codes = {s["code"] for s in items}

    cw = load_json(CROSSWALK)["mappings"]
    asced_for: dict[str, list[str]] = {c: [] for c in codes}
    for m in cw:
        for c in m["subjects"]:
            if c not in codes:
                raise SystemExit(f"crosswalk uses unknown code {c}; run build_crosswalk.py")
            asced_for[c].append(m["asced"])

    subj_dir = pack / "subjects"
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

    au_items = [au_subject(s, sorted(asced_for[s["code"]], key=lambda a: (len(a), a)), course_counts[s["code"]]) for s in items]
    dump_json(pack / "data" / "subjects.json", {"count": len(au_items), "subjects": au_items})
    dump_json(pack / "data" / "content.json", build_content(uk_content, codes))

    print(f"wrote {pack / 'data' / 'content.json'}")
    print(f"wrote {pack / 'data' / 'subjects.json'} ({len(au_items)} subjects)")
    print(f"per-subject files: {written} written empty, {kept} kept with loaded courses")
    return 0


if __name__ == "__main__":
    sys.exit(main())
