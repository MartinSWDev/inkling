"""
"Rather earn while you learn?" — link each degree subject to real apprenticeships, using Muse Spark Open on Baseten.

Source: the official apprenticeship standards data (Skills England, published by the Skills Funding Agency at
github.com/SkillsFundingAgency/das-standards-data, Open Government Licence v3.0). Only standards that are
"Approved for delivery" (open for starts) are used, latest version of each.

Steps:
 1. Build data/apprenticeships.json: every live standard (ref, title, level, route, duration in months,
    typical job titles, one-line overview, official page URL, whether a degree is included).
 2. For each of the 163 subjects, Spark Open picks up to 6 closely related apprenticeships from the list
    (preferring levels 4-7, the higher and degree apprenticeships, plus at most 2 hands-on level 2-3 routes
    where they are a natural fit) and writes a short reason for each. Only real reference numbers are kept.
    Writes data/subject_apprenticeships.json.

First get the data (once):
  git clone --depth 1 https://github.com/SkillsFundingAgency/das-standards-data data/raw/das-standards-data
Then run from the repo root (needs BASETEN_API_KEY in .env):
  python scripts/apprenticeship_links.py --limit 5   # try a few
  python scripts/apprenticeship_links.py             # all, resumes if interrupted
"""
import glob
import json
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "raw" / "das-standards-data"
CARDS = ROOT / "data" / "subject_cards.json"
APPS = ROOT / "data" / "apprenticeships.json"
CACHE = ROOT / "data" / "processed" / "subject_apprenticeships_raw.jsonl"
OUT = ROOT / "data" / "subject_apprenticeships.json"
ATTRIBUTION = ("Contains public sector information licensed under the Open Government Licence v3.0. "
               "Apprenticeship standards © Skills England.")

load_dotenv(ROOT / ".env")
MODEL = os.environ.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026")


def ver(d):
    try:
        return float(str(d.get("version") or d.get("versionNumber") or 0))
    except ValueError:
        return 0.0


def build_apprenticeships():
    if not SRC.exists():
        sys.exit(f"{SRC} not found. Run:\n  git clone --depth 1 https://github.com/SkillsFundingAgency/das-standards-data {SRC}")
    latest = {}
    for p in glob.glob(str(SRC / "*.json")):
        try:
            d = json.loads(Path(p).read_text())
        except Exception:
            continue
        ref = d.get("referenceNumber")
        if ref and (ref not in latest or ver(d) > ver(latest[ref])):
            latest[ref] = d
    live = []
    for ref, d in sorted(latest.items()):
        if d.get("status") != "Approved for delivery" or d.get("approvedForDeliveryPausedStarts"):
            continue
        titles = [t for t in (d.get("typicalJobTitles") or []) if isinstance(t, str) and len(t) < 60][:5]
        overview = re.sub(r"\s+", " ", (d.get("overviewOfRole") or "")).strip()
        live.append({
            "ref": ref, "title": d.get("title", "").strip(), "level": d.get("level"),
            "route": d.get("route", ""), "months": d.get("typicalDuration"),
            "job_titles": titles, "overview": overview[:220],
            "degree": (d.get("integratedDegree") or "") in ("integrated degree", "non-integrated degree"),
            "url": d.get("standardPageUrl") or d.get("url") or "",
        })
    APPS.write_text(json.dumps({"about": "Apprenticeship standards approved for delivery. " + ATTRIBUTION,
                                "count": len(live), "apprenticeships": live}, indent=1, ensure_ascii=False))
    print(f"Wrote {APPS.relative_to(ROOT)}: {len(live)} live apprenticeships")
    return live


def prompt_for(card, catalogue):
    return f"""Inkling helps 16-18 year olds in England choose what to study. For the degree subject below, we also want to show real apprenticeships that lead into similar work, for students who would rather earn while they learn.

Subject: {card['display_name']} — {card['plain']}

From the list of apprenticeships below (ref | level | title | typical job titles), choose up to 6 that are a genuinely close fit for someone interested in this subject:
- prefer level 4-7 (higher and degree apprenticeships), which are real alternatives to a degree
- include at most 2 hands-on level 2-3 apprenticeships, only if they are a natural fit
- choose fewer (even 0) rather than stretch; never pick something only loosely related
For each, write a reason of max 12 words a teenager would understand.

Apprenticeships:
{catalogue}

Return only JSON: {{"picks": [{{"ref": "ST0000", "reason": "..."}}, ...]}}"""


