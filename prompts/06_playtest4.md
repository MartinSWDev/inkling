# Playtest 4 fixes (live playthrough on 5174, desktop Chrome, OS in dark mode)

Screenshots of every step are in review_out/playtest3/step-XX.jpg — open the ones referenced. Fix groups in order, commit after each, and after each group re-run the capture AND review it against the checklist at the bottom. Stop after group E for review.

## A. Always the paper (light) theme — the biggest visual bug
The OS is in dark mode and the whole UI flips to dark plum sheets with white text (steps 01, 04, 06, 07, 23, 27, 29, 33). That isn't the design, and it breaks contrast: selected lilac chips get white text (07), the butter fact note gets white text (23).
- Force the paper theme everywhere: `color-scheme: light` on :root, remove all `prefers-color-scheme: dark` rules/variants, and set every text colour explicitly from tokens. Test with Chrome DevTools "emulate prefers-color-scheme: dark" and light; both must look identical.

## B. Frame is 9:16, always
On a 1422×1122 window the frame was 560×844 (2:3). Frame width = height × 9/16 (max height = viewport − 48px; on phones full-bleed). Never scroll the frame itself (overflow: hidden) — in round 1 the whole frame scrolled and exposed a hard edge where the room image stops (step 08).

## C. Room objects: stable, visible, grounded
1. **Objects vanish.** The Newton's cradle earned in round 1 disappears in round 2 (step 12); the psychology print appears then vanishes (23→24); the trolley comes and goes; at the reveal the cradle is gone even though Physics is in the top 3 (28). New rule: **during rounds an object, once placed, stays.** At the cap (7), no more additions. At the reveal, make sure the top 3 + wildcard are all in the room: swap out the weakest non-result objects with a peel-off animation if needed. Update roomRules + vitest.
2. **Floating objects.** The "lift floor stickers 150px while a card shows" makes the guitar and trolley hover in mid-air (15, 22). Remove the lift. Never move a sticker off its surface.
3. **Cut off at the frame edge.** Calipers hang off the desk edge, the trolley and a yellow sticker are clipped by the right edge (15, 20, 26). Keep every spot's box fully inside the visible area after the framing zoom/crop; clamp spots and reduce the framing zoom if needed.
4. **Landings must be seen.** In round 1 the hearted object lands behind the chips sheet (07); in rounds 2–4 floor objects land behind the card (13). When an object is added: sheet/card slides down out of the way (or shrinks) for ~700ms, the sticker pops with its +1 flag, then the UI returns. No object should ever arrive unseen.
5. **Size.** Stickers read tiny. Scale ×1.2 in rounds and ×1.35 in finale/reveal (within their spot boxes). Prefer at least one wall/bed object in the final room when a qualifying subject exists (finale step 26 is all desk + floor).

## D. Round UI
1. Round 1 sheet must fit with no scrolling at 390×844 and in the desktop frame: chips 40px tall, 3 columns if needed, "Something else?" collapsed to a small "+ Add another subject" button that expands the input.
2. Swipe card is too small (≈260px wide) and the question tag is clipped at the card's top edge (12). Card = ~80% of frame width; the question tag sits fully inside/above the card, never clipped. Labels are paper (light) with ink text. Show the next card peeking behind (96% scale, offset 8px).
3. The ✕/★/✓ row moves between cards (y 810 → 826). Fix it to a constant position from the frame bottom.
4. Desktop trackpad: also accept horizontal two-finger swipes (wheel deltaX, with a threshold and cooldown) and ←/→/↑ keys. Mouse drag already works.
5. Round title: it shows as a small dark box (05, 11) and rounds 3–4 barely show it. Use the paper tag with the card flip, ≥900ms, same every round.
6. Count tag ("+3 in your room") covers the toolbox (20). Show it near the top under the top bar instead.

