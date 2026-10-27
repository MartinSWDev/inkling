"""
Give every HESA subject an interest profile (RIASEC) and a work-context profile,
based on the jobs its graduates actually go into.

  1. Map: the 45 UK job groups in course_jobs -> O*NET occupations.
     Muse Spark drafts data/onet_map.json once. REVIEW IT BY HAND, then re-run.
  2. Profile: average O*NET interest and work-context scores per UK job group,
     then weight by each subject's job mix (course_jobs percentages).
  3. Save: subject_profiles table in inkling.db + data/subject_profiles.json.

Inputs in data/raw/onet/ (O*NET 31.0 CSVs): occupation_data.csv,
career_interest_types.csv, work_context.csv, content_model_reference.csv.

Run from the repo root:
  python scripts/onet_profiles.py            # drafts the map if missing, then builds
  python scripts/onet_profiles.py --redraft  # throw away the map and ask Spark again

Includes information from the O*NET 31.0 Database by the U.S. Department of Labor,
Employment and Training Administration (USDOL/ETA), used under CC BY 4.0. Inkling has
modified this information; USDOL/ETA has not approved, endorsed or tested these
modifications. O*NET(R) is a trademark of USDOL/ETA.
"""
import csv
import json
import re
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ONET = ROOT / "data" / "raw" / "onet"
DB = ROOT / "data" / "processed" / "inkling.db"
MAP = ROOT / "data" / "onet_map.json"
OUT_JSON = ROOT / "data" / "subject_profiles.json"
ATTRIBUTION = (
    "This includes information from the O*NET 31.0 Database "
    "(https://www.onetcenter.org/database.html) by the U.S. Department of Labor, Employment and "
    "Training Administration (USDOL/ETA). Used under the CC BY 4.0 license "
    "(https://creativecommons.org/licenses/by/4.0/). O*NET(R) is a trademark of USDOL/ETA. "
    "Inkling has modified all or some of this information; USDOL/ETA has not approved, endorsed, "
    "or tested these modifications. Changes are listed in data/README.md.")

RIASEC = ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"]
# Work-context elements we want, matched by name in content_model_reference.csv.
# key -> (name starts with, plain-English meaning)
CONTEXT = {
    "outdoors": ("Outdoors, Exposed to All Weather", "time spent outdoors"),
    "indoors": ("Indoors, Environmentally Controlled", "time spent indoors"),
    "contact": ("Contact With Others", "contact with other people"),
    "team": ("Work With or Contribute to a Work Group or Team", "team work"),
    "public": ("Deal With External Customers or the Public", "dealing with the public"),
    "sitting": ("Spend Time Sitting", "time sitting down"),
    "standing": ("Spend Time Standing", "time on your feet"),
    "freedom": ("Freedom to Make Decisions", "freedom to make decisions"),
    "unstructured": ("Determine Tasks, Priorities and Goals", "setting your own tasks"),
    "public_speaking": ("Public Speaking", "speaking to groups"),
}


def read(name):
    path = ONET / name
    if not path.exists():
        sys.exit(f"Missing {path}. Download it from https://www.onetcenter.org/database.html (CSV).")
    with open(path, newline="", encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)


def draft_map(groups, occupations):
    """Ask Muse Spark to map each UK job group to O*NET occupation codes."""
    import os
    from dotenv import load_dotenv
    from openai import OpenAI
    load_dotenv(ROOT / ".env")
    client = OpenAI(base_url="https://api.meta.ai/v1", api_key=os.environ["MODEL_API_KEY"])
    occ_list = "\n".join(f"{code} {title}" for code, title in occupations.items())
    prompt = (
        "You are mapping UK occupation groups (UK SOC 2020 names, as used in UK graduate outcomes "
        "data) to US O*NET-SOC occupations.\n\n"
        "For each UK group, list the O*NET-SOC codes of the occupations that most typically make up "
        "that group for UNIVERSITY GRADUATES in the UK. Give between 3 and 12 codes per group, most "
        "representative first. Use ONLY codes from the list below.\n\n"
        "Return JSON only, no prose: {\"<UK group exactly as given>\": [\"<code>\", ...], ...}\n\n"
        f"UK groups:\n" + "\n".join(f"- {g}" for g in groups) +
        f"\n\nO*NET-SOC occupations:\n{occ_list}")
    r = client.chat.completions.create(
        model="muse-spark-1.3", messages=[{"role": "user", "content": prompt}])
    text = r.choices[0].message.content
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        sys.exit("Spark did not return JSON:\n" + text[:1000])
    mapping = json.loads(m.group(0))
    clean = {}
    for g in groups:
        codes = [c for c in mapping.get(g, []) if c in occupations]
        clean[g] = [{"code": c, "title": occupations[c]} for c in codes]
    MAP.write_text(json.dumps({"_note": "Drafted by Muse Spark. Review each group, remove wrong "
                                        "occupations, add missing ones, then re-run.",
                               "_attribution": ATTRIBUTION, "map": clean}, indent=2))
    empty = [g for g, v in clean.items() if not v]
    print(f"Drafted {MAP} ({sum(len(v) for v in clean.values())} links)."
          + (f" Empty groups to fill by hand: {empty}" if empty else ""))


