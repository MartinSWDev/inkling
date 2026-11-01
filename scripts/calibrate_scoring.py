"""
Sink correction for Inkling's scoring, learned from the simulated students (no API calls).

Broad subjects (Zoology, Biology, Engineering, Linguistics…) match lots of keywords, so they win the top 3
for students who don't suit them. Fix: rank each subject by how far today's score is above what that
subject usually scores, scaled by how much it varies:
    calibrated = (raw - mean[subject]) / (sd[subject] + K * average_sd)
mean/sd come from the raw scores of the simulated students. K softens the effect for rarely-varying
subjects (K = 0.25 was best on held-out students).

  python scripts/calibrate_scoring.py        # report held-out numbers and write data/score_calibration.json

The report fits on a random half of the students and scores the other half, so the numbers aren't
measured on the data they were tuned with. The saved calibration uses all students.
"""
import json
import random
import statistics as st
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from api.scoring import score_answers  # noqa: E402
from simulate_students import answers_from  # noqa: E402

K = 0.25


def main():
    cards = json.loads((ROOT / "data" / "subject_cards.json").read_text())["cards"]
    profiles = json.loads((ROOT / "data" / "subject_profiles.json").read_text())["subjects"]
    pairs = json.loads((ROOT / "data" / "pairs.json").read_text())
    students = [s for s in json.loads((ROOT / "data" / "sim" / "students.json").read_text())["students"] if "steps" in s]
    codes = [c["code"] for c in cards]
    raw = {}
    for s in students:
        res = score_answers(answers_from([tuple(x) for x in s["steps"]]), cards, profiles, pairs)
        raw[s["id"]] = {r["code"]: r["score"] for r in res["ranked"]}

    def fit(ids):
        mu = {c: st.mean(raw[i][c] for i in ids) for c in codes}
        sd = {c: st.pstdev([raw[i][c] for i in ids]) or 1.0 for c in codes}
        return mu, sd, st.mean(sd.values())

    def evaluate(ids, rank):
        h3 = h5 = f3 = 0
        reach = set()
        for s in students:
            if s["id"] not in ids:
                continue
            order = sorted(codes, key=lambda c: -rank(s["id"], c))
            truth = set(s["suits"])
            h3 += bool(truth & set(order[:3]))
            h5 += bool(truth & set(order[:5]))
            f3 += bool({c[:8] for c in truth} & {c[:8] for c in order[:3]})
            reach |= set(order[:3])
        n = len(ids)
        return {"hit3": round(h3 / n, 3), "hit5": round(h5 / n, 3), "family3": round(f3 / n, 3), "subjects_reached": len(reach)}

    ids = [s["id"] for s in students]
    random.Random(3).shuffle(ids)
    half = len(ids) // 2
    train, test = set(ids[:half]), set(ids[half:])
    mu, sd, msd = fit(train)
    before = evaluate(test, lambda i, c: raw[i][c])
    after = evaluate(test, lambda i, c: (raw[i][c] - mu[c]) / (sd[c] + K * msd))
    print(f"Held-out students ({len(test)}), tuned on the other {len(train)}:")
    print("  before:", before)
    print("  after: ", after)

    mu, sd, msd = fit(set(ids))
    out = {
        "about": "Per-subject mean and standard deviation of raw Inkling scores over the simulated students "
                 "(Muse Spark Open personas). calibrated = (raw - mean) / (sd + k * avg_sd).",
        "k": K, "avg_sd": round(msd, 6), "students": len(ids),
        "held_out": {"before": before, "after": after},
        "subjects": {c: [round(mu[c], 6), round(sd[c], 6)] for c in codes}}
    (ROOT / "data" / "score_calibration.json").write_text(json.dumps(out, indent=1))
    print("Wrote data/score_calibration.json")


if __name__ == "__main__":
    main()
