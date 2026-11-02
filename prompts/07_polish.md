# Polish pass 7 (playthrough after F/H/G) + wire in the Spark Open data

Commit c1ce2ce was the user's (Spark Open data). Fix in order, commit after each group, review against the prompts/06 checklist (light + dark) before reporting.

## A. Wire in the Spark Open batch data
1. "Add another subject": normalise typed text (lowercase, strip punctuation, collapse spaces) and look it up in data/subject_aliases.json `index` — exact match first, then fuzzy (edit distance ≤ 2 for words over 5 letters). Apply the matched {code: weight} map like a chip (weight 0.4, label = what they typed). Show matching subject names as suggestions while typing (max 5). No match → current behaviour. Add a few hand aliases the batch missed in a small data/subject_aliases_extra.json merged at load ("vet" → veterinary medicine, "medic" → medicine, "uni maths" → maths). Vitest: "psych" → psychology, "btec sport" → sport and exercise sciences, "psycology" → psychology.
2. scripts/build_course_lists.py: use data/course_relevance.json — keep score ≥ 2 and variant false, order by score then universities first; fall back to score 1 when fewer than 3 courses remain; keep max 1 per provider and max 10. Re-run it.

## B. Layout and visual fixes
1. Rounds 2–4: a lilac strip shows along the bottom of the frame now that the room is framed higher. Scale the room so it always covers the whole frame (no background showing anywhere).
2. The swipe card shrank to about 45% of the frame width. Make it ~80% of the frame width again while keeping the desk top above the card (shorten the card art height rather than narrowing it; art 16:10 is fine).
3. "Your top 3" heading is white text straight on the room — put it on a small paper tag like the question tags.
4. Wildcard card is small — ~62% of frame width, sticker larger.
5. Views page: the swatch panel covers the window, so you can't see your choice change. Make it a compact bottom panel: one row of 4 small swatches (scroll-free) + the day/dusk toggle, keeping the window fully visible. Remove "and later helps suggest places to study" (not built) — say "It changes the view from your window."
6. Explore list: remove "What's it like?" (the plain line already says it).
7. Share preview: a sticker (the toolbox) is drawn on top of the caption panel. Draw the caption last, give the preview more width (it's the hero of the share page) and make sure the subject names aren't cramped. The share panel's right side has empty space — stack buttons full-width under a larger preview.
8. Landing: the mini room's window panes are flat lilac with no view — composite the view into the mini room. The block still sits high with a big empty bottom; centre it vertically in the frame.
9. Accessibility copy: heart buttons are labelled "Love Physics" — use "Favourite Physics".

## C. Check on a real phone path
- Run the capture at 390×844 and confirm Share video produces a file on a browser that supports MediaRecorder; log the chosen mime type. If navigator.share with files isn't available, the fallback (download + copy link) must work. Report exactly what you verified vs not.
