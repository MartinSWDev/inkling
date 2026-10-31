import json
from pathlib import Path

from api.scoring import CHIPS, EXTRA_NAMES, QUESTIONS, THINGS, pick_next_cards, score_answers

ROOT = Path(__file__).resolve().parents[2]
CARDS = json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]
PROFILES = json.loads((ROOT / "data" / "subject_profiles.json").read_text())["subjects"]
PAIRS = json.loads((ROOT / "data" / "pairs.json").read_text())
FIXTURE = json.loads((ROOT / "api" / "tests" / "fixtures" / "scoring_cases.json").read_text())


def check_case(case):
    result = score_answers(case["answers"], CARDS, PROFILES, PAIRS)
    rows = {r["code"]: r for r in result["ranked"]}
    exp = case["expect"]
    if exp.get("zero_all"):
        assert all(r["score"] == 0 and r["uncertainty"] == 1 for r in result["ranked"])
    if "top" in exp:
        assert result["ranked"][0]["code"] == exp["top"]
    if "top_score" in exp:
        assert abs(result["ranked"][0]["score"] - exp["top_score"]) < 0.02
    for code in exp.get("positive", []):
        assert rows[code]["score"] > 0, code
    for code in exp.get("negative", []):
        assert rows[code]["score"] < 0, code
    for code, labels in exp.get("reasons", {}).items():
        for label in labels:
            assert label in rows[code]["reasons"]
    for a, b in exp.get("greater", []):
        assert rows[a]["score"] > rows[b]["score"]
    for code in exp.get("room_includes", []):
        assert code in result["room"]


def test_shared_fixture_cases():
    for case in FIXTURE["cases"]:
        check_case(case)


def test_decks_json_matches_python_constants():
    decks = json.loads((ROOT / "data" / "scoring_decks.json").read_text())
    assert decks == {"chips": CHIPS, "extra_names": EXTRA_NAMES, "things": THINGS, "questions": QUESTIONS}


def test_next_cards_exclude_shown_and_are_deterministic():
    shown = [CARDS[0]["code"], CARDS[1]["code"]]
    a = pick_next_cards({}, CARDS, PROFILES, PAIRS, shown, count=5, seed=7)
    b = pick_next_cards({}, CARDS, PROFILES, PAIRS, shown, count=5, seed=7)
    assert [c["code"] for c in a] == [c["code"] for c in b]
    assert not ({c["code"] for c in a} & set(shown))
