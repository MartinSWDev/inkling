# Verified facts for the /built page (checked against the repo on 2 Nov). Use these numbers exactly.

## Muse Spark Open (open weights, meta-models/muse-spark-open-1026 on Baseten) — one-off batch jobs
1. Subject cards: 163 UK degree subjects (HESA CAH3), each with a description, "good if you…", a room object, related subjects and keywords. Script: scripts/subject_cards.py
2. Review pass: Spark checked its own cards; 74 cards were changed (duplicate objects, room balance, stereotypes). Originals kept. Script: scripts/apply_card_overrides.py
3. Aliases: 2,481 aliases plus 70 school and college subjects (A-level, BTEC, T-level, Highers) so "Add another subject" understands what teenagers type. Script: scripts/subject_aliases.py
4. Course relevance: 5,118 course titles rated 0–3 so "See courses" shows the right degrees. Script: scripts/course_relevance.py
5. Campus settings: 695 UK teaching locations tagged city / coast / campus town / countryside. Script: scripts/campus_settings.py
6. Apprenticeships: 499 live apprenticeship standards linked to 159 of 163 subjects. Script: scripts/apprenticeship_links.py
7. Simulated students: 200 personas played every round. Script: scripts/simulate_students.py

## Muse Image (muse-image-1.0)
The halls room (plus a taller phone version), 162 subject stickers, 16 window views, 34 card illustrations, 11 scrunched-paper pals, 13 simulation-town buildings. All one paper-diorama style. Scripts: scripts/build_stickers.py, scripts/build_characters.py, scripts/build_buildings.py

## SAM 3.1
Finds and checks objects in the sticker renders and the early in-room renders; stickers are cut out on a green key.

## Muse Code
Coding partner for most of the build (prompts in prompts/). The /built page itself was written by Muse Spark Open through Aider on Baseten after the Muse Code credits ran out. Say this plainly.

## Simulation and scoring (data/score_calibration.json, data/sim/results.json)
- Problem found: "sink" subjects. Zoology was in 45 students' top 3 but suited 1. Biology 41 vs 2, Ecology 41 vs 2, Engineering 31 vs 4, Linguistics 29 vs 2.
- Fix: calibrated = (raw − subject mean) / (subject sd + 0.25 × average sd), learned from the simulated students.
- Held-out test (tuned on 100 students, tested on the other 100): top-3 hit 38% → 54%, top-5 hit 56% → 67%, right subject family in top 3 49% → 67%, subjects that ever reach a top 3 53 → 99.
- All 200 students with the fix: top-3 hit 51%, top-5 63.5%, 121 of 163 subjects appear in someone's top 3. A typical game is 42 answers; the result settles after about 30.
- Reachability check: all 163 subjects can reach a top 3.

## Data (exact credit lines)
- "Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0." 28,753 courses from 315 providers loaded.
- O*NET 31.0: use the attribution in data/README.md (CC BY 4.0, U.S. Department of Labor, Employment and Training Administration; modified).
- "Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England."

## Build journey (git commits per day; 95 so far)
Mon 26 Oct 2 · Tue 27 Oct 3 · Fri 30 Oct 8 · Sat 31 Oct 11 · Sun 1 Nov 70 · Mon 2 Nov live at www.findyourinkling.com (Cloudflare Pages, static, zero AI calls while playing).
