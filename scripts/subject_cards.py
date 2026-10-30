"""
Write a "subject card" for every HESA subject that has courses, using Muse Spark Open
on Baseten (open-weights model). The game and the reveal run on these cards.

Each card:
  display_name  plain name, e.g. "Marine biology"
  plain         what it is, one sentence a 16-year-old understands
  why_line      why you might like it (no promises about jobs or pay)
  object        the thing it puts in the room (visual, no text, no brands, no people)
  slot          where it goes: shelf | desk | wall | floor | bed
  sam_labels    2-3 plain nouns, specific to general, for SAM 3.1 to find the object
  neighbours    3-5 related subject codes (for the surprise pick)
  keywords      3-6 search words

Context given per subject (from inkling.db): parent area, top graduate job groups,
example course titles, number of courses.

Run from the repo root (needs BASETEN_API_KEY in .env):
  python scripts/subject_cards.py            # all subjects, resumes if interrupted
  python scripts/subject_cards.py --limit 5  # try a few first
Output: data/subject_cards.json (commit it). Raw replies cached in data/processed/.
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
SUBJECTS = ROOT / "data" / "subjects.json"
CACHE = ROOT / "data" / "processed" / "subject_cards_raw.jsonl"
OUT = ROOT / "data" / "subject_cards.json"
SLOTS = {"shelf", "desk", "wall", "floor", "bed"}

load_dotenv(ROOT / ".env")
MODEL = os.environ.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026")
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key=os.environ["BASETEN_API_KEY"])


def load_subjects():
    subs = [s for s in json.loads(SUBJECTS.read_text())["subjects"] if s["level"] == 3 and s["course_count"] > 0]
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    for s in subs:
        s["jobs"] = [j for (j,) in con.execute("""
            SELECT j.job FROM course_jobs j JOIN course_subjects cs ON cs.course_id = j.course_id
            WHERE cs.cah_code = ? GROUP BY j.job ORDER BY SUM(j.percent) DESC LIMIT 4""", (s["code"],))]
        s["examples"] = [t for (t,) in con.execute("""
            SELECT c.title FROM courses c JOIN course_subjects cs ON cs.course_id = c.id
            WHERE cs.cah_code = ? AND c.mode = 'Full-time' GROUP BY c.title ORDER BY COUNT(*) DESC LIMIT 5""", (s["code"],))]
    return subs


def prompt_for(s, catalogue):
    return f"""You write content for Inkling, a game that helps 16-18 year olds in the UK discover degree subjects.
Each subject appears as an object in the player's student bedroom, drawn as an illustration.

Subject: {s['name']} (code {s['code']})
Broader area: {s['parent_name']}
Number of UK degree courses: {s['course_count']}
Example course titles: {'; '.join(s['examples']) or 'none'}
Most common graduate job groups: {'; '.join(s['jobs']) or 'unknown'}

Write one JSON object with exactly these keys:
- "display_name": the subject's plain name in sentence case (e.g. "Marine biology").
- "plain": one sentence, max 20 words, saying what you actually study. Plain English, no jargon.
- "why_line": max 14 words, second person, about what someone who'd enjoy it is like. No promises about jobs, pay or success. Do not use the word "love". Do not start with "You love" or "You enjoy"; vary the opening (e.g. "Good if you...", "For people who...", "If you've ever wondered...").
- "object": one physical object a student of this subject might keep in their room, max 10 words. It must be easy to recognise in a small drawing, distinct from objects for other subjects, and contain no text, logos, brands, screens with writing, or people. Avoid generic objects (a book, a laptop, a notebook) unless nothing else fits. Avoid pills, syringes, weapons, alcohol, cigarettes or anything that could look unsafe in a teenager's room. Prefer everyday kit, tools, specimens, plants, instruments or posters over "a model of X on a stand".
- "slot": where it sits in the room, one of: shelf, desk, wall, floor, bed. Spread these out: wall for posters, maps, charts and hanging things; floor for anything large; bed for soft or wearable things; shelf for small objects and specimens; desk only for tools used while working.
- "sam_labels": 2 or 3 short plain nouns an image detector could use to find that object, most specific first (e.g. ["fish tank", "aquarium", "glass tank"]).
- "neighbours": 3 to 5 codes of closely related subjects, chosen ONLY from the list below, not including {s['code']}.
- "keywords": 3 to 6 lowercase search words a teenager might type.

