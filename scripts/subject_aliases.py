"""
Teach the "Something else?" box what teenagers actually type, using Muse Spark Open on Baseten.

Writes data/subject_aliases.json with:
  aliases:  {code: [lowercase ways someone might type that degree subject]}
  school:   {school/college subject name: {code: weight}}   (A-level, BTEC, T-level, Highers, IB...)
  index:    {alias or school subject (lowercase): {code: weight}}   <- what the browser looks up

Run from the repo root (needs BASETEN_API_KEY in .env):
  python scripts/subject_aliases.py            # all subjects, resumes if interrupted
  python scripts/subject_aliases.py --limit 2  # try two batches first
Raw replies are cached in data/processed/subject_aliases_raw.jsonl.
"""
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
CARDS = ROOT / "data" / "subject_cards.json"
CACHE = ROOT / "data" / "processed" / "subject_aliases_raw.jsonl"
OUT = ROOT / "data" / "subject_aliases.json"
BATCH = 10

load_dotenv(ROOT / ".env")
MODEL = os.environ.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026")
client = OpenAI(base_url="https://inference.baseten.co/v1", api_key=os.environ["BASETEN_API_KEY"])


def ask(prompt, check):
    """Call Spark Open, parse the JSON object in the reply, retry with feedback on problems."""
    messages = [{"role": "user", "content": prompt}]
    last = None
    for attempt in range(5):
        try:
            r = client.chat.completions.create(model=MODEL, messages=messages, temperature=0.3)
            text = r.choices[0].message.content
            m = re.search(r"\{.*\}", text or "", re.S)
            if not m:
                raise ValueError("no JSON object in reply")
            data = json.loads(m.group(0))
            problems = check(data)
            if not problems:
                return data
            last = "; ".join(problems)
            messages += [{"role": "assistant", "content": text},
                         {"role": "user", "content": f"Fix these problems and return the full JSON again: {last}"}]
        except Exception as e:  # rate limits, timeouts, bad JSON
            last = str(e)
            time.sleep(min(30, 2 ** attempt + random.random()))
    raise RuntimeError(last)


def alias_prompt(batch):
    lines = "\n".join(f"{c['code']} | {c['display_name']} | {c['plain']}" for c in batch)
    return f"""You help Inkling, a game for 16-18 year olds in the UK choosing a degree subject. Players can type a subject in a free-text box, and we need to recognise what they mean.

For each degree subject below, list 12 to 20 lowercase strings a UK teenager might type when they mean that subject:
- short names and slang ("psych", "comp sci", "pe")
- other common names for the same subject, including US/older names
- specialisms that clearly belong to it ("forensic psychology" for psychology only if it fits)
- 2 or 3 common misspellings
Do NOT include hobbies, jobs, or words that would also clearly mean a different subject in the list. Keep each string under 30 characters.

Subjects (code | name | what you study):
{lines}

Return only JSON: {{"<code>": ["alias", ...], ...}} with every code above."""


def check_aliases(batch):
    codes = {c["code"] for c in batch}

    def check(data):
        problems = [f"missing {c}" for c in codes if c not in data]
        for c, v in data.items():
            if c in codes and (not isinstance(v, list) or len(v) < 8):
                problems.append(f"{c} needs at least 8 aliases")
        return problems
    return check


def school_prompt(cards):
    catalogue = "\n".join(f"{c['code']} {c['display_name']}" for c in cards)
    return f"""List the subjects UK 16-18 year olds commonly study at school or college: A-levels, BTEC/Cambridge Technicals, T-levels, Scottish Highers/Advanced Highers and IB subjects. Include around 70, using the names students would type (e.g. "further maths", "btec sport", "media studies", "health and social care", "product design", "computer science", "religious studies", "photography", "travel and tourism").

For each, give 1 to 4 degree subjects it most naturally leads into, chosen ONLY from the list below, with a weight from 0.2 (loose link) to 1.0 (direct match).

Degree subjects:
{catalogue}

Return only JSON: {{"<school subject, lowercase>": {{"<code>": weight, ...}}, ...}}"""


def check_school(valid):
    def check(data):
        if len(data) < 40:
            return ["need at least 40 school subjects"]
        bad = [f"{k}: {c}" for k, v in data.items() if isinstance(v, dict) for c in v if c not in valid]
        return [f"unknown codes {bad[:10]}"] if bad else []
    return check


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9&+ ]", " ", s.lower())).strip()


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    cards = json.loads(CARDS.read_text())["cards"]
    valid = {c["code"] for c in cards}
    done = {}
    if CACHE.exists():
        for line in CACHE.read_text().splitlines():
            done.update(json.loads(line))
    todo = [c for c in cards if c["code"] not in done and c["code"] != "_school"]
    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)][:limit] if limit else \
        [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    need_school = "_school" not in done
    print(f"{len(cards)} subjects, {len(done) - (0 if need_school else 1)} already done, "
          f"{len(batches)} batches to write{' + school subjects' if need_school else ''} with {MODEL}")

    failed = []
    with ThreadPoolExecutor(max_workers=6) as pool, open(CACHE, "a") as cache:
        futures = {pool.submit(ask, alias_prompt(b), check_aliases(b)): [c["code"] for c in b] for b in batches}
        if need_school:
            futures[pool.submit(ask, school_prompt(cards), check_school(valid))] = ["_school"]
        for f in as_completed(futures):
            codes = futures[f]
            try:
                data = f.result()
                rec = {"_school": data} if codes == ["_school"] else {c: data[c] for c in codes if c in data}
                cache.write(json.dumps(rec, ensure_ascii=False) + "\n")
                cache.flush()
                done.update(rec)
                print("done:", "school subjects" if codes == ["_school"] else ", ".join(codes))
            except Exception as e:
                failed.append(codes)
                print("FAILED:", codes, e)

    aliases = {c["code"]: sorted({norm(a) for a in done.get(c["code"], []) if norm(a)}) for c in cards}
    school = {norm(k): {c: round(float(w), 2) for c, w in v.items() if c in valid}
              for k, v in done.get("_school", {}).items()}
    index = {}
    for c in cards:  # the subject's own names always win
        for name in {norm(c["display_name"]), norm(c["name"])}:
            index.setdefault(name, {})[c["code"]] = 1.0
    for code, al in aliases.items():
        for a in al:
            index.setdefault(a, {}).setdefault(code, 0.8)
    for k, v in school.items():
        for code, w in v.items():
            index.setdefault(k, {}).setdefault(code, w)

    OUT.write_text(json.dumps({
        "about": f"Aliases and school-subject links written by Muse Spark Open ({MODEL}) on Baseten. "
                 "index maps lowercase typed text to {subject code: weight}. Review before use.",
        "aliases": aliases, "school": school, "index": dict(sorted(index.items()))}, indent=1, ensure_ascii=False))

    shared = {k: v for k, v in index.items() if len(v) > 2}
    print(f"\nWrote {OUT.relative_to(ROOT)}: {sum(map(len, aliases.values()))} aliases, "
          f"{len(school)} school subjects, {len(index)} lookup entries. {len(failed)} batches failed.")
    if shared:
        print(f"{len(shared)} entries point to 3+ subjects (fine if broad, worth a look), e.g.:")
        for k in list(shared)[:10]:
            print(f"  {k}: {', '.join(shared[k])}")
    if failed:
        print("Re-run to retry the failed batches.")


if __name__ == "__main__":
    main()