def pick(client, card, catalogue, valid):
    messages = [{"role": "user", "content": prompt_for(card, catalogue)}]
    last = None
    for attempt in range(5):
        try:
            r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.2)
            text = r.choices[0].message.content
            m = re.search(r"\{.*\}", text or "", re.S)
            if not m:
                raise ValueError("no JSON object in reply")
            picks = json.loads(m.group(0)).get("picks", [])
            bad = [p.get("ref") for p in picks if p.get("ref") not in valid]
            if not bad:
                seen, out = set(), []
                for p in picks:
                    if p["ref"] not in seen:
                        seen.add(p["ref"])
                        out.append({"ref": p["ref"], "reason": str(p.get("reason", ""))[:120]})
                return out[:6]
            last = f"these refs are not in the list: {bad}"
            messages += [{"role": "assistant", "content": text},
                         {"role": "user", "content": f"Fix: {last}. Only use refs from the list. Return the full JSON again."}]
        except Exception as e:  # rate limits, timeouts, bad JSON
            last = str(e)
            time.sleep(min(30, 2 ** attempt + random.random()))
    raise RuntimeError(f"{card['code']}: {last}")


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    live = build_apprenticeships()
    valid = {a["ref"]: a for a in live}
    catalogue = "\n".join(f"{a['ref']} | L{a['level']} | {a['title']} | {', '.join(a['job_titles'][:3])}" for a in live)
    cards = json.loads(CARDS.read_text())["cards"]
    client = OpenAI(base_url="https://inference.baseten.co/v1", api_key=os.environ["BASETEN_API_KEY"])
    done = {}
    if CACHE.exists():
        for line in CACHE.read_text().splitlines():
            done.update(json.loads(line))
    todo = [c for c in cards if c["code"] not in done]
    todo = todo[:limit] if limit else todo
    print(f"{len(cards)} subjects, {len(done)} already done, linking {len(todo)} with {MODEL}")
    failed = []
    with ThreadPoolExecutor(max_workers=6) as pool, open(CACHE, "a") as cache:
        futures = {pool.submit(pick, client, c, catalogue, valid): c for c in todo}
        for i, f in enumerate(as_completed(futures), 1):
            c = futures[f]
            try:
                res = f.result()
                cache.write(json.dumps({c["code"]: res}, ensure_ascii=False) + "\n")
                cache.flush()
                done[c["code"]] = res
                names = ", ".join(f"{valid[p['ref']]['title']} (L{valid[p['ref']]['level']})" for p in res[:3])
                print(f"[{i}/{len(todo)}] {c['display_name']}: {len(res)} — {names}")
            except Exception as e:
                failed.append(c["code"])
                print(f"[{i}/{len(todo)}] FAILED {e}")

    subjects = {}
    for c in cards:
        if c["code"] in done:
            subjects[c["code"]] = [{**{k: valid[p["ref"]][k] for k in ("ref", "title", "level", "months", "degree", "url")},
                                    "reason": p["reason"]} for p in done[c["code"]] if p["ref"] in valid]
    OUT.write_text(json.dumps({
        "about": f"Apprenticeships linked to each subject by Muse Spark Open ({MODEL}) on Baseten. {ATTRIBUTION}",
        "subjects": subjects}, indent=1, ensure_ascii=False))
    empty = [c["display_name"] for c in cards if c["code"] in subjects and not subjects[c["code"]]]
    print(f"\nWrote {OUT.relative_to(ROOT)} for {len(subjects)} subjects. {len(failed)} failed.")
    if empty:
        print(f"{len(empty)} subjects have no close apprenticeship (that's fine): {', '.join(empty[:15])}")
    if failed:
        print("Re-run to retry the failed ones.")


if __name__ == "__main__":
    main()
