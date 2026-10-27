"""Build data/processed/inkling.db from the HESA Discover Uni dataset.

Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0

Inputs (under data/raw/):
  - on_*/KISCOURSE.csv etc. (CSV export of the KIS XML, encoding cp1252)
  - HECoS_CAH_Version_1.3.4.xlsx  sheet "CAH (V1.3.4)" for the CAH hierarchy
  - KISAIMdata_26061.csv          KISAIM code -> Level (F/U) + long name
Filter: full undergraduate degrees only = KISLEVEL '03' AND KISAIM Level 'F'
(the two coincide exactly in this release). KISMODE is kept in the course id
so full-time (01) and part-time (02) variants stay distinct for stats joins.
"""
import csv
import json
import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DB_PATH = ROOT / "data" / "processed" / "inkling.db"
SUBJECTS_JSON = ROOT / "data" / "subjects.json"
ENRICH_JSONL = ROOT / "data" / "processed" / "enrichment_input.jsonl"
ATTRIBUTION = "Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0"
AGG_PRIORITY = {"14": 0, "24": 1, "13": 2, "23": 3, "12": 4, "22": 5, "11": 6, "21": 7}
TARIFF_BANDS = [("T001", 1), ("T048", 48), ("T064", 64), ("T080", 80), ("T096", 96),
                ("T112", 112), ("T128", 128), ("T144", 144), ("T160", 160), ("T176", 176),
                ("T192", 192), ("T208", 208), ("T224", 224), ("T240", 240)]


def find_dataset_dir() -> Path:
    hits = [p for p in RAW.rglob("KISCOURSE.csv")]
    if not hits:
        sys.exit(f"No KISCOURSE.csv under {RAW}. Unzip the HESA download into data/raw/ first.")
    return hits[0].parent


def read_csv(path: Path):
    with open(path, newline="", encoding="cp1252", errors="replace") as fh:
        yield from csv.DictReader(fh)


def s(v) -> str:
    return (v or "").strip()


def num(v):
    v = s(v)
    return int(v) if v.lstrip("-").isdigit() else None


def tariff_median(row) -> int | None:
    total, cum = 0, 0
    for _, lo in TARIFF_BANDS:
        total += num(row.get(_)) or 0
    if total == 0:
        return None
    for col, lo in TARIFF_BANDS:
        cum += num(row.get(col)) or 0
        if cum >= 50:
            return lo
    return None


def best_rows(path: Path, value_col: str):
    """One row per course key: HESA publishes most specific first (14>24>13>23>12>22>11>21)."""
    best: dict[tuple, dict] = {}
    for row in read_csv(path):
        if s(row.get(value_col)) == "":
            continue
        key = (s(row["PUBUKPRN"]), s(row["UKPRN"]), s(row["KISCOURSEID"]), s(row["KISMODE"]))
        agg = s(row.get(next(c for c in row if c.endswith("AGG") and not c.endswith("AGGYEAR")))) if row else ""
        rank = AGG_PRIORITY.get(agg, 99)
        if key not in best or rank < best[key][0]:
            best[key] = (rank, row)
    return {k: v[1] for k, v in best.items()}


def parse_cah(xlsx: Path):
    import openpyxl
    ws = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)["CAH (V1.3.4)"]
    subs: dict[str, dict] = {}
    for r in list(ws.iter_rows(values_only=True))[1:]:
        if not r or not r[3]:
            continue
        for code, text, level in ((s(r[3]), r[0], 1), (s(r[4]), r[1], 2), (s(r[5]), r[2], 3)):
            if not code:
                continue
            name = re.sub(r"^\(CAH[^)]*\)\s*", "", s(text))
            parent = {"1": None, "2": s(r[3]), "3": s(r[4])}[str(level)]
            subs.setdefault(code, {"code": code, "name": name, "level": level, "parent_code": parent})
    return subs


