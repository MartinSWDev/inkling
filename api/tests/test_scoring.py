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
    if "top_calibrated" in exp:
        assert abs(result["ranked"][0]["calibrated"] - exp["top_calibrated"]) < 0.02
    if "raw_top" in exp:
        raw_top = max(result["ranked"], key=lambda r: r["score"])
        assert raw_top["code"] == exp["raw_top"]
        if "raw_top_score" in exp:
            assert abs(raw_top["score"] - exp["raw_top_score"]) < 0.02
    if "calibrated_first3" in exp:
        assert [r["code"] for r in result["ranked"][:3]] == exp["calibrated_first3"]
    for a, b in exp.get("greater_calibrated", []):
        assert rows[a]["calibrated"] > rows[b]["calibrated"]
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


def test_missing_calibration_falls_back_to_raw_ranking():
    result = score_answers({"chips": [{"id": "maths", "state": "love"}]}, CARDS, PROFILES, PAIRS, calibration={})
    assert result["ranked"][0]["code"] == "CAH09-01-01"
    assert all(r["calibrated"] == r["score"] for r in result["ranked"])
    scores = [r["score"] for r in result["ranked"]]
    assert scores == sorted(scores, reverse=True)


def test_ranked_is_sorted_by_calibrated_not_raw():
    result = score_answers({"chips": [{"id": "maths", "state": "love"}]}, CARDS, PROFILES, PAIRS)
    cals = [r["calibrated"] for r in result["ranked"]]
    assert cals == sorted(cals, reverse=True)
    assert result["ranked"][0]["code"] == "CAH10-03-03"  # Polymers: raw 0, well below its usual raw score


def test_agriculture_persona_top3_is_not_zoology_biology_ecology():
    students = json.loads((ROOT / "data" / "sim" / "students.json").read_text())["students"]
    persona = next(s for s in students if s["id"] == "s00-12")
    assert "CAH06-01-03" in persona["suits"]  # Agriculture
    answers = {"chips": [], "typed": [], "swipes": [], "pairs": []}
    for kind, value in persona["steps"]:
        answers[kind].append(value)
    top3 = [r["code"] for r in score_answers(answers, CARDS, PROFILES, PAIRS)["ranked"][:3]]
    assert set(top3) != {"CAH03-01-06", "CAH03-01-03", "CAH03-01-02"}  # Zoology / Ecology / Biology
    assert any(c.startswith("CAH06-01") for c in top3)
    assert set(top3) & set(persona["suits"])


def test_decks_json_matches_python_constants():
    decks = json.loads((ROOT / "data" / "scoring_decks.json").read_text())
    assert decks == {"chips": CHIPS, "extra_names": EXTRA_NAMES, "things": THINGS, "questions": QUESTIONS}


def test_next_cards_exclude_shown_and_are_deterministic():
    shown = [CARDS[0]["code"], CARDS[1]["code"]]
    a = pick_next_cards({}, CARDS, PROFILES, PAIRS, shown, count=5, seed=7)
    b = pick_next_cards({}, CARDS, PROFILES, PAIRS, shown, count=5, seed=7)
    assert [c["code"] for c in a] == [c["code"] for c in b]
    assert not ({c["code"] for c in a} & set(shown))
