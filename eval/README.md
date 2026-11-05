# Evaluation: the simulated-student simulation

## What it measures

Inkling's scoring is tested with 200 simulated students written and played by Muse Spark Open (on Baseten). Each persona is a varied UK 16–18 year old with school subjects and interests, and — written **before** they play — 1–3 degree subjects they would genuinely suit (the ground truth). Each persona then answers the whole game in character (subject chips and hearts, all 18 "things" cards, the 5 this-or-that pairs, all 16 big questions), and the real scoring code (`api/scoring.py`) ranks subjects for them.

The headline accuracy metrics compare the ranked subjects against that ground truth. The simulation page at `/simulation` replays the same students.

## Metrics

Held out (calibration tuned on a random 100 students, measured on the other 100), before → after the sink correction `calibrated = (raw − subject mean) / (subject sd + 0.25 × average sd)`:

| Metric | Before | After |
| --- | --- | --- |
| Top-3 hit (a suited subject in the top 3) | 38% | 54% |
| Top-5 hit | 56% | 67% |
| Right subject family in top 3 | 49% | 67% |
| Subjects ever reaching a top 3 | 53 | 99 |

Across all 200 students with the fix applied: top-3 hit 51%, top-5 hit 63.5%, and 121 of 163 subjects reach someone's top 3. The full per-subject means and standard deviations, plus the held-out block, are in [results.json](results.json) (a copy of `web/public/data/score_calibration.json`, which the simulation page reads).

These are simulated students, so the metrics measure whether Inkling's questions and scoring are consistent with a student's stated interests — not a study of real students.

## Re-running it

From the repo root. Generating and playing students makes live model calls and needs `BASETEN_API_KEY` in `.env`; re-scoring and calibration are free.

```sh
python scripts/simulate_students.py --limit 20   # 20 students end to end
python scripts/simulate_students.py              # all 200, resumes if interrupted
python scripts/simulate_students.py --score-only # re-score saved answers (no API calls)
python scripts/calibrate_scoring.py              # held-out metrics + writes the calibration data
python scripts/export_sim_snapshot.py            # writes web/public/sim/snapshot.json for /simulation
```

Outputs: `data/sim/students.json` (personas and answers) and `data/sim/results.json` (per-student results and summary).
