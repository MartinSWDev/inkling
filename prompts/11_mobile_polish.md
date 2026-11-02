# Mobile polish before launch (replaces prompts/08 and prompts/10 — fold both in here)

Found by playing on a phone-sized screen (390×844, touch) plus the user's own play. Goal: feels properly polished on a phone. Fix in order, commit after each group. After EVERY group run the mobile test in section J and fix what it finds before reporting.

## A. The room fills a phone screen without cutting off the sides
On 390×844 the room is cover-cropped so hard that the shelves and half the bed are gone (the image is 9:16, phones are ~9:19.5). The player must always see the whole width: wardrobe, bed, desk, shelves.
- Make a taller room for phones with Muse Image (cost: pennies; we have ~$50 credit): place room.png centred on a 1152×2496 canvas and ask muse-image-1.0 (/v1/images/edits, same paper-diorama identity, search tools off) to extend the ceiling above and the floor below in the same style — nothing else changes. Then COMPOSITE the original room.png back over the middle exactly (Muse redraws, so keep the original pixels), feathering a 24px seam. Re-key the window glass. Save web/public/room/room_tall.png + webp and record its top offset (so sticker/spot coordinates shift by a constant). Do the same for the 4 day/dusk lighting if it's a separate layer; views don't change.
- Phones: fit the room by WIDTH (whole width visible), anchored so the floor sits at the bottom; use room_tall to fill the extra height. Never crop the sides. Remove the round "framing zoom" on phones; if the desk must clear a card, translate vertically only.
- Desktop frame (9:16) keeps the original room.

## B. Round 1 (subjects)
1. Heart bug: tapping the heart on a selected chip DESELECTS it (and shows a dark flash). Heart must only toggle favourite (selecting the chip too if needed); stopPropagation on the heart, no :active dark fill. Add a vitest/DOM test: select Physics → tap heart → Physics is selected AND favourited.
2. No truncation: "Phys…", "Com…", "Art & Desi…" are cut off. Use 2 columns on phones (3 only if every label fits), full names always, heart as its own 44px target at the right edge of the chip.
3. Centre the subjects sheet vertically in the screen (it currently starts halfway down); no scrollbars anywhere. In round 1 the room behind can be dimmed — nothing has landed yet.
4. Objects from round 1 appear only when the player taps Continue, all together with a stagger (not one per heart). Show the drop over the room with the sheet gone, then the "+N in your room" tag.

## C. Swipe card layout (was prompts/10)
Order top→bottom: top bar, question tag ("Would you get stuck into this?" / "Would you want to find out?" / "Which is more you?") under the top bar, the room, a hint row ("← Not for me   1 of 5   Yes →", round 4 adds "↑ Tell me more"), the card with the picture filling it and NO text overlaid (drag stamps only while dragging), the title on a paper strip directly under the card ("Taking apart an old radio"), then the fixed ✕/★/✓ row. Hint arrows nudge once at round start and fade to 40% after two swipes. Pairs: same question tag at top; pictures clear with label + caption under each. Keep the desk top visible above the card where possible.

## D. Reveal order
"Where do you see yourself studying?" must come BEFORE the courses. New order: finale → your top 3 → wildcard → where do you see yourself (city/coast/campus town/countryside swatches; instant window change) → subjects to explore (course sheets grouped by that choice) → share. Fix title-casing in provider names ("The University Of East Anglia" → "University of East Anglia"; lower-case of/and/the inside names).

## E. Share page that fits
All share buttons must be visible without scrolling at 360×780, 390×844 and the desktop frame. Layout: smaller preview (≈40% width) on the left, buttons stacked on the right (Share video, Share image, Copy link, Start over) — or preview above and a 2×2 button grid below, whichever fits. Under the buttons, one line explaining behaviour by device: on phones "Opens your share sheet — pick Instagram, TikTok or WhatsApp"; on desktop "Saves the video — post it from your phone". (Downloading on desktop is expected: desktop browsers don't offer the share sheet for files.)

## F. Share video — the subjects are the point (was prompts/08)
Currently the subjects are small pale strips in the last 3 seconds and the wildcard card is mostly blank. New 10s storyboard (1080×1920, 30fps):
- 0.0–0.6s hook: room + paper tag at the top "Filling my room with what I'm into…"; first sticker lands by 0.5s.
- 0.6–3.5s: stickers drop in fast, one every ~0.35s, each with its pop.
- 3.5–7.0s: the TOP 3, one per ~1.1s, each a big moment: camera pushes slightly toward that subject's sticker, which lifts and glows, while a large paper card slides up over the lower third with the subject name in Fraunces ~84px (wrapping, auto-shrink to fit) and its sticker beside it; the previous card stacks smaller above it so all three end up visible.
- 7.0–8.6s: the wildcard: face-down card flips (with sparkle) to show the sticker + name large + "wildcard".
- 8.6–10.0s: end card (holds ≥1.2s): finished room dimmed, "What's your inkling?" big, "Find yours at www.findyourinkling.com" (SHORT_DOMAIN constant = "www.findyourinkling.com"). Never print the encoded URL in the video; the /r/<code> link goes in the share text.
- Small "Inkling" paper label top-left throughout, readable at phone size.
Save frames at 0.3, 1.5, 3, 4.5, 6, 7.5, 8.8, 9.7s to review_out/video_frames/ and look at them before reporting.

## G. Sound that feels fun (video and game)
Current pops are flat. Design a small sound kit with WebAudio (no files needed) and use the same kit in the game and the video:
- Sticker land: a short bright "pop" (sine + triangle, 6–10ms attack, 120ms decay, slight pitch drop) followed by a tiny wooden tick; each successive sticker pitched one step up a major pentatonic scale (C D E G A, wrapping an octave), so filling the room climbs like Duolingo's streak chime.
- Card swipe: soft filtered-noise "whoosh" (bandpass sweep 1.2k→3k, 150ms); yes = a little rising two-note blip, no = a soft low blip.
- Top-3 card arrive: warm marimba-like note (sine with fast decay + quiet octave), three ascending across the three cards.
- Wildcard flip: paper flick + sparkle (3 quick high sine pings with random detune) + a soft major chord.
- End card: gentle resolving chord.
- Light shared reverb (short convolution from generated noise), master limiter, sensible levels; total CPU tiny. Sound toggle respected; video always includes sound.

## H. Copy
Heart aria-label "Favourite <subject>". Keep sentence case everywhere.

## J. Mobile test protocol (run after every group)
Write web/scripts/mobile_check.ts with Playwright device emulation and touch: iPhone 13 (390×844), iPhone SE (375×667), Pixel 7 (412×915), plus the 1280×800 desktop frame. Play the full flow with taps and touch-drags; screenshot every step to review_out/mobile/<device>/. Automatically fail on: any element with text-overflow ellipsis or scrollWidth > clientWidth in chips/cards/titles; any scrollable container or document scroll during rounds/reveal; any button in the current scene outside the viewport; room's left and right edges not visible (assert the wardrobe and shelf spots are inside the viewport); heart test from B1. Then look at the screenshots yourself and list remaining visual problems before saying done.
