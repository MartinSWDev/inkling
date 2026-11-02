# Menu + the simulation page (page 3 "How it was built" comes later)

Same speed rules as prompts/13 (quick checks per group, full mobile check once at the end, per device). Commit after each group.

## A. Menu on the landing page
- A Lucide Menu (hamburger) button top-left of the landing page (and on the simulation page). Opens a paper sheet sliding in from the left with:
  1. Play Inkling (→ /)
  2. The simulation (→ /simulation)
  3. How it was built (→ /built) — shown but disabled with a small "Soon" tag for now.
- Path-based routing (keep /r/<code> working). Back button works. Not shown during the game rounds (only landing and simulation).

## B. Data for the simulation (fixed snapshot, no live calls)
- scripts/simulate_students.py writes data/sim/students.json and data/sim/results.json (200 simulated students: persona, ground-truth subjects "suits", full answers "steps", top3, wildcard, hit3/hit5/family3, settled_after, paper type).
- Add scripts/export_sim_snapshot.py: compacts both into web/public/sim/snapshot.json (only what the page needs: per student id, first_name, age, where, enjoys, certainty, paper, suits, top3, wildcard, hit3, family3, settled_after, and a compact answer summary — chips + hearts, yes-count per round, pairs chosen; plus the summary block and the subject names/paper types needed for labels). Keep it under ~400KB.
- Until the real file exists, the page uses a clearly-labelled dev placeholder (30 random fake students generated in code) so it can be built and tested now. Show a small "Preview data" badge when using the placeholder. Never ship the placeholder: the page reads the snapshot if present.

## C. The simulation scene (the star of the page)
A replayable paper-craft animation, same visual language as the room (paper diorama, pastel palette, Fraunces/Figtree). It doesn't need to replay real timings — it's a visual story of 200 students making choices.
- Scene (side-on paper town, wide on desktop, scaled to fit width on phones): on the left a "Sixth form" building where students start; a winding paper path with four signposts for the rounds ("Your subjects", "Things you'd get stuck into", "This or that", "Big questions"); on the right a row of 11 destination buildings, one per paper type:
  lined → Library, graph → Maths & engineering tower, manuscript → Concert hall, blueprint → Architect's studio, parchment → Museum, map → Field station, watercolour → Art studio, lab → Science & health lab, legal → Courthouse & offices, printout → Computer lab, kraft → Farm.
- Students are the scrunched-paper pals from web/public/characters/<paper>.webp (until those exist, draw a simple crumpled-circle placeholder in the paper colour). Each student is drawn in the paper of their ground-truth subject.
- Animation (canvas + requestAnimationFrame, 60fps with 200 sprites; DOM only for UI): students leave the sixth form in waves of ~20 with a little hop; at each signpost they pause briefly and tiny icons pop above their heads for that round (Lucide-style Heart/Check/X/Star drawn on canvas, from their real answers: e.g. hearts for favourite chips, ticks/crosses for swipes); then they walk to the building of their top-1 subject's paper type. On arrival a building counter ticks up; if their top 3 contained a ground-truth subject they get a small gold star (hit), otherwise a grey dot.
- Buildings: draw with Muse Image as paper-diorama cut-outs (scripts/build_buildings.py: 11 buildings + the sixth form + a ground strip, /images/generations on #00FF00, keyed like build_characters.py's key_green, saved to web/public/sim/buildings/*.webp; about 13 images). Until they exist, use simple paper-coloured SVG placeholders with the building name.
- Controls (Lucide icons): Play/Pause, Replay, speed 1×/2×/4×. Total runtime at 1× about 45s. Autoplays muted when scrolled into view; respects prefers-reduced-motion (then shows the final state with a "Play" button).
- Tap/click a student → a paper side card (bottom sheet on phones): first name, age, where, what they enjoy, certainty, their chips/hearts and round summary, their top 3 + wildcard, the subjects they'd genuinely suit (ground truth), and "Hit"/"Miss". Also a "Follow a random student" button that highlights one pal and keeps the card open as it walks.
- Sound off by default; optional toggle reusing the game's sound kit (soft pops on arrival).

## D. Results below the scene
- Headline numbers on paper cards, big: "Top 3 included a subject they'd suit" (hit3 %), "…in their top 5" (hit5 %), "Right subject family in top 3" (family3 %), "Answers before the top 3 settled" (median), "Different subjects reached" (count of 163).
- A paper bar chart of arrivals per building (use the room's palette; follow the dataviz rules: labelled bars, no legend needed).
- "Students who'd say they have no idea" vs "Students who know": hit3 for each.
- A short "How this works" section: 200 students written and played by Muse Spark Open (Meta's open-weights model, on Baseten); each answers every card in character; the real Inkling scoring code ranks subjects; each persona's ground truth was written before they played. Plain caveat: these are simulated students, so it measures whether Inkling's questions and scoring are consistent with a student's stated interests — not a study of real students.
- "Run it yourself": the commands (python scripts/simulate_students.py --limit 20, then the full run, then export_sim_snapshot.py), and a note that the page replays a fixed snapshot so it costs nothing to view.
- A few example students as small cards (3–4 hits, 1–2 misses) — honest.

## E. Layout and quality
- This page scrolls normally (it's a page, not the game). Desktop: scene full width (max 1200px), results below in a 2–3 column grid. Phones: scene fits the width (pinch not required), controls under it, results stacked.
- Fast: snapshot loads lazily; images preloaded; no layout shift. Check at 390×844 and 1280×800; screenshot the scene mid-animation and at the end, and the results.
