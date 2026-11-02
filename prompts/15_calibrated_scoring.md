# Apply the sink correction to scoring (measured on the 200 simulated students)

Problem (from data/sim): broad subjects win everyone's top 3 — Zoology in 45 students' top 3 but suits 1; Biology 41/2; Ecology 41/2; Engineering 31/4; Mechanical eng 30/2; Linguistics 29/2. Only 62 of 163 subjects ever reach a top 3.

Fix (already computed): data/score_calibration.json = per-subject [mean, sd] of raw scores over the simulated students, plus k and avg_sd. Rank subjects by
  calibrated = (raw - mean) / (sd + k * avg_sd)
Held-out result (tuned on 100 students, scored on the other 100): hit3 38% → 54%, hit5 56% → 67%, right family 49% → 67%, subjects reached 53 → 99. Regenerate with `python scripts/calibrate_scoring.py`.

## A. Scoring (Python + TypeScript, kept identical)
- api/scoring.py score_answers and web/src/scoring.ts: compute raw scores as now, then add `calibrated` per subject and sort `ranked` by calibrated (keep `score` = raw in each row for debugging). Load calibration from data/score_calibration.json (Python) and from the same file shipped to the client (copy to web/public/data or import as JSON). If the file is missing, fall back to raw ranking.
- Wildcard ("surprise") and the top-3 diversity rule use the calibrated order. Room qualification thresholds currently use raw score values (> 0.15 etc.): switch them to the calibrated order (top-N by calibrated with calibrated > 0) so the room matches the result. Keep the room rules (caps, stability, end-of-round drops).
- Update the shared fixture tests (pytest + vitest) so both implementations agree on calibrated order; add a test that a student who only says yes to farm/food cards no longer gets Zoology/Biology/Ecology as their whole top 3 (use a persona from data/sim/students.json, e.g. one whose suits include Agriculture).

## B. Re-score the simulation
- `python scripts/simulate_students.py --score-only` must use the calibrated ranking (it imports api/scoring), then `python scripts/export_sim_snapshot.py`.
- Simulation page: add a small "Before and after" card: "We found broad subjects like Zoology and Engineering were winning everyone's top 3. Correcting for that, measured on students the fix wasn't tuned on: 38% → 54% got a subject they'd suit in their top 3; subjects reached 53 → 99." Read the numbers from score_calibration.json held_out, not hard-coded.

## C. Check
Build, tests, then a quick play-through at 390×844 to confirm results still look sensible for an obvious profile (physics + maths + taking-apart cards → physics/engineering family, not just general Engineering).