def main():
    con = sqlite3.connect(DB)
    groups = [g for (g,) in con.execute("SELECT DISTINCT job FROM course_jobs ORDER BY job")]
    occupations = {r["O*NET-SOC Code"]: r["Title"] for r in read("occupation_data.csv")}

    if "--redraft" in sys.argv or not MAP.exists():
        draft_map(groups, occupations)
        print("\nNow open data/onet_map.json and check it, then run this script again.")
        if "--redraft" in sys.argv or "--build" not in sys.argv:
            return
    mapping = json.loads(MAP.read_text())["map"]

    # Occupation-level scores --------------------------------------------------
    interest = defaultdict(dict)            # code -> {Realistic: 1-7, ...}
    for r in read("career_interest_types.csv"):
        if r["Scale ID"] == "OI" and r["Element Name"] in RIASEC:
            interest[r["O*NET-SOC Code"]][r["Element Name"]] = float(r["Data Value"])

    names = {r["Element ID"]: r["Element Name"] for r in read("content_model_reference.csv")}
    wanted = {}
    for key, (prefix, _) in CONTEXT.items():
        ids = [i for i, n in names.items() if i.startswith("4.C") and n.lower().startswith(prefix.lower())]
        if ids:
            wanted[ids[0]] = key
        else:
            print(f"warning: no work-context element named like '{prefix}'")
    context = defaultdict(dict)             # code -> {outdoors: 1-5, ...}
    for r in read("work_context.csv"):
        if r["Scale ID"] == "CX" and r["Element ID"] in wanted:
            context[r["O*NET-SOC Code"]][wanted[r["Element ID"]]] = float(r["Data Value"])

    # UK group profiles ----------------------------------------------------------
    def avg(dicts, keys):
        out = {}
        for k in keys:
            vals = [d[k] for d in dicts if k in d]
            out[k] = sum(vals) / len(vals) if vals else None
        return out

    group_profile = {}
    for g in groups:
        codes = [o["code"] for o in mapping.get(g, [])]
        if not codes:
            continue
        group_profile[g] = {**avg([interest[c] for c in codes if c in interest], RIASEC),
                            **avg([context[c] for c in codes if c in context], CONTEXT)}

    # Subject profiles (weighted by each course's job mix) ------------------------
    rows = con.execute("""
        SELECT cs.cah_code, j.job, j.percent FROM course_jobs j
        JOIN courses c ON c.id = j.course_id AND c.mode = 'Full-time'
        JOIN course_subjects cs ON cs.course_id = c.id""").fetchall()
    acc = defaultdict(lambda: defaultdict(float))
    weight = defaultdict(lambda: defaultdict(float))
    for cah, job, pct in rows:
        prof = group_profile.get(job)
        if not prof or not pct:
            continue
        for k, v in prof.items():
            if v is not None:
                acc[cah][k] += v * pct
                weight[cah][k] += pct
    keys = RIASEC + list(CONTEXT)
    subject_names = dict(con.execute("SELECT code, name FROM subjects"))
    profiles = {cah: {k: round(acc[cah][k] / weight[cah][k], 2) if weight[cah][k] else None for k in keys}
                for cah in acc}

    con.execute("DROP TABLE IF EXISTS subject_profiles")
    con.execute(f"CREATE TABLE subject_profiles(cah_code TEXT PRIMARY KEY, "
                f"{', '.join(k.lower() + ' REAL' for k in keys)})")
    con.executemany(f"INSERT INTO subject_profiles VALUES({','.join('?' * (len(keys) + 1))})",
                    [(cah, *[p[k] for k in keys]) for cah, p in profiles.items()])
    con.execute("INSERT OR REPLACE INTO meta VALUES('onet_attribution', ?)", (ATTRIBUTION,))
    con.commit()
    OUT_JSON.write_text(json.dumps({
        "attribution": ATTRIBUTION,
        "scales": {"riasec": "O*NET occupational interest, 1 (low) to 7 (high)",
                   "context": {k: f"{m}, 1 (low) to 5 (high)" for k, (_, m) in CONTEXT.items()}},
        "subjects": {cah: {"name": subject_names.get(cah, cah), **p} for cah, p in sorted(profiles.items())},
    }, indent=1))

    print(f"Profiles for {len(profiles)} subjects -> subject_profiles table and {OUT_JSON.name}\n")
    for k in ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional",
              "outdoors", "contact", "public", "sitting", "freedom"]:
        ranked = sorted(((p[k], c) for c, p in profiles.items() if p.get(k) is not None), reverse=True)
        if not ranked:
            continue
        top = ", ".join(f"{subject_names.get(c, c)[:22]} {v:.1f}" for v, c in ranked[:4])
        low = ", ".join(f"{subject_names.get(c, c)[:22]} {v:.1f}" for v, c in ranked[-3:])
        print(f"{k:13s} high: {top}\n{'':13s} low:  {low}")


if __name__ == "__main__":
    main()
