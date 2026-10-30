# Inkling: scaffold the real app + first live room loop

You are building Inkling in this repo. Read these first:
- `prototype/demo.html` — the working single-file demo. Its rounds, copy, scoring, reveal pages and styling are the spec. Port them; don't redesign.
- `data/subject_cards.json` — 163 subject cards (object, slot, sam_labels, why_line, neighbours, keywords).
- `data/subject_profiles.json` — O*NET-derived RIASEC + work-context profile per subject.
- `data/pairs.json` — the 5 "this or that" pairs (images in `prototype/img/`).
- `scripts/image_check.py`, `scripts/style_explore.py` (STYLES["diorama"], identity(), NEGATIVE, LAYOUTS["halls"]), `scripts/anchor_test.py` — working Muse Image + SAM 3.1 calls. Reuse these exact request shapes.

## What Inkling is
A mobile-first web game for 16-18 year olds who don't know what to study at uni. Four quick rounds fill a cosy UK halls bedroom (window centre, single bed left, desk + chair right, wall shelves) with objects for subjects they lean towards. Then a Spotify-Wrapped-style tap-through reveal: subjects to explore with a "because of…" line, a surprise subject, doer vs wonderer, pick a view (city/coast/campus town/countryside), share as 9:16.
Avoid dating language anywhere ("love" + "swipe", "spark", "match").

## Stack
- `web/`: Vite + React + TypeScript, mobile-first (design for 390x844, works on desktop as a centred phone frame). No UI framework; port the demo's CSS. No Streamlit.
- `api/`: FastAPI (Python 3.11+), `uvicorn api.main:app --reload`. Reads `.env` (MODEL_API_KEY, BASETEN_API_KEY) — keys never reach the browser.
- Vite dev server proxies `/api` to FastAPI.
- Add `requirements.txt` additions and `web/package.json`; a root `README` "Run locally" section; a `Makefile` or `scripts/dev.sh` that starts both.

## API (first version)
- `GET /api/subjects` — cards + profiles merged, for the client.
- `GET /api/pairs` — pairs.json.
- `POST /api/score` — body: all answers so far. Returns ranked subjects with score, uncertainty and the top contributing answers (for "because of…"). Move the demo's scoring to Python, but now over the real 163 subjects: school-subject chips + hearts, swipe answers (direct card weights), pairs (RIASEC/work-context via subject_profiles), big-question answers. Neighbours get a small nudge. Keep it a pure function with unit tests in `api/tests/`.
- `GET /api/next-cards?round=...` — adaptive card picking: prefer high-score, high-uncertainty subjects not yet shown (Thompson-style sample), mixed with some exploration.
- `POST /api/room` — body: `{"room_id": str|null, "add": [subject_code, ...]}`. The live loop below. Returns `{room_id, image_url, placed: [{code, box}], failed: [code]}`.

## The live room loop (the important bit — get this working end to end)
House style is **paper diorama**: use `STYLES["diorama"]` via `identity()` and `NEGATIVE` from `scripts/style_explore.py` (import them or copy into `api/style.py`), with `LAYOUTS["halls"]`.
1. **Base room**: once, generate an empty halls room in the diorama style with Muse Image (`muse-image-1.0`, `/v1/images/generations`, size `1080x1920` → 9:16 portrait, `output_format: png`, `tool_enablement` search off). Cache to `api/cache/base.png`. Keep one base per window view later; for now one.
2. **Add objects**: for each new subject, call `/v1/images/edits` with the current room image as the reference and a JSON prompt: visual_identity, the card's `object`, where it goes from its `slot` (shelf = wall shelves above desk, desk = on the desk, wall = on the wall beside the window, floor = on the floor by the bed or desk, bed = lying on the duvet), "keep everything else in the room exactly the same". Add up to 2 objects per edit.
3. **Verify with SAM 3.1** (`sam-3.1`, `/v1/responses`, image as a base64 data URL in `input_image.image_url`, one short noun phrase per call, `metadata={"include_confidence": "true"}`; parse the `<|box;...|>` tokens like `parse_sam` does). Try `sam_labels[0]` first; only accept a fallback label if its box centre lies in the expected slot region (define rough regions for the 9:16 halls layout). Confidence >= 0.5.
4. If an object isn't found, retry that edit once; then report it in `failed`. Store each room version and the boxes in `api/cache/rooms/<room_id>/` (step images + `room.json`). Serve images from `/api/rooms/<id>/<file>`.
5. The boxes are used by the front end to pop each new object in (scale/glow on the SAM box) as the room updates — a cheap "animation" from stills.

Do the image calls asynchronously; the client shows the current room while the next version renders, then crossfades.

## Front end
Port the demo screens: intro, round 1 chips (with hearts, "Something else?" typed input), round 2 swipe deck, round 3 pairs, round 4 big questions (right/left/up + fact flash), per-round heat bar, then the reveal pages. Replace the demo's SVG room with the live room image from `/api/room`, calling it after each round with the newly top-ranked subjects (max ~8 objects total). Keep the demo's SVG room as a fallback if the API fails.

## Done when
- `scripts/dev.sh` starts both; on a phone-sized browser I can play all 4 rounds with real subjects and watch the room fill with real Muse Image renders, SAM-verified, then reach the reveal.
- Scoring has tests. No keys in the client bundle. `.gitignore` covers `api/cache/`, `web/node_modules/`, `web/dist/`.
- Commit in small steps with clear messages.

Work in this order: API skeleton + /subjects → room loop (test it from a script first: `python -m api.room_demo CAH07-01-01 CAH25-02-02`) → scoring + tests → web port → wire the room in. Ask me before changing data files.
