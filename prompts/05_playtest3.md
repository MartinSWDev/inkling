# Playtest 3 fixes (after prompts/04). Fix in this order, commit after each group, run capture after each.

## A. Layout: UI floats OVER a full-screen room (not a split screen)
- The room is always full-bleed behind everything (cover-fit the whole 9:16 frame). Remove the purple lower panel.
- Round UI floats over the lower part of the room as paper cards (chips sheet, swipe card, pair cards), with 16px side margins and the room visible around and above them.
- Frame the room so the objects stay visible: during rounds, translate/scale the room (max 8% zoom) so shelves, desk and bed sit in the top ~60%; floor stickers that would sit under the card get their spot shifted up or use their backup spot while a card is showing. When an object lands, if it's under the card, the card dips down 40px for 600ms so the drop is seen.
- Stickers must keep their aspect ratio at every size: set width only, height auto (or scale both by the same factor). They currently look squished on desktop/wider frames. Add a vitest/DOM check or a capture at 430×932 and 1280×800 (desktop frame).

## B. Top bar
- One row: round title (Fraunces, truncates with ellipsis, max 1 line) left; progress segments above it; a round icon-button for sound (speaker / speaker-off icon, aria-label "Sound on"/"Sound off") right. Remove the "Round 2 of 4" text (the segments show it). Nothing overlaps at 360px wide.

## C. Chips
- Selected chips are dark with near-invisible text. Selected = round accent fill with ink text and a check; hearted = accent fill + filled heart. AA contrast in every state.

## D. Unfold (landing → room)
- Replace the abstract squares with the real room. Use room.png sliced with clip-path into: floor band, back wall (window + board), left wall strip (wardrobe), right wall strip (shelves). Animate in 3D (perspective 1200px): floor scales in flat, back wall rotates up from rotateX(80deg) around its bottom edge, side strips swing in from rotateY(±70deg), lamp glow fades on last, view fades into the window. ~1.4s, `fold` spring. The landing's folded square should be a mini of the room (same colours), so it reads as the room folded up.

## E. Counts and copy
- Never show "0 things in your room". Only show a count tag when at least 1 object was added that round ("+2 in your room"). 
- Landing footer: remove the trailing "·".

## F. Facts (round 4)
- Fact flash moves out of the card: a paper sticky note that pops onto the top of the screen (below the top bar, over the room's wall), slightly rotated, for 3s or until the next swipe. Not on the card.

## G. Tap objects in the room
- Stickers are tappable (in rounds, finale and reveal): pointer-events only on stickers (room background stays non-interactive and below the UI). Tap = sticker lifts (scale 1.08) and a small paper tag pops beside it: subject display name + its why_line, e.g. "Astronomy — Good if you keep wondering what's out there beyond Earth at night." Tap elsewhere to close. During rounds keep it to the name only (no spoilers of the result order).

## H. Room size
- Max 7 objects during the rounds; the wildcard adds the 8th in the reveal. Never more than 8 total. Update roomRules and its tests.

## I. Real course links (replace the empty Discover Uni search)
- New `scripts/build_course_lists.py`: from data/processed/inkling.db (read-only) write `web/public/subjects/<code>.json` for each subject: up to 12 full-time undergraduate courses, preferring varied providers (max 1 per provider), each `{title, provider (providers.name), url (courses.url), ucas_code}`. Skip courses with no url. Include the HESA attribution line in the file.
- Reveal page C: each subject's "See courses" opens a paper bottom sheet listing those courses (title, provider, "Course page" link opening the provider's page in a new tab) and a line "Course data: Discover Uni (HESA), CC BY 4.0". No Discover Uni search links.

## J. Make proceeding obvious
- Every tap-to-continue screen (finale, reveal pages) gets a visible control: a "Next" pill button bottom-right (and "Back" text button bottom-left from page 2 on), plus the progress segments. Keep tap zones too. Finale: button "See my subjects" instead of "Tap anywhere".

## K. Review
- Re-run capture at 390×844 AND 1280×800 (desktop phone-frame). Include a screenshot with a sticker tag open and with the course sheet open.
