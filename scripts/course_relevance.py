"""
Score how well each real course title fits its subject, using Muse Spark Open on Baseten,
so the "See courses" list shows the right courses (no "Acoustics at a drama school" under Physics).

For every subject with courses, takes up to 40 distinct full-time course titles from the HESA
data (most common first) and asks Spark Open to rate each one:
  3 = a straight course in this subject, 2 = this subject plus something else / a clear specialism,
  1 = loosely related, 0 = doesn't belong here.
It also flags foundation-year and "with placement/abroad" variants.

Writes data/course_relevance.json: {code: {course title: {"score": 0-3, "variant": bool}}}.
build_course_lists.py can then keep score >= 2, drop variants, and order by score.

Run from the repo root (needs BASETEN_API_KEY in .env):
  python scripts/course_relevance.py            # all subjects, resumes if interrupted
  python scripts/course_relevance.py --limit 5  # try a few first
Raw replies are cached in data/processed/course_relevance_raw.jsonl.
"""
import json
import os
import random
import re
import sqlite3
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "processed" / "inkling.db"
CARDS = ROOT / "data" / "subject_cards.json"
CACHE = ROOT / "data" / "processed" / "course_relevance_raw.jsonl"
OUT = ROOT / "data" / "course_relevance.json"
MAX_TITLES = 40

load_dotenv(ROOT / ".env")
MODEL = os.environ.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026")
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key=os.environ["BASETEN_API_KEY"])


def candidates():
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    out = {}
    for c in json.loads(CARDS.read_text())["cards"]:
        titles = [t for (t,) in con.execute("""
            SELECT c.title FROM courses c JOIN course_subjects cs ON cs.course_id = c.id
            WHERE cs.cah_code = ? AND c.mode = 'Full-time' AND c.url IS NOT NULL AND c.url != ''
            GROUP BY c.title ORDER BY COUNT(*) DESC LIMIT ?""", (c["code"], MAX_TITLES))]
        if titles:
            out[c["code"]] = {"card": c, "titles": titles}
    return out


def prompt_for(card, titles):
    listing = "\n".join(f"{i}. {t}" for i, t in enumerate(titles))
    return f"""We show 16-18 year olds a list of real UK degree courses for the subject "{card['display_name']}" ({card['plain']}).
Rate how well each course title below belongs in that list:
3 = a straight course in this subject
2 = this subject combined with something else, or a clear specialism of it
1 = only loosely related
0 = does not belong under this subject
Also mark "variant": true if the title is a foundation-year, "with placement", "with year abroad", "integrated master's" or similar version of a course.

Courses:
{listing}

Return only JSON: {{"<number>": {{"score": 0-3, "variant": true|false}}, ...}} for every number above."""


def rate(code, item):
    card, titles = item["card"], item["titles"]
    messages = [{"role": "user", "content": prompt_for(card, titles)}]
    last = None
    for attempt in range(5):
        try:
            r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.1)
            text = r.choices[0].message.content
            m = re.search(r"\{.*\}", text or "", re.S)
            if not m:
                raise ValueError("no JSON object in reply")
            data = json.loads(m.group(0))
            missing = [str(i) for i in range(len(titles)) if str(i) not in data]
            if not missing:
                return {titles[int(k)]: {"score": max(0, min(3, int(v.get("score", 0)))),
                                         "variant": bool(v.get("variant", False))}
                        for k, v in data.items() if k.isdigit() and int(k) < len(titles)}
            last = f"missing numbers {missing[:15]}"
            messages += [{"role": "assistant", "content": text},
                         {"role": "user", "content": f"You missed some. Return the full JSON again including: {last}"}]
        except Exception as e:  # rate limits, timeouts, bad JSON
            last = str(e)
            time.sleep(min(30, 2 ** attempt + random.random()))
    raise RuntimeError(f"{code}: {last}")


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    items = candidates()
    done = {}
    if CACHE.exists():
        for line in CACHE.read_text().splitlines():
            done.update(json.loads(line))
    todo = [c for c in items if c not in done]
    todo = todo[:limit] if limit else todo
    print(f"{len(items)} subjects with courses, {len(done)} already done, rating {len(todo)} with {MODEL}")
    failed = []
    with ThreadPoolExecutor(max_workers=6) as pool, open(CACHE, "a") as cache:
        futures = {pool.submit(rate, c, items[c]): c for c in todo}
        for i, f in enumerate(as_completed(futures), 1):
            code = futures[f]
            try:
                res = f.result()
                cache.write(json.dumps({code: res}, ensure_ascii=False) + "\n")
                cache.flush()
                done[code] = res
                keep = sum(1 for v in res.values() if v["score"] >= 2 and not v["variant"])
                print(f"[{i}/{len(todo)}] {items[code]['card']['display_name']}: {keep}/{len(res)} titles kept")
            except Exception as e:
                failed.append(code)
                print(f"[{i}/{len(todo)}] FAILED {e}")

    OUT.write_text(json.dumps({
        "about": f"Course-title relevance scored by Muse Spark Open ({MODEL}) on Baseten over HESA Discover Uni "
                 "course titles (CC BY 4.0). 3 = straight course, 2 = combined/specialism, 1 = loose, 0 = drop.",
        "subjects": {c: done[c] for c in items if c in done}}, indent=1, ensure_ascii=False))
    thin = [items[c]["card"]["display_name"] for c in items if c in done
            and sum(1 for v in done[c].values() if v["score"] >= 2 and not v["variant"]) < 3]
    print(f"\nWrote {OUT.relative_to(ROOT)} for {len(done)} subjects. {len(failed)} failed.")
    if thin:
        print(f"{len(thin)} subjects have fewer than 3 good titles (fall back to score 1 there): {', '.join(thin[:12])}")
    if failed:
        print("Re-run to retry the failed ones.")


if __name__ == "__main__":
    main()