def main() -> int:
    ds = find_dataset_dir()
    xlsx = next(RAW.glob("HECoS_CAH*.xlsx"), None)
    kisaim_csv = next(RAW.glob("KISAIMdata*.csv"), None)
    if not xlsx or not kisaim_csv:
        sys.exit("Missing CAH xlsx or KISAIMdata csv in data/raw/.")
    level_of, long_of = {}, {}
    with open(kisaim_csv, encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            code = s(row["KISAIM,Valid Entry"])
            level_of[code], long_of[code] = s(row["Level"]), s(row["Long name"])
    label_of = {s(r["KISAIMCODE"]): s(r["KISAIMLABEL"]) for r in read_csv(ds / "KISAIM.csv")}
    kept_codes = sorted(c for c, lv in level_of.items() if lv == "F")
    print(f"Kept KISAIM codes (Level F, {len(kept_codes)}): {', '.join(kept_codes)}")

    subjects = parse_cah(xlsx)
    providers: dict[str, dict] = {}
    for r in read_csv(ds / "INSTITUTION.csv"):
        ukprn = s(r["UKPRN"])
        if ukprn and ukprn not in providers:
            providers[ukprn] = {"ukprn": ukprn, "pubukprn": s(r["PUBUKPRN"]),
                                "name": s(r["FIRST_TRADING_NAME"]) or s(r["LEGAL_NAME"]),
                                "website": s(r["PROVURL"])}

    courses: dict[tuple, dict] = {}
    for r in read_csv(ds / "KISCOURSE.csv"):
        code = s(r["KISAIMCODE"])
        if s(r["KISLEVEL"]) != "03" or level_of.get(code) != "F":
            continue
        key = (s(r["PUBUKPRN"]), s(r["UKPRN"]), s(r["KISCOURSEID"]), s(r["KISMODE"]))
        courses[key] = {"id": f"{key[1]}:{key[2]}:{key[3]}", "ukprn": key[1], "pubukprn": key[0],
                        "kiscourseid": key[2], "kismode": key[3],
                        "mode": "Full-time" if key[3] == "01" else "Part-time",
                        "title": s(r["TITLE"]), "url": s(r["CRSEURL"]), "ucas_code": s(r["UCASPROGID"]),
                        "assessment_url": s(r["ASSURL"]), "teaching_url": s(r["LTURL"]),
                        "cost_url": s(r["CRSECSTURL"]), "foundation_year": num(r["FOUNDATION"]),
                        "qualification_code": code,
                        "qualification": long_of.get(code) or label_of.get(code, code),
                        "length_years": num(r["NUMSTAGE"]),
                        "placement_year": 1 if s(r["SANDWICH"]) not in ("", "0") else 0,
                        "year_abroad": 1 if s(r["YEARABROAD"]) not in ("", "0") else 0}

    course_subjects: set[tuple[str, str]] = set()
    for r in read_csv(ds / "SBJ.csv"):
        key = (s(r["PUBUKPRN"]), s(r["UKPRN"]), s(r["KISCOURSEID"]), s(r["KISMODE"]))
        if key in courses:
            course_subjects.add((courses[key]["id"], s(r["SBJ"])))

    loc_by_key = {(s(r["UKPRN"]), s(r["LOCID"])): r for r in read_csv(ds / "LOCATION.csv")}
    locations: dict[str, dict] = {}
    for r in read_csv(ds / "COURSELOCATION.csv"):
        key = (s(r["PUBUKPRN"]), s(r["UKPRN"]), s(r["KISCOURSEID"]), s(r["KISMODE"]))
        if key not in courses:
            continue
        lk = (s(r["UKPRN"]), s(r["LOCID"]))
        loc = loc_by_key.get(lk)
        if loc:
            locations[f"{lk[0]}:{lk[1]}"] = {"id": f"{lk[0]}:{lk[1]}", "ukprn": lk[0], "locid": lk[1],
                "name": s(loc["LOCNAME"]), "latitude": float(loc["LATITUDE"]) if s(loc["LATITUDE"]) else None,
                "longitude": float(loc["LONGITUDE"]) if s(loc["LONGITUDE"]) else None,
                "accommodation_url": s(loc["ACCOMURL"])}

    # NSS themes T1-T7 (Q26 is the students' union question, not satisfaction).
    nss = best_rows(ds / "NSS.csv", "T1")
    # Overall satisfaction Q28 is asked outside England only; null for England.
    nss_country = best_rows(ds / "NSSCOUNTRY.csv", "Q28")
    cont = best_rows(ds / "CONTINUATION.csv", "UCONT")
    emp = best_rows(ds / "EMPLOYMENT.csv", "WORKSTUDY")  # % in work or study
    # LEO medians are subject-level aggregates (LEO3SBJ/LEO5SBJ) attached per course, not course-level.
    leo3 = best_rows(ds / "LEO3.csv", "LEO3INSTMED")
    leo5 = best_rows(ds / "LEO5.csv", "LEO5INSTMED")
    # Jobs: JOBLIST rows group by COMSBJ; keep only the group whose COMMON COMAGG ranks best.
    com_agg = {(s(r["PUBUKPRN"]), s(r["UKPRN"]), s(r["KISCOURSEID"]), s(r["KISMODE"]), s(r["COMSBJ"])): s(r["COMAGG"])
               for r in read_csv(ds / "COMMON.csv")}
    jobs_by_course: dict[tuple, dict[str, list]] = defaultdict(lambda: defaultdict(list))
    for r in read_csv(ds / "JOBLIST.csv"):
        key = (s(r["PUBUKPRN"]), s(r["UKPRN"]), s(r["KISCOURSEID"]), s(r["KISMODE"]))
        if key in courses:
            jobs_by_course[key][s(r["COMSBJ"])].append(r)
    course_jobs: list[tuple] = []
    for key, groups in jobs_by_course.items():
        best_sbj = min(groups, key=lambda sbj: AGG_PRIORITY.get(com_agg.get(key + (sbj,), ""), 99))
        for r in groups[best_sbj]:
            course_jobs.append((courses[key]["id"], s(r["JOB"]), num(r["PERC"]), num(r["ORDER"]), num(r["HS"])))
    tar_best: dict[tuple, dict] = {}
    for row in read_csv(ds / "TARIFF.csv"):
        if tariff_median(row) is None:
            continue
        key = (s(row["PUBUKPRN"]), s(row["UKPRN"]), s(row["KISCOURSEID"]), s(row["KISMODE"]))
        rank = AGG_PRIORITY.get(s(row["TARAGG"]), 99)
        if key not in tar_best or rank < tar_best[key][0]:
            tar_best[key] = (rank, row)
    tariff = {k: v[1] for k, v in tar_best.items()}

    def g(d, key, col):
        r = d.get(key)
        return s(r[col]) if r and s(r.get(col)) != "" else None

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE providers(ukprn TEXT PRIMARY KEY, pubukprn TEXT, name TEXT, website TEXT);
CREATE TABLE locations(id TEXT PRIMARY KEY, ukprn TEXT, locid TEXT, name TEXT, latitude REAL, longitude REAL, accommodation_url TEXT);
CREATE TABLE subjects(code TEXT PRIMARY KEY, name TEXT, level INTEGER, parent_code TEXT);
CREATE TABLE courses(id TEXT PRIMARY KEY, ukprn TEXT, pubukprn TEXT, kiscourseid TEXT, kismode TEXT,
  mode TEXT, title TEXT, url TEXT, ucas_code TEXT, assessment_url TEXT, teaching_url TEXT, cost_url TEXT,
  foundation_year INTEGER, qualification_code TEXT, qualification TEXT,
  length_years INTEGER, placement_year INTEGER, year_abroad INTEGER);
CREATE TABLE course_subjects(course_id TEXT, cah_code TEXT, PRIMARY KEY(course_id, cah_code));
CREATE TABLE course_jobs(course_id TEXT, job TEXT, percent INTEGER, "order" INTEGER, highly_skilled INTEGER);
CREATE TABLE course_stats(course_id TEXT PRIMARY KEY,
  nss_t1_teaching REAL, nss_t2_assessment_feedback REAL, nss_t3_academic_support REAL,
  nss_t4_learning_opportunities REAL, nss_t5_organisation REAL, nss_t6_learning_resources REAL,
  nss_t7_learning_community REAL, nss_agg TEXT, nss_pop INTEGER, nss_unavail_reason TEXT,
  nss_overall_q28 REAL, nss_country_agg TEXT, nss_country_pop INTEGER, nss_country_unavail_reason TEXT,
  continuation_pct REAL, cont_agg TEXT, cont_pop INTEGER, cont_unavail_reason TEXT,
  employment_pct REAL, emp_agg TEXT, emp_pop INTEGER, emp_unavail_reason TEXT,
  leo3_median_earnings INTEGER, leo3_agg TEXT, leo3_pop INTEGER, leo3_unavail_reason TEXT,
  leo5_median_earnings INTEGER, leo5_agg TEXT, leo5_pop INTEGER, leo5_unavail_reason TEXT,
  entry_tariff_median INTEGER, tariff_agg TEXT, tariff_pop INTEGER, tariff_unavail_reason TEXT);
""")
    con.execute("INSERT INTO meta VALUES('attribution',?)", (ATTRIBUTION,))
    con.executemany("INSERT INTO providers VALUES(:ukprn,:pubukprn,:name,:website)",
                    [providers[k] for k in sorted({c["ukprn"] for c in courses.values()} & set(providers))])
    con.executemany("INSERT INTO locations VALUES(:id,:ukprn,:locid,:name,:latitude,:longitude,:accommodation_url)", list(locations.values()))
    con.executemany("INSERT INTO subjects VALUES(:code,:name,:level,:parent_code)", list(subjects.values()))
    con.executemany("INSERT INTO courses VALUES(:id,:ukprn,:pubukprn,:kiscourseid,:kismode,:mode,:title,:url,:ucas_code,:assessment_url,:teaching_url,:cost_url,:foundation_year,:qualification_code,:qualification,:length_years,:placement_year,:year_abroad)", list(courses.values()))
    con.executemany("INSERT INTO course_subjects VALUES(?,?)", sorted(course_subjects))
    con.executemany("INSERT INTO course_jobs VALUES(?,?,?,?,?)", course_jobs)
    rows = []
    for key, c in courses.items():
        rows.append((c["id"], num(g(nss, key, "T1")), num(g(nss, key, "T2")), num(g(nss, key, "T3")),
                     num(g(nss, key, "T4")), num(g(nss, key, "T5")), num(g(nss, key, "T6")), num(g(nss, key, "T7")),
                     g(nss, key, "NSSAGG"), num(g(nss, key, "NSSPOP")), g(nss, key, "NSSUNAVAILREASON"),
                     num(g(nss_country, key, "Q28")), g(nss_country, key, "NSSCOUNTRYAGG"),
                     num(g(nss_country, key, "NSSCOUNTRYPOP")), g(nss_country, key, "NSSCOUNTRYUNAVAILREASON"),
                     num(g(cont, key, "UCONT")), g(cont, key, "CONTAGG"), num(g(cont, key, "CONTPOP")), g(cont, key, "CONTUNAVAILREASON"),
                     num(g(emp, key, "WORKSTUDY")), g(emp, key, "EMPAGG"), num(g(emp, key, "EMPPOP")), g(emp, key, "EMPUNAVAILREASON"),
                     num(g(leo3, key, "LEO3INSTMED")), g(leo3, key, "LEO3AGG"), num(g(leo3, key, "LEO3POP")), g(leo3, key, "LEO3UNAVAILREASON"),
                     num(g(leo5, key, "LEO5INSTMED")), g(leo5, key, "LEO5AGG"), num(g(leo5, key, "LEO5POP")), g(leo5, key, "LEO5UNAVAILREASON"),
                     tariff_median(tariff[key]) if key in tariff else None, g(tariff, key, "TARAGG"),
                     num(g(tariff, key, "TARPOP")), g(tariff, key, "TARUNAVAILREASON")))
    con.executemany("INSERT INTO course_stats VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    con.commit()

    by_l3: dict[str, set] = defaultdict(set)
    for cid, cah in course_subjects:
        by_l3[cah].add(cid)
    out = []
    for code, sub in sorted(subjects.items()):
        if sub["level"] == 3:
            n = len(by_l3.get(code, set()))
        elif sub["level"] == 2:
            ids: set = set()
            for l3, cids in by_l3.items():
                if subjects.get(l3, {}).get("parent_code") == code:
                    ids |= cids
            n = len(ids)
        else:
            continue
        out.append({"code": code, "name": sub["name"], "level": sub["level"],
                    "parent_code": sub["parent_code"],
                    "parent_name": subjects[sub["parent_code"]]["name"] if sub["parent_code"] in subjects else None,
                    "course_count": n})
    SUBJECTS_JSON.write_text(json.dumps({"attribution": ATTRIBUTION, "subjects": out}, indent=2, ensure_ascii=False))
    names_of: dict[str, list] = defaultdict(list)
    for cid, cah in sorted(course_subjects):
        names_of[cid].append(subjects.get(cah, {}).get("name", cah))
    with open(ENRICH_JSONL, "w") as fh:
        for c in sorted(courses.values(), key=lambda x: x["id"]):
            fh.write(json.dumps({"id": c["id"], "title": c["title"],
                "provider": providers.get(c["ukprn"], {}).get("name", ""), "provider_ukprn": c["ukprn"],
                "subjects": names_of.get(c["id"], []), "url": c["url"]}, ensure_ascii=False) + "\n")

    n_nss = con.execute("SELECT COUNT(*) FROM course_stats WHERE nss_t1_teaching IS NOT NULL").fetchone()[0]
    n_leo = con.execute("SELECT COUNT(*) FROM course_stats WHERE leo3_median_earnings IS NOT NULL OR leo5_median_earnings IS NOT NULL").fetchone()[0]
    n_agg = con.execute("SELECT COUNT(*) FROM course_stats WHERE nss_agg IN ('14','24')").fetchone()[0]
    print(ATTRIBUTION)
    print(f"providers={len({c['ukprn'] for c in courses.values()})} courses={len(courses)} subjects={len(subjects)} (L2/L3 in json={len(out)}) locations={len(locations)} course_jobs={len(course_jobs)}")
    print(f"courses with NSS={n_nss} courses with LEO={n_leo} course_stats rows using AGG 14/24 (nss_agg)={n_agg}")
    for r in con.execute("""SELECT c.id,c.title,p.name,s.nss_t1_teaching,s.leo3_median_earnings
        FROM courses c JOIN providers p ON p.ukprn=c.ukprn JOIN course_stats s ON s.course_id=c.id
        WHERE s.nss_t1_teaching IS NOT NULL AND s.leo3_median_earnings IS NOT NULL
        AND EXISTS (SELECT 1 FROM course_jobs j WHERE j.course_id=c.id) LIMIT 3"""):
        jobs = con.execute('SELECT job, percent FROM course_jobs WHERE course_id=? ORDER BY percent DESC LIMIT 2', (r[0],)).fetchall()
        print(r + (jobs,))
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