Return only the JSON object, no other text.

Subjects you may use as neighbours:
{catalogue}"""


def parse(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        raise ValueError("no JSON object in reply")
    return json.loads(m.group(0))


def validate(card, s, valid_codes):
    problems = []
    for k in ("display_name", "plain", "why_line", "object", "slot", "sam_labels", "neighbours", "keywords"):
        if k not in card:
            problems.append(f"missing {k}")
    if problems:
        return problems
    if card["slot"] not in SLOTS:
        problems.append(f"bad slot {card['slot']}")
    if not (2 <= len(card["sam_labels"]) <= 3):
        problems.append("sam_labels must have 2-3 items")
    card["neighbours"] = [c for c in card["neighbours"] if c in valid_codes and c != s["code"]]
    if len(card["neighbours"]) < 2:
        problems.append("fewer than 2 valid neighbours")
    if len(card["object"].split()) > 14:
        problems.append("object too long")
    return problems


def make_card(s, catalogue, valid_codes):
    messages = [{"role": "user", "content": prompt_for(s, catalogue)}]
    last = None
    for attempt in range(5):
        try:
            r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.4)
            text = r.choices[0].message.content
            card = parse(text)
            problems = validate(card, s, valid_codes)
            if not problems:
                card.update({"code": s["code"], "name": s["name"], "parent": s["parent_name"]})
                return card
            last = "; ".join(problems)
            messages += [{"role": "assistant", "content": text},
                         {"role": "user", "content": f"Fix these problems and return the full JSON again: {last}"}]
        except Exception as e:  # rate limits, timeouts, bad JSON
            last = str(e)
            time.sleep(min(30, 2 ** attempt + random.random()))
    raise RuntimeError(f"{s['code']} {s['name']}: {last}")


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    subs = load_subjects()
    valid = {s["code"] for s in subs}
    catalogue = "\n".join(f"{s['code']} {s['name']}" for s in subs)
    done = {}
    if CACHE.exists():
        for line in CACHE.read_text().splitlines():
            c = json.loads(line)
            done[c["code"]] = c
    todo = [s for s in subs if s["code"] not in done][:limit] if limit else [s for s in subs if s["code"] not in done]
    print(f"{len(subs)} subjects, {len(done)} already done, writing {len(todo)} with {MODEL}")
    failed = []
    with ThreadPoolExecutor(max_workers=6) as pool, open(CACHE, "a") as cache:
        futures = {pool.submit(make_card, s, catalogue, valid): s for s in todo}
        for i, f in enumerate(as_completed(futures), 1):
            s = futures[f]
            try:
                card = f.result()
                cache.write(json.dumps(card, ensure_ascii=False) + "\n")
                cache.flush()
                done[card["code"]] = card
                print(f"[{i}/{len(todo)}] {card['display_name']}: {card['object']} ({card['slot']})")
            except Exception as e:
                failed.append(str(e))
                print(f"[{i}/{len(todo)}] FAILED {e}")

    cards = [done[s["code"]] for s in subs if s["code"] in done]
    OUT.write_text(json.dumps({
        "about": f"Subject cards generated by Muse Spark Open ({MODEL}) on Baseten from HESA Discover Uni "
                 "context (subject names, example course titles, graduate job groups). Review before use.",
        "count": len(cards), "cards": cards}, indent=1, ensure_ascii=False))

    # Review aids: repeated objects make rooms ambiguous and confuse SAM.
    seen = {}
    for c in cards:
        seen.setdefault(c["object"].lower().strip(" ."), []).append(c["display_name"])
    dupes = {o: n for o, n in seen.items() if len(n) > 1}
    print(f"\nWrote {OUT.relative_to(ROOT)}: {len(cards)} cards, {len(failed)} failed.")
    if dupes:
        print("Same object used for several subjects (worth editing):")
        for o, n in dupes.items():
            print(f"  {o}: {', '.join(n)}")
    if failed:
        print("Re-run to retry the failed ones.")


if __name__ == "__main__":
    main()
