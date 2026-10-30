import json
from pathlib import Path

from api.scoring import pick_next_cards, score_answers

ROOT = Path(__file__).resolve().parents[2]
CARDS = json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]
PROFILES = json.loads((ROOT / "data" / "subject_profiles.json").read_text())["subjects"]
PAIRS = json.loads((ROOT / "data" / "pairs.json").read_text())
BY_NAME = {c["display_name"]: c["code"] for c in CARDS}


def ranked(answers):
    return score_answers(answers, CARDS, PROFILES, PAIRS)["ranked"]


def test_empty_answers_all_zero():
    rows = ranked({})
    assert len(rows) == 163
    assert all(r["score"] == 0 and r["uncertainty"] == 1 for r in rows)


def test_loved_maths_chip_ranks_maths_first_and_gives_reason():
    rows = ranked({"chips": [{"id": "maths", "state": "love"}]})
    assert rows[0]["code"] == BY_NAME["Mathematics"]
    assert "Maths" in rows[0]["reasons"]
    taken = ranked({"chips": [{"id": "maths", "state": "take"}]})
    assert taken[0]["score"] < rows[0]["score"]


def test_subject_swipe_yes_beats_no_and_neighbours_nudge():
    code = BY_NAME["Computer science"]
    card = next(c for c in CARDS if c["code"] == code)
    rows = {r["code"]: r for r in ranked({"subject_swipes": [{"code": code, "answer": "yes"}]})}
    assert rows[code]["score"] > 0 and rows[code]["direct"] > 0
    for nb in card["neighbours"]:
        assert rows[nb]["score"] > 0
    down = {r["code"]: r for r in ranked({"subject_swipes": [{"code": code, "answer": "no"}]})}
    assert down[code]["score"] < 0


def test_pairs_investigative_pick_boosts_physics_over_business():
    rows = {r["code"]: r for r in ranked({"pairs": [{"pair_id": "why_vs_make", "side": "a"}]})}
    assert rows[BY_NAME["Physics"]]["score"] > rows[BY_NAME["Business and management"]]["score"]
    skipped = ranked({"pairs": [{"pair_id": "why_vs_make", "side": None}]})
    assert all(r["score"] == 0 for r in skipped)


def test_next_cards_exclude_shown_and_are_deterministic():
    shown = [CARDS[0]["code"], CARDS[1]["code"]]
    a = pick_next_cards({}, CARDS, PROFILES, PAIRS, shown, count=5, seed=7)
    b = pick_next_cards({}, CARDS, PROFILES, PAIRS, shown, count=5, seed=7)
    assert [c["code"] for c in a] == [c["code"] for c in b]
    assert not ({c["code"] for c in a} & set(shown))
