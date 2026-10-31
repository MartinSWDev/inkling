# Make the room instant: layered paper room + subject stickers (replaces the earlier 02)

Live room edits take minutes and cost money per player. New design: everything visual is pre-made once and the room is assembled in the browser from layers. Paper diorama is cut paper, so layers and stickers suit the style. Per-player cost should be ~zero; the only live image call is an optional "Paint my room" button.

Room = 3 layers, all 1152x2048 coordinates, positioned in % so it scales:
1. `view` — what's outside the window (swappable)
2. `room` — the halls room with the window glass transparent
3. `stickers` — one paper cut-out per subject, placed on named spots

## 1. Room layer — `scripts/build_room.py`
- Render the empty halls room once (paper diorama, `api/style.py`) with the window panes filled with flat solid magenta (#FF00FF), no reflections. Key out the magenta → `web/public/room/room.png` (RGBA); keep the frame and glazing bars opaque. If keying is messy, use SAM 3.1 ("window") for the region and key only inside its box.
- Record the window opening box in `web/public/room/layout.json`.
- Also render a few empty-room variations ONLY if cheap and consistent (skip for now).

## 2. View layer — same script
- Render 4 views (city, coast, campus town, countryside) × 2 times (day, dusk) = 8 images, as cut-paper scenes, using room.png as a style reference, sized to the window opening's aspect (render larger and crop). Save `web/public/views/<view>_<time>.webp`.
- Client swaps the view instantly (crossfade 300ms). The reveal's "Where do you see yourself studying?" page changes it; default = campus town, day.

## 3. Sticker layer — `scripts/build_stickers.py`
- For each card in `data/subject_cards.json`: Muse Image edit with room.png as the style reference: "draw ONLY this object, isolated, as a cut-paper piece in the same style, three-quarter view matching the room's camera, centred on a flat solid #00FF00 background, no shadow on the background, nothing else". Object text from the card.
- Cut-out: SAM 3.1 with `sam_labels[0]` (fallbacks allowed — it's alone in the frame) gives the box; key out the green inside it (plus despill), crop, trim → `web/public/stickers/<code>.webp` (alpha) at max 512px.
- Retry up to 2 times if SAM finds nothing or the alpha area is tiny. Concurrency 6, resumable, `--limit`/`--only`, prints the estimated cost first (~$0.01 per image).
- Size class per sticker in `web/public/stickers/stickers.json`: `{code, slot, size: small|medium|large, w, h}`. Size from slot + object (floor/large instruments/furniture = large, shelf items = small) — ask Spark Open (Baseten) in one batch call per 40 objects, or a simple heuristic if that's flaky.
- Contact sheet `sticker_out/index.html`: every sticker on a checkerboard, then 6 random rooms of 8 stickers composited for review.

## 4. Spots — `web/public/room/layout.json`
- ~16 named spots with an anchor (bottom-centre point) and max box, by slot: shelf ×3, desk ×3, wall ×3 (incl. the blank green board), bed ×3, floor ×4. Set them by looking at room.png. Include a z-order per spot (floor front spots highest).
- A sticker is scaled to fit its spot's max box (scaled by size class), bottom-anchored, with a soft CSS paper drop-shadow and a 1-2° random tilt.

## 5. Client
- Remove the live room queue and all `POST /api/room` calls from the game.
- After any swipe/tap that changes the top 8 subjects, update stickers immediately: newcomer drops in (from above, squash and settle, 250ms, small paper "thwip" optional), leaver peels off and fades. Assign spots greedily by rank within each sticker's slot; if its slot is full, use any free spot of a compatible slot (shelf↔desk, floor↔wall), else skip it.
- Preload stickers for the ~30 highest-scoring subjects as scores change. Preload all 8 views after the first round.
- Share image (9:16) is drawn on a canvas client-side from the same layers + caption.

## 6. "Paint my room" (only live image call)
- Button on the share page. Client sends the composited canvas to `POST /api/paint`; server does one Muse Image edit: "repaint as one cohesive cut-paper diorama: keep every object, its position and the window view; unify light and shadows". Returns the image; client crossfades.
- Cache by hash(sorted codes + view + time). Daily budget cap from env (`PAINT_DAILY_LIMIT`, default 300); when hit, hide the button. Simple per-IP rate limit (3/hour).

## Done when
- `python scripts/build_room.py` and `python scripts/build_stickers.py --limit 8` work; contact sheet reviewed by me; then the full sticker run.
- On a phone, the room updates within a frame of each swipe; no spinners in the rounds; view swap is instant.
- Commit after each part.
