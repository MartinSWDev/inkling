"""
Tag every UK teaching location (campus) as city / coast / campus town / countryside, using
Muse Spark Open on Baseten, so "See courses" can put courses in the player's chosen setting first.

Input: the 695 locations in data/processed/inkling.db (provider name, campus name, latitude/longitude
from HESA Discover Uni). Spark Open is asked for the setting and the nearest town for each, in
batches of 15, with the coordinates as grounding.

Writes data/campus_settings.json:
  locations: {location id "UKPRN:LOCID": {"setting", "town", "confidence"}}
  providers: {UKPRN: setting most of its locations have}

Run from the repo root (needs BASETEN_API_KEY in .env):
  python scripts/campus_settings.py            # all, resumes if interrupted
  python scripts/campus_settings.py --limit 2  # try two batches first
Raw replies are cached in data/processed/campus_settings_raw.jsonl.
"""
import json
import os
import random
import re
import sqlite3
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "inkling.db"
CACHE = ROOT / "data" / "processed" / "campus_settings_raw.jsonl"
OUT = ROOT / "data" / "campus_settings.json"
SETTINGS = {"city", "coast", "campus town", "countryside"}
BATCH = 15

load_dotenv(ROOT / ".env")
MODEL = os.environ.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026")
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key=os.environ["BASETEN_API_KEY"])


def locations():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    return [dict(id=i, ukprn=u, provider=p, name=n, lat=la, lon=lo) for i, u, p, n, la, lo in con.execute("""
        SELECT l.id, l.ukprn, COALESCE(p.name, ''), COALESCE(l.name, ''), l.latitude, l.longitude
        FROM locations l LEFT JOIN providers p ON p.ukprn = l.ukprn ORDER BY l.ukprn, l.locid""")]


def prompt_for(batch):
    rows = "\n".join(
        f'{i}. {b["provider"]} | {b["name"]} | '
        + (f'{b["lat"]:.4f}, {b["lon"]:.4f}' if b["lat"] is not None and b["lon"] is not None else "no coordinates")
        for i, b in enumerate(batch))
    return f"""We help 16-18 year olds choose where in the UK they might like to study. For each teaching location below (provider | campus name | latitude, longitude), decide its setting:
- "city": in or right next to a large city centre (e.g. London, Manchester, Birmingham, Glasgow, Leeds, Cardiff)
- "coast": in a town or city on the sea, or a campus within a few miles of the coast (e.g. Brighton, Plymouth, Aberystwyth, Swansea, Falmouth)
- "campus town": a smaller town, or a self-contained campus on the edge of a town (e.g. Durham, Bath, Canterbury, Loughborough, Lancaster)
- "countryside": rural, in a village or countryside setting (e.g. agricultural colleges, Harper Adams)
If a place is a city AND on the coast (e.g. Brighton, Aberdeen, Swansea), choose "coast". Use the coordinates to judge.
Also give the nearest town or city name, and your confidence: "high", "medium" or "low".

Locations:
{rows}

Return only JSON: {{"<number>": {{"setting": "...", "town": "...", "confidence": "..."}}, ...}} for every number above."""


def classify(batch):
    messages = [{"role": "user", "content": prompt_for(batch)}]
    last = None
    for attempt in range(5):
        try:
            r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.1)
            text = r.choices[0].message.content
            m = re.search(r"\{.*\}", text or "", re.S)
            if not m:
                raise ValueError("no JSON object in reply")
            data = json.loads(m.group(0))
            problems = [f"missing {i}" for i in range(len(batch)) if str(i) not in data]
            problems += [f"{k}: bad setting {v.get('setting')}" for k, v in data.items()
                         if isinstance(v, dict) and v.get("setting") not in SETTINGS]
            if not problems:
                return {batch[int(k)]["id"]: {"setting": v["setting"], "town": v.get("town", ""),
                                              "confidence": v.get("confidence", "medium")}
                        for k, v in data.items() if k.isdigit() and int(k) < len(batch)}
            last = "; ".join(problems[:10])
            messages += [{"role": "assistant", "content": text},
                         {"role": "user", "content": f"Fix these and return the full JSON again: {last}. "
                                                     f"setting must be one of {sorted(SETTINGS)}."}]
        except Exception as e:  # rate limits, timeouts, bad JSON
            last = str(e)
            time.sleep(min(30, 2 ** attempt + random.random()))
    raise RuntimeError(last)


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    locs = locations()
    done = {}
    if CACHE.exists():
        for line in CACHE.read_text().splitlines():
            done.update(json.loads(line))
    todo = [l for l in locs if l["id"] not in done]
    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    batches = batches[:limit] if limit else batches
    print(f"{len(locs)} locations, {len(done)} already done, {len(batches)} batches to classify with {MODEL}")
    failed = 0
    with ThreadPoolExecutor(max_workers=6) as pool, open(CACHE, "a") as cache:
        futures = {pool.submit(classify, b): b for b in batches}
        for i, f in enumerate(as_completed(futures), 1):
            try:
                res = f.result()
                cache.write(json.dumps(res, ensure_ascii=False) + "\n")
                cache.flush()
                done.update(res)
                print(f"[{i}/{len(batches)}] " + ", ".join(f"{futures[f][j]['name'][:28]}: {v['setting']}"
                                                         for j, v in enumerate(list(res.values())[:3])) + " …")
            except Exception as e:
                failed += 1
                print(f"[{i}/{len(batches)}] FAILED {e}")

    by_provider = {}
    for l in locs:
        if l["id"] in done:
            by_provider.setdefault(l["ukprn"], []).append(done[l["id"]]["setting"])
    providers = {u: Counter(s).most_common(1)[0][0] for u, s in by_provider.items()}
    OUT.write_text(json.dumps({
        "about": f"Campus settings (city / coast / campus town / countryside) classified by Muse Spark Open ({MODEL}) "
                 "on Baseten from HESA Discover Uni location names and coordinates (CC BY 4.0). Review before use.",
        "locations": {l["id"]: done[l["id"]] for l in locs if l["id"] in done},
        "providers": providers}, indent=1, ensure_ascii=False))

    counts = Counter(v["setting"] for v in done.values())
    low = sum(1 for v in done.values() if v.get("confidence") == "low")
    print(f"\nWrote {OUT.relative_to(ROOT)}: {len(done)} locations, {len(providers)} providers. "
          f"{dict(counts)}. {low} low-confidence. {failed} batches failed.")
    if failed:
        print("Re-run to retry the failed batches.")


if __name__ == "__main__":
    main()