## E. Unfold + window
1. Unfold: the first frames are almost all dark with only a floor strip (02), and the window is black during it (03). Start the back wall at rotateX(55deg) so it's visible and lit from the first frame; side strips start at ±45deg; show the window view from the start (not faded in late). It should read as a paper room standing up, not a black screen.
2. Every window view has a flat purple band across the top panes with a magenta line (06, 23, 31). Scale the view to cover the whole window opening plus 4% bleed on every side and remove the magenta fringe on room.png's glass edge.

## F. Reveal
1. Top 3 (27): add a heading "Your top 3"; the Next pill overlaps the third card — reserve a bottom row for Back/Next on every reveal page. As each card appears, lift + glow its sticker in the room.
2. Top 3 diversity: Engineering + Mechanical engineering are near-duplicates. Rule: at most one subject per CAH level-2 parent in the top 3 unless the next distinct subject scores less than 70% of it. Add a vitest case.
3. REMOVE the "Because of" reasons from the top-3 cards and the explore list (they often repeat the same reason). Instead show the subject's one-line `plain` description from its card ("You study stars, planets and galaxies…").
4. Wildcard (28): add "Tap to flip" on the face-down card. After the flip show its sticker, name, its why_line and: "A wildcard: it never came up, but it fits your answers." Make sure its sticker visibly drops in (currently a tiny test-tube rack on a shelf).
5. Explore (29): list exactly the top 3 + the wildcard (it showed Electrical engineering instead of Chemistry).
6. Courses (30): better list. Exclude foundation-year/"with Foundation" variants, prefer titles that contain the subject's key word, drop obvious mismatches (e.g. Acoustics at a drama school for Physics), order universities first then colleges, title-case ALL-CAPS provider names. Max 10.
7. Views (31): show the 4 views as small paper picture swatches (thumbnails of each view) plus a day/dusk toggle; the helper text is overlapped by Back.
8. Share (33): REMOVE "Paint my room" entirely (button, sheet and client code; leave the API endpoint unused or delete it).
    the preview's caption is cut off ("got an …ng?") and Back overlaps the preview. The preview should be the video's final frame (room + top 3 + wildcard + end line), fully visible.

## H. From the second playthrough (after A–E)
1. Round outros wait too long. After round 1 the "+1 in your room" tag and pause feel like it's waiting for something. If a round added 0 objects, skip the outro and go straight to the next round title. If it added objects, the outro is ≤1.2s, and any tap skips it.
2. The swipe card hides the desk for the whole of rounds 2 and 4: the Newton's cradle earned in round 1 sat behind the card the entire round. During card rounds, frame the room so the desk top, bed and shelves sit fully ABOVE the card's top edge (translate the room up and/or make the card a little shorter); floor objects can be under the card but must be shown by the landing dip when they arrive.
3. Finale caption "This is your room." covers the floor object (the toolbox). Move it to the top of the frame under the progress bar.
4. View picker: the selected options ("Campus town", "Day") are dark fills with dark text, unreadable. Use the picture swatches from F7 with a clear selected state (accent ring + tick), and the day/dusk toggle as a paper segmented control with readable text in both states.
5. Hearts aren't discoverable: the heart only appears after a chip is selected. Show a faint heart outline on every chip from the start (tapping it selects and hearts in one go).
6. The colour-swatch sticker overhangs the right edge of the desk. Clamp desk spots so the whole sticker sits on the desk top.

## G. Landing (01)
- Paper-white page (see A). Make the mini room the hero: ~45% of frame width, gently breathing. Merge the two "Built with…" lines into the Meta Muse tag plus one plain line "Course data from Discover Uni". Reduce the empty space so the block sits optically centred.

## Review checklist (run after every group; list problems before saying done)
- Light and dark OS settings look identical. Frame is 9:16. Nothing in the frame scrolls.
- Every object that lands is visible when it lands; no object floats, overhangs a surface or is clipped by the frame; placed objects never vanish during rounds; top 3 + wildcard are in the final room.
- All text readable on its background; nothing clipped or overlapping at 390×844 and the desktop frame; buttons fixed in place.
- Save 5 frames across the unfold and one landing animation and check them.
- Screenshot every step and compare with review_out/playtest3 to confirm each referenced problem is gone.
