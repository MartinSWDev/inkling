"""
Simulated students: test Inkling's scoring with 200 personas played by Muse Spark Open (Baseten).

1. personas  — Spark Open writes 200 varied UK 16-18 year olds (10 batches of 20, each batch seeded with
   different subject areas so all 163 subjects get coverage, ~20% "no idea yet"). Each has school subjects,
   what they enjoy, and 1-3 degree subjects they'd genuinely suit (the ground truth, from our real list).
2. play      — each persona answers the whole game in character: subject chips (+ hearts), all 18 "things"
   cards, the 5 this-or-that pairs and all 16 big questions. Answers are validated against the real decks.
3. score     — runs the real scoring code (api/scoring.py) on every persona and measures:
   hit@3 / hit@5 (a ground-truth subject in the top 3 / top 5), family hit@3 (same CAH subject group),
   and how many answers the fixed order needs before the top 3 settles on a ground-truth subject.
   Full answer sets are saved, so any card order (e.g. an adaptive one) can be re-scored later offline, free.
Each student also gets a paper type (graph paper, blueprint, manuscript…) from their subjects, for the visuals.

Run from the repo root (needs BASETEN_API_KEY in .env):
  python scripts/simulate_students.py --limit 20     # 20 students end to end
  python scripts/simulate_students.py                # all 200, resumes if interrupted
  python scripts/simulate_students.py --score-only   # re-score saved answers (no API calls)
Outputs: data/sim/students.json (personas + answers), data/sim/results.json (per student + summary).
"""
import json
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.scoring import CHIPS, EXTRA_NAMES, QUESTIONS, THINGS, score_answers  # noqa: E402

SIM = ROOT / "data" / "sim"
PERSONA_CACHE = ROOT / "data" / "processed" / "sim_personas_raw.jsonl"
ANSWER_CACHE = ROOT / "data" / "processed" / "sim_answers_raw.jsonl"
N_STUDENTS, BATCH = 200, 20

PAPER_BY_AREA = {  # CAH level-1 (or level-2) prefix -> paper type for the scrunched-paper characters
    "CAH09": "graph", "CAH07-01": "graph", "CAH07-04": "graph", "CAH10": "graph", "CAH15-02": "graph",
    "CAH25-02": "manuscript", "CAH13": "blueprint", "CAH20": "parchment", "CAH26": "map",
    "CAH25-01": "watercolour", "CAH01": "lab", "CAH02": "lab", "CAH03": "lab", "CAH04": "lab", "CAH07-02": "lab",
    "CAH16": "legal", "CAH15": "legal", "CAH17": "legal", "CAH11": "printout", "CAH05": "kraft", "CAH06": "kraft",
}


def paper_for(code):
    for k in sorted(PAPER_BY_AREA, key=len, reverse=True):
        if code.startswith(k):
            return PAPER_BY_AREA[k]
    return "lined"


def client():
    from dotenv import load_dotenv
    from openai import OpenAI
    load_dotenv(ROOT / ".env")
    return OpenAI(base_url="https://inference.baseten.co/v1", api_key=os.environ["BASETEN_API_KEY"])


MODEL = os.environ.get("BASETEN_MODEL", "meta-models/muse-spark-open-1026")


def ask(cl, prompt, check, temperature=0.7):
    messages = [{"role": "user", "content": prompt}]
    last = None
    for attempt in range(5):
        try:
            r = cl.chat.completions.create(model=MODEL, messages=messages, temperature=temperature)
            text = r.choices[0].message.content
            m = re.search(r"\{.*\}", text or "", re.S)
            if not m:
                raise ValueError("no JSON object in reply")
            data = json.loads(m.group(0))
            problems = check(data)
            if not problems:
                return data
            last = "; ".join(problems[:8])
            messages += [{"role": "assistant", "content": text},
                         {"role": "user", "content": f"Fix these problems and return the full JSON again: {last}"}]
        except Exception as e:  # rate limits, timeouts, bad JSON
            last = str(e)
            time.sleep(min(30, 2 ** attempt + random.random()))
    raise RuntimeError(last)


# ---------- 1. personas ----------
def persona_prompt(batch_no, focus, catalogue):
    return f"""Create {BATCH} realistic, varied students aged 16-18 living across the UK (England, Scotland, Wales, Northern Ireland; cities, towns and rural areas), for testing a game that suggests degree subjects. Mix genders, backgrounds and school types (sixth form, FE college, BTEC, Scottish Highers). About 4 of the {BATCH} should have "no idea yet" what to study.

For this batch, centre most students' interests on these subject areas (but keep them believable people, not stereotypes): {focus}.

For each student give:
- "id": "s{batch_no:02d}-<n>" (n = 1..{BATCH})
- "first_name": a common UK first name
- "age": 16, 17 or 18
- "where": town or region
- "studying": 3-4 school/college subjects they take (e.g. "A-level Biology", "BTEC Sport")
- "enjoys": 2 sentences about what they genuinely like doing in and out of school (hobbies, part-time jobs, curiosities) — concrete, no personality labels
- "certainty": "knows" | "torn" | "no idea"
- "suits": 1 to 3 degree subject codes from the list below that this student would genuinely enjoy (the ground truth)

Degree subjects (code name):
{catalogue}

Return only JSON: {{"students": [ ... {BATCH} students ... ]}}"""


