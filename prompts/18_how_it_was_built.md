# Page 3: "How it was built" (/built) — for judges and the curious

Enable the menu item (remove "Soon"). Same paper design language as the simulation page (scrolling page, Fraunces/Figtree, paper cards, the room palette, Lucide icons). Phone and desktop. Everything factual below comes from the repo — verify numbers from the data files at build time where possible (counts, simulation results) rather than hard-coding.

## Structure
1. Hero: "How Inkling was built" + one line: "A week, one developer, Meta's models doing the heavy lifting once — so the game is free to play at any scale." Small row of the scrunched pals.

2. "What each Meta model did" — the core section. One paper card per model, each with: what it did, how many times/what scale, where you see it in the app, and a tiny visual (a sticker, a pal, a building, a JSON snippet). Content:
   - Muse Spark Open (open weights, on Baseten) — the text brain, all as one-off batch jobs:
     1. Wrote a card for each of the 163 UK degree subjects (plain description, "good if you…", the room object, SAM labels, related subjects, keywords) from HESA course titles and graduate jobs.
     2. Reviewed its own cards: removed duplicate objects, rebalanced where things sit in the room, replaced stereotyped objects.
     3. Wrote ~2,300 aliases and linked ~70 school/college subjects (A-level, BTEC, T-level, Highers) so "Add another subject" understands what teenagers type.
     4. Rated 5,118 course titles for relevance so "See courses" shows the right degrees.
     5. Tagged all 695 UK teaching locations as city / coast / campus town / countryside.
     6. Linked 499 live apprenticeship standards to subjects ("Rather earn while you learn?").
     7. Wrote and played 200 simulated students to test the scoring (see the simulation page).
   - Muse Image — drew the halls room (and a taller phone version, outpainted), 162 subject stickers, 8 window views, 34 card illustrations, the 11 scrunched-paper pals and the simulation town's buildings, all in one paper-diorama style.
   - SAM 3.1 — found and checked every object in the stickers (cut-outs keyed on green, SAM confirms the object is there and where), and verified the early in-room renders.
   - Muse Spark / Wonder (Meta Model API) — coding partner via Muse Code for the build, and used early for scene ideas for the "This or that" pictures. (Keep this factual; don't overclaim.)
   Each card links to the script in the repo (scripts/subject_cards.py, apprenticeship_links.py, campus_settings.py, course_relevance.py, subject_aliases.py, simulate_students.py, build_stickers.py, build_characters.py, build_buildings.py).

3. "Why open weights" — short: every text step runs on an open model, so a school, careers service or exam board could run the whole pipeline on its own servers, in its own language, and keep pupils' answers in-house. Batch jobs mean zero AI calls while you play.

4. "The data underneath" — real sources, with licences and credits (exact wording):
   - HESA Discover Uni 2026/27 — "Contains HESA Discover Uni data (HESA, www.hesa.ac.uk), licensed under CC BY 4.0." (28,753 courses from 315 providers loaded; 2,593 shown in course lists)
   - O*NET 31.0 — the full O*NET attribution already in data/README.md (CC BY 4.0, U.S. Department of Labor/ETA; modified).
   - Skills England apprenticeship standards — "Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England."
   Note: "No AI-generated facts about courses: every number comes from these sources."

5. "Build journey" — a horizontal paper timeline (vertical on phones) of the week, from git history (count commits per day with `git log --date=short --format=%ad | sort | uniq -c` at build time): Mon 26 Oct idea + smoke tests (Spark, Image, SAM) → Tue HESA data loaded → Fri 30 Oct subject cards, first live room loop (minutes per room) → pivot: pre-rendered stickers so the room is instant and free per player → Sat paper-diorama experience rebuild, swipes, reveal → Sun mobile polish, share video with sound, apprenticeships, campus settings, simulation of 200 students, sink-corrected scoring → Mon 2 Nov live at findyourinkling.com as a static Cloudflare Pages site, with fixes from phone testing. Extend the timeline with any later days in the git log. Use 1–2 real before/after images from review_out or sticker_out where they help (e.g. early in-room render vs sticker room). Include the honest pivots ("live generation took minutes per room → pre-render everything once").

6. "Testing it properly" — the simulation in brief with the real numbers read from data/score_calibration.json (held-out before → after) and data/sim results; the reachability check ("all 163 subjects can reach a top 3"); link to /simulation.

7. "What's next" — data refresh (weekly apprenticeships, monthly courses via scheduled job); more countries with country-specific data packs (table: courses/outcomes, entry & cost, earn-while-you-learn routes, jobs data, local cards and wording, a local room + window views drawn by Muse Image); adaptive questions from a larger card pool.

8. Footer: "Play it at www.findyourinkling.com" (link to /), built for the Meta Global AI Developer Hackathon 2026 (indie track), link to the GitHub repo, "Built with Meta Muse" tag.

Quality: no scrolling traps, images lazy-loaded, readable at 390×844, no all-caps labels, sentence case. Screenshot the page at both sizes and review before reporting.

## Also
- The page must scroll normally on phones. The game route locks scrolling, and this page must not inherit that. Use `vh` fallbacks before any `svh`/`dvh` (same rule as prompts/19).
- Add the page's own `<title>` and meta description ("How Inkling was built with Meta's Muse Spark Open, Muse Image and SAM 3.1"), and make sure the `_redirects` SPA rule serves /built.
- Don't deploy. Give me the command.
