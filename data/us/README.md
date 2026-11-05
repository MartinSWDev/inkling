# US data pack

The US pack lives in `web/public/packs/us/` and mirrors the UK files exactly
(`data/content.json`, `data/subjects.json`, `subjects/<code>.json`). Subject
codes, profiles and scoring are the UK ones; only wording and the per-subject
course / job / apprenticeship lists change. Courses come from the College
Scorecard, matched to our subjects through a hand-written CIP 2020 crosswalk.

Contains College Scorecard data from the U.S. Department of Education (public domain).

## Downloads

From https://collegescorecard.ed.gov/data (scroll to "Download the data"):

1. **Most Recent Data by Field of Study** -> `Most-Recent-Cohorts-Field-of-Study.csv`
2. **Most Recent Institution-Level Data** -> `Most-Recent-Cohorts-Institution.csv`

Save both in `data/raw/us/` (everything under `data/raw/` is git-ignored).
The field-of-study file is ~300 MB; the loader streams it.

## Rebuild

From the repo root:

```sh
python3 -I scripts/us/build_crosswalk.py      # validate CIP -> subject crosswalk, print coverage
python3 -I scripts/us/build_pack.py           # content.json, subjects.json, empty per-subject files
python3 -I scripts/us/load_scorecard.py \
    --fos  data/raw/us/Most-Recent-Cohorts-Field-of-Study.csv \
    --inst data/raw/us/Most-Recent-Cohorts-Institution.csv   # fill courses + course_count
```

`build_pack.py` is safe to re-run after loading: it keeps per-subject files
that already hold courses (pass `--reset` to wipe them).

## Apprenticeships (not loaded yet)

`scripts/us/load_apprenticeships.py` is a skeleton. It needs the RAPIDS
occupation list from https://www.apprenticeship.gov/data-and-statistics and
the NCES "CIP 2020 - SOC 2018" crosswalk from
https://nces.ed.gov/ipeds/cipcode/resources.aspx?y=56, saved in `data/raw/us/`.
Until then every subject ships `apprenticeships: []`.

## Files

- `scripts/us/cip_crosswalk.json` - CIP 2020 four-digit families -> 1-2 subject codes; `"confidence": "low"` marks best-effort placements.
- `web/public/packs/us/data/content.json` - UK cards with US high-school chips, US extra names and extended aliases.
- `web/public/packs/us/data/subjects.json` - 163 subjects, US wording, `cips` list, `course_count`.
- `web/public/packs/us/subjects/<code>.json` - courses (Scorecard), jobs (copied from the UK file), apprenticeships.