def make_personas(cl, cards, limit):
    codes = {c["code"] for c in cards}
    catalogue = "\n".join(f"{c['code']} {c['display_name']}" for c in cards)
    areas = sorted({c["parent"] for c in cards})
    random.Random(7).shuffle(areas)
    focuses = [", ".join(areas[i::N_STUDENTS // BATCH]) for i in range(N_STUDENTS // BATCH)]
    done = []
    if PERSONA_CACHE.exists():
        for line in PERSONA_CACHE.read_text().splitlines():
            done.extend(json.loads(line))
    need_batches = [b for b in range(N_STUDENTS // BATCH) if not any(s["id"].startswith(f"s{b:02d}-") for s in done)]
    if limit:
        need_batches = need_batches[:max(0, -(-limit // BATCH) - (len(done) // BATCH))]

    def check(data):
        st = data.get("students", [])
        probs = [] if len(st) >= BATCH - 2 else [f"need {BATCH} students, got {len(st)}"]
        for s in st:
            bad = [c for c in s.get("suits", []) if c not in codes]
            if bad or not s.get("suits"):
                probs.append(f"{s.get('id')}: suits must be 1-3 codes from the list (bad: {bad})")
        return probs

    with ThreadPoolExecutor(max_workers=5) as pool, open(PERSONA_CACHE, "a") as cache:
        futs = {pool.submit(ask, cl, persona_prompt(b, focuses[b], catalogue), check, 0.9): b for b in need_batches}
        for f in as_completed(futs):
            b = futs[f]
            try:
                st = f.result()["students"][:BATCH]
                for i, s in enumerate(st, 1):
                    s["id"] = f"s{b:02d}-{i}"
                    s["suits"] = [c for c in s["suits"] if c in codes][:3]
                cache.write(json.dumps(st, ensure_ascii=False) + "\n")
                cache.flush()
                done.extend(st)
                print(f"personas batch {b}: {len(st)} students")
            except Exception as e:
                print(f"personas batch {b} FAILED: {e}")
    return done[:limit] if limit else done


# ---------- 2. play ----------
PAIRS = json.loads((ROOT / "data" / "pairs.json").read_text())["pairs"]


def play_prompt(s):
    chips = ", ".join(f"{c['id']} ({c['name']})" for c in CHIPS)
    things = "\n".join(f"{t['id']}: {t['title']}" for t in THINGS)
    qs = "\n".join(f"{q['id']}: {q['title']}" for q in QUESTIONS)
    pairs = "\n".join(f"{p['id']}: a = {p['a']['label']} ({p['a'].get('caption', '')}) | b = {p['b']['label']} ({p['b'].get('caption', '')})"
                      for p in PAIRS)
    return f"""You are role-playing this student honestly while they play a quick game about what they enjoy:
{json.dumps({k: s.get(k) for k in ('first_name', 'age', 'where', 'studying', 'enjoys', 'certainty')}, ensure_ascii=False)}

Answer every part the way THIS student really would (it's fine to say no to most things; don't just say yes to everything):
1. "chips": which of these school subjects they take, each with state "take" or "love" (love = a favourite): {chips}
   "typed": up to 2 other subjects they take that aren't in that list, chosen from: {", ".join(EXTRA_NAMES)}
2. "things": for each card, "yes" (would get stuck into it) or "no":
{things}
3. "pairs": for each pair, "a", "b", or null if they genuinely can't decide:
{pairs}
4. "questions": for each, "yes" (would want to find out), "no", or "up" (really need to know):
{qs}

Return only JSON: {{"chips": [{{"id": "...", "state": "take|love"}}], "typed": [...], "things": {{"<id>": "yes|no", ...}}, "pairs": {{"<id>": "a|b|null", ...}}, "questions": {{"<id>": "yes|no|up", ...}}}}"""


def check_play(data):
    probs = []
    chip_ids = {c["id"] for c in CHIPS}
    if any(c.get("id") not in chip_ids for c in data.get("chips", [])):
        probs.append("unknown chip id")
    for t in THINGS:
        if data.get("things", {}).get(t["id"]) not in ("yes", "no"):
            probs.append(f"things.{t['id']} must be yes/no")
    for p in PAIRS:
        if data.get("pairs", {}).get(p["id"], "missing") not in ("a", "b", None, "null"):
            probs.append(f"pairs.{p['id']} must be a/b/null")
    for q in QUESTIONS:
        if data.get("questions", {}).get(q["id"]) not in ("yes", "no", "up"):
            probs.append(f"questions.{q['id']} must be yes/no/up")
    return probs


def to_answers(play):
    """Convert a persona's play into the game's answers format, in the game's fixed order."""
    steps = []
    for c in play.get("chips", []):
        steps.append(("chips", {"id": c["id"], "state": c.get("state", "take")}))
    for n in play.get("typed", [])[:2]:
        if n in EXTRA_NAMES:
            steps.append(("typed", n))
    for t in THINGS:
        steps.append(("swipes", {"card_id": t["id"], "answer": play["things"][t["id"]]}))
    for p in PAIRS:
        side = play["pairs"].get(p["id"])
        steps.append(("pairs", {"pair_id": p["id"], "side": side if side in ("a", "b") else None}))
    for q in QUESTIONS:
        steps.append(("swipes", {"card_id": q["id"], "answer": play["questions"][q["id"]]}))
    return steps


def answers_from(steps):
    a = {"chips": [], "typed": [], "swipes": [], "pairs": []}
    for kind, v in steps:
        a[kind].append(v)
    return a


# ---------- 3. score ----------
def evaluate(students, cards, profiles, pairs_data):
    rows = []
    for s in students:
        if "steps" not in s:
            continue
        steps = [tuple(x) for x in s["steps"]]
        res = score_answers(answers_from(steps), cards, profiles, pairs_data)
        top = [r["code"] for r in res["ranked"]]
        truth = set(s["suits"])
        fam = {c[:8] for c in truth}
        settled = None  # first step after which a ground-truth subject is in the top 3 and stays there
        for i in range(1, len(steps) + 1):
            t3 = [r["code"] for r in score_answers(answers_from(steps[:i]), cards, profiles, pairs_data)["ranked"][:3]]
            if truth & set(t3):
                settled = settled or i
            else:
                settled = None
        rows.append({
            "id": s["id"], "first_name": s["first_name"], "certainty": s.get("certainty"), "suits": s["suits"],
            "paper": paper_for(s["suits"][0]) if s["suits"] else "lined",
            "top3": top[:3], "wildcard": res["surprise"],
            "hit3": bool(truth & set(top[:3])), "hit5": bool(truth & set(top[:5])),
            "family3": bool(fam & {c[:8] for c in top[:3]}), "settled_after": settled, "answers": len(steps)})
    n = len(rows) or 1
    known = [r for r in rows if r["certainty"] != "no idea"]
    settled = [r["settled_after"] for r in rows if r["settled_after"]]
    summary = {
        "students": len(rows),
        "hit3": round(sum(r["hit3"] for r in rows) / n, 3),
        "hit5": round(sum(r["hit5"] for r in rows) / n, 3),
        "family3": round(sum(r["family3"] for r in rows) / n, 3),
        "hit3_excluding_no_idea": round(sum(r["hit3"] for r in known) / (len(known) or 1), 3),
        "median_answers_to_settle": sorted(settled)[len(settled) // 2] if settled else None,
        "answers_per_game": rows[0]["answers"] if rows else None,
        "subjects_ever_in_top3": len({c for r in rows for c in r["top3"]}),
    }
    return rows, summary


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    cards = json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]
    profiles = json.loads((ROOT / "data" / "subject_profiles.json").read_text())["subjects"]
    pairs_data = json.loads((ROOT / "data" / "pairs.json").read_text())
    SIM.mkdir(parents=True, exist_ok=True)

    if "--score-only" in sys.argv:
        students = json.loads((SIM / "students.json").read_text())["students"]
    else:
        cl = client()
        students = make_personas(cl, cards, limit)
        played = {}
        if ANSWER_CACHE.exists():
            for line in ANSWER_CACHE.read_text().splitlines():
                played.update(json.loads(line))
        todo = [s for s in students if s["id"] not in played]
        print(f"{len(students)} personas, {len(played)} already played, playing {len(todo)} with {MODEL}")
        with ThreadPoolExecutor(max_workers=6) as pool, open(ANSWER_CACHE, "a") as cache:
            futs = {pool.submit(ask, cl, play_prompt(s), check_play, 0.6): s for s in todo}
            for i, f in enumerate(as_completed(futs), 1):
                s = futs[f]
                try:
                    play = f.result()
                    cache.write(json.dumps({s["id"]: play}, ensure_ascii=False) + "\n")
                    cache.flush()
                    played[s["id"]] = play
                    print(f"[{i}/{len(todo)}] {s['first_name']} played")
                except Exception as e:
                    print(f"[{i}/{len(todo)}] {s['id']} FAILED: {e}")
        for s in students:
            if s["id"] in played:
                s["play"] = played[s["id"]]
                s["steps"] = [list(x) for x in to_answers(played[s["id"]])]
        (SIM / "students.json").write_text(json.dumps({
            "about": f"200 simulated UK students written and played by Muse Spark Open ({MODEL}) on Baseten. "
                     "'suits' is the persona's ground truth; 'steps' is their full answer set in game order.",
            "students": students}, indent=1, ensure_ascii=False))

    rows, summary = evaluate(students, cards, profiles, pairs_data)
    (SIM / "results.json").write_text(json.dumps({"summary": summary, "students": rows}, indent=1, ensure_ascii=False))
    print("\nSummary:", json.dumps(summary, indent=1))
    never = sorted({c["display_name"] for c in cards} - {next(c["display_name"] for c in cards if c["code"] == x)
                                                         for r in rows for x in r["top3"]})
    print(f"{len(never)} subjects never reached anyone's top 3 (worth a look): {', '.join(never[:20])}{' …' if len(never) > 20 else ''}")


if __name__ == "__main__":
    main()
