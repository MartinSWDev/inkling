# Australian data pack

The Australian pack lives in `web/public/packs/au/` and mirrors the UK files
exactly (`data/content.json`, `data/subjects.json`, `subjects/<code>.json`).
Subject codes, profiles and scoring are the UK ones; only wording, the subject
chips (Australian Year 11-12 subjects) and the per-subject course / job /
apprenticeship lists change. Courses come from CRICOS, matched to our subjects
through a hand-written ASCED Field of Education crosswalk.

Contains CRICOS data from the Australian Government Department of Education, via data.gov.au.

**Licence:** check the licence shown on the data.gov.au resource page before
publishing (data.gov.au datasets are usually CC BY, but confirm for the
release you download) and keep the attribution line above.

## Download

1. Go to https://data.gov.au and search for the dataset **"CRICOS"**
   (Commonwealth Register of Institutions and Courses for Overseas Students).
2. Download the latest **"CRICOS Providers, Courses and Locations"** resource
   (an `.xlsx` with sheets such as Institutions, Courses, Locations and
   Course Locations).
3. Save it as `data/raw/au/CRICOS Providers, Courses and Locations.xlsx`.
   Everything under `data/raw/` is git-ignored (`.gitignore`: `data/raw/*`).

The loader needs `openpyxl` to read `.xlsx`: `pip install openpyxl`.

## Rebuild

From the repo root:

```sh
python3 -I scripts/au/build_crosswalk.py      # validate ASCED -> subject crosswalk, print coverage
python3 -I scripts/au/build_pack.py           # content.json, subjects.json, empty per-subject files
python3 -I scripts/au/load_cricos.py \
    --xlsx "data/raw/au/CRICOS Providers, Courses and Locations.xlsx"   # fill courses + course_count
# options: --dry-run  --max-per-subject 200  --include-associate  --pack web/public/packs/au
```

`build_pack.py` is safe to re-run after loading: it keeps per-subject files
that already hold courses (pass `--reset` to wipe them).

The loader prints the sheets and columns it recognised and any Field of
Education values it could not map; add those to
`scripts/au/asced_crosswalk.json` and re-run. Column names change between
monthly releases, so it matches them case-insensitively and fuzzily
(CRICOS Provider Code, Institution Name / Trading Name, Institution Type,
Website, CRICOS Course Code, Course Name, Course Level, Field of Education
1/2 Broad / Narrow / Detailed Field, Duration (Weeks), Tuition Fee, Expired,
Location Name, City, State, Postcode). Field cells may hold codes
(`010101`, or `10101` when Excel drops the zero), names, or `code - name`.

Courses kept: Bachelor Degree and Bachelor Honours Degree (plus Associate
Degree with `--include-associate`), not expired, one per (provider, course
name), up to 200 per subject with universities first. `setting` is `city` for
the state capitals plus Gold Coast, Newcastle, Wollongong and Geelong (by
location city, or by an approximate metro postcode range for suburb campuses)
and `regional` otherwise.

## Apprenticeships (not loaded yet)

`scripts/au/load_apprenticeships.py` is a skeleton. Plan: export the current
qualifications list from https://training.gov.au (code, title, Field of
Education), optionally with a state list of qualifications approved as
Australian Apprenticeships / traineeships, save in `data/raw/au/`, then

```sh
python3 -I scripts/au/load_apprenticeships.py \
    --qualifications data/raw/au/tga_qualifications.csv \
    [--approved data/raw/au/approved_apprenticeships.csv]
```

Certificate III / IV, Diploma and Advanced Diploma qualifications map to
subjects through the same ASCED crosswalk. Until then every subject ships
`apprenticeships: []` and the script exits 2.

## Files

- `scripts/au/asced_crosswalk.json` - ASCED broad / narrow / detailed fields -> 1-2 subject codes; `"confidence": "low"` marks best-effort placements; `title_rules` refine by course name (languages, Celtic, developmental psychology...).
- `web/public/packs/au/data/content.json` - UK cards with Australian Year 11-12 chips, Australian extra names and extended aliases.
- `web/public/packs/au/data/subjects.json` - 163 subjects, Australian wording, `asced` list, `course_count`.
- `web/public/packs/au/subjects/<code>.json` - courses (CRICOS), jobs (copied from the UK file), apprenticeships.
