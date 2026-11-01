"""
Compact the simulation output for the web page (prompts/14 B).

Reads data/sim/students.json + data/sim/results.json (from simulate_students.py)
and writes web/public/sim/snapshot.json with only what /simulation needs:
per student id, first_name, age, where, enjoys, certainty, paper, suits, top3,
wildcard, hit3, family3, settled_after and a compact answer summary
(chips + hearts, yes-count per round, pairs chosen), plus the summary block
and the subject-name map. Target: under ~400KB.

Run from repo root:  python scripts/export_sim_snapshot.py
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from api.scoring import CHIPS, QUESTIONS, THINGS  # noqa: E402

SIM = ROOT / "data" / "sim"
OUT = ROOT / "web" / "public" / "sim" / "snapshot.json"

_spec = importlib.util.spec_from_file_location("simulate_students", ROOT / "scripts" / "simulate_students.py")
_sim = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_sim)  # only for paper_for(); no API calls at import
paper_for = _sim.paper_for

PAPER_BUILDINGS = {
    "lined": "Library", "graph": "Maths & engineering tower", "manuscript": "Concert hall",
    "blueprint": "Architect's studio", "parchment": "Museum", "map": "Field station",
    "watercolour": "Art studio", "lab": "Science & health lab", "legal": "Courthouse & offices",
    "printout": "Computer lab", "kraft": "Farm",
}


def compact_answers(play, pairs_by_id):
    chips = {c["id"]: c["name"] for c in CHIPS}
    picked = [{"name": chips.get(c["id"], c["id"]), "love": c.get("state") == "love"}
              for c in play.get("chips", [])]
    things = play.get("things", {})
    questions = play.get("questions", {})
    pairs = []
    for pid, side in play.get("pairs", {}).items():
        pair = pairs_by_id.get(pid, {})
        label = pair.get(side, {}).get("label") if side in ("a", "b") else None
        pairs.append({"pair": pid, "chose": label})
    return {
        "chips": picked,
        "hearts": [c["name"] for c in picked if c["love"]],
        "typed": play.get("typed", []),
        "yes": {
            "things": sum(1 for t in THINGS if things.get(t["id"]) == "yes"),
            "things_total": len(THINGS),
            "questions": sum(1 for q in QUESTIONS if questions.get(q["id"]) in ("yes", "up")),
            "questions_up": sum(1 for q in QUESTIONS if questions.get(q["id"]) == "up"),
            "questions_total": len(QUESTIONS),
        },
        "pairs": pairs,
        "pairs_decided": sum(1 for p in pairs if p["chose"]),
    }


def main():
    for name in ("students.json", "results.json"):
        if not (SIM / name).exists():
            sys.exit(f"missing {SIM / name} — run: python scripts/simulate_students.py")
    students = json.loads((SIM / "students.json").read_text())["students"]
    results = json.loads((SIM / "results.json").read_text())
    cards = json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]
    pairs_data = json.loads((ROOT / "data" / "pairs.json").read_text())["pairs"]
    pairs_by_id = {p["id"]: p for p in pairs_data}
    names = {c["code"]: c["display_name"] for c in cards}
    by_id = {s["id"]: s for s in students}

    out_students, arrivals = [], {}
    for r in results["students"]:
        s = by_id.get(r["id"], {})
        dest_paper = paper_for(r["top3"][0]) if r.get("top3") else r.get("paper", "lined")
        arrivals[dest_paper] = arrivals.get(dest_paper, 0) + 1
        out_students.append({
            "id": r["id"], "first_name": r.get("first_name"), "age": s.get("age"),
            "where": s.get("where"), "enjoys": s.get("enjoys"), "certainty": r.get("certainty"),
            "paper": r.get("paper", "lined"), "dest_paper": dest_paper,
            "suits": r.get("suits", []), "top3": r.get("top3", []), "wildcard": r.get("wildcard"),
            "hit3": r.get("hit3", False), "hit5": r.get("hit5", False),
            "family3": r.get("family3", False), "settled_after": r.get("settled_after"),
            "answers": compact_answers(s.get("play", {}), pairs_by_id),
        })

    rows = results["students"]
    no_idea = [r for r in rows if r.get("certainty") == "no idea"]
    knows = [r for r in rows if r.get("certainty") != "no idea"]
    summary = dict(results["summary"])
    summary.update({
        "total_subjects": len(cards),
        "hit3_no_idea": round(sum(r["hit3"] for r in no_idea) / len(no_idea), 3) if no_idea else None,
        "hit3_knows": round(sum(r["hit3"] for r in knows) / len(knows), 3) if knows else None,
        "no_idea_count": len(no_idea), "knows_count": len(knows),
        "arrivals_by_paper": arrivals,
    })
    snapshot = {
        "about": "Fixed snapshot of 200 simulated students (Muse Spark Open on Baseten), "
                 "replayed by the page. No live calls.",
        "summary": summary, "subjects": names, "buildings": PAPER_BUILDINGS,
        "students": out_students,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")))
    kb = OUT.stat().st_size / 1024
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out_students)} students, {kb:.0f} KB"
          + ("  WARNING: over 400 KB" if kb > 400 else ""))
    if kb > 400:
        sys.exit(1)


if __name__ == "__main__":
    main()
