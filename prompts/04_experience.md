# Inkling: from demo to finished product (experience, motion, share)

The game logic works. The experience doesn't: it still looks like the demo. Rebuild the front-end experience to the standard of an Apple product page / Awwwards site of the day, with Duolingo-level feedback on every action. Keep the 9:16 phone frame (full-bleed on phones, centred phone frame on desktop). Don't change scoring, room rules or data.

## 1. Design direction (the one idea)
**A pop-up book made of paper.** The room is a paper diorama, so the whole product behaves like paper: things unfold, pop up, fold away, flip and settle with a little weight. No glass, no gradients, no glow. Spend all the boldness on that paper motion; keep the UI quiet around it.

Tokens (`web/src/design/tokens.ts` + CSS variables):
- Colour, taken from the room itself:
  - `paper` #FBF6EE (sheet/UI surfaces), `ink` #2A2238 (text, plum-black, not grey-black)
  - `lilac` #C9B8E8, `peach` #F6C9A8, `sage` #B9CDB0, `butter` #F3D98B (accents, one per round)
  - Backdrop behind the phone on desktop: deep plum #1E1830 with the room's lamp glow, not flat colour.
  - No gradient washes, no drop shadows except paper shadows (see motion).
- Type: display `Fraunces` (variable; use SOFT 100, opsz high, weight 700–900, slight WONK) for the wordmark, round titles and subject names; body `Figtree` 400/600. Self-host, subset to Latin, `font-display: swap`. Type scale (px at 390 wide): 13 / 15 / 17 / 22 / 30 / 44 / 64. Sentence case everywhere; no all-caps labels, no eyebrow labels above headings, no middle-dot meta strings.
- Surfaces: UI sheets are paper cards: slightly off-white, 1px darker edge, 20px radius for sheets, 14px for chips, a soft *contact* shadow (two layers: tight 1px + wide 18px at low opacity, tinted plum), and a subtle paper-grain texture (one tiny tiled noise PNG at 4% multiply). Not identical cards everywhere: hierarchy shows through size and radius.
- Touch: 48px minimum targets; safe-area insets respected; no hover-only affordances.

## 2. Motion system (`web/src/design/motion.ts`)
Use `motion` (Framer Motion v11+) for React. Animate only transform and opacity; 60fps on a mid Android phone.
- Springs: `pop` (stiffness 520, damping 26, mass 0.8) for things arriving; `settle` (300, 30) for UI moving into place; `fold` (220, 28) for paper folding/unfolding; `flick` (700, 40) for swipes leaving.
- Paper behaviours (build once, reuse everywhere):
  - **Pop-up**: element starts rotated -90° on X from its bottom edge (lying flat), springs up to 0° with a 4% overshoot; its shadow grows from 0 as it stands.
  - **Fold-away**: reverse of pop-up, quicker (220ms).
  - **Sticker drop**: scale 0.6→1.08→1, y -40→0, rotate ±6°→its rest tilt, contact shadow spreads as it lands; a tiny 2-frame squash on landing.
  - **Card flip** (Y axis) for the wildcard and for revealing round titles.
  - **Page turn** for scene changes inside the reveal (subtle, 400ms).
- Stagger: 70ms between siblings, max 6 items before it gets slow.
- Feedback on EVERY action (Duolingo rule): chip tap = chip presses in 2px + colour fills from the tap point; heart = heart pops with 6 paper confetti flecks; swipe yes/no = stamp ("Yes" / "Not for me") fades in under the thumb while dragging, card flicks out with rotation from velocity; new object = sticker drop + soft "thwip"; progress = heat bar fills with a springy overshoot.
- Sound (small, optional): paper thwip, card flick, fold, a warm chord at the end. WebAudio, preloaded, total < 60KB. A sound toggle on the landing screen and in the top bar; default ON after the first tap (browsers block before). Haptics: `navigator.vibrate(8)` on yes/heart/sticker where supported.
- `prefers-reduced-motion`: replace movement with 150ms fades; no parallax; keep the sticker appearing (fade in place).

Architecture: one scene state machine (`web/src/flow.ts`, a reducer or XState) — `landing → unfold → intro → roundTitle(n) → round(n) → roundOutro(n) → … → finale → reveal(page) → share`. `AnimatePresence` per scene; the room is ONE persistent component that never remounts (it moves between layouts with `layout`/`layoutId`), so stickers never flash.

## 3. The flow, screen by screen
Timings are targets; tune by feel. Every screen must be fully usable before its decorative animation ends (tap-through never waits more than 300ms).

**0. Landing (clean page)**
- Paper-white page. Big `Inkling` wordmark (Fraunces 900, 64px) set slightly rotated like a cut-out, one line under it: "Not sure what to study? Find the degree subjects that fit you." Primary button "Find my subjects". Under it, small: "Takes about 3 minutes · free · no sign-up". Footer: "Built with UK course data from Discover Uni" + "How it works" link (opens a short sheet: what it does, what data, that answers stay on your phone).
- A small "Built with Meta Muse" tag pinned to the landing like a paper label (bottom of the hero, Figtree 13px, plain text in `ink` at 70%). Text only: no Meta or Muse logos unless the hackathon brand guidelines provide approved assets. Tapping it opens the "How it works" sheet, which lists what each model does: Muse Spark Open (open weights, on Baseten) wrote and reviewed the subject cards; Muse Image drew the room, stickers and card art; SAM 3.1 cut out and checked every object; Muse Image paints your room on request.
- One signature element: a flat folded paper square in the middle of the page (the closed room) that breathes very slightly (1% scale, 4s) — the only idle motion.
- Preload all room layers, stickers for the most common ~40 subjects, card art and fonts while the landing is shown.

**1. Unfold into the room (≈1.4s)**
- On "Find my subjects": text folds away; the paper square unfolds like a pop-up book: floor first, back wall rises (pop-up), side walls swing in, then furniture pops up staggered (bed, desk, chair, shelves, lamp), lamp light fades on last, window view fades in. Camera settles to the round layout.

**2. Intro card**
- A paper note pops up over the room: "Four quick rounds. Answer on gut feel — there are no wrong answers. Your room fills up with what you're into, then you'll see subjects worth exploring." Button "Let's go". (Copy says four because the game has four rounds — keep copy and the number of rounds in sync from one constant.)

**3. Round title (each round)**
- A paper tag flips in (card flip): big round number in Fraunces, title ("Your subjects", "Things you'd get stuck into", "This or that", "Big questions"), one line on how to answer. The round's accent colour tints the tag and the heat bar. Holds ~900ms or tap to skip, then folds away and the round UI rises from the bottom sheet (`settle`).

**4. Round UI**
- Layout: room on top (fills width, cropped from shelves to floor, as already fixed), controls in a bottom paper sheet. The sheet never covers floor objects; the room pans/zooms gently (max 6%) to keep the newest sticker in view.
- Round 1 chips: 2-column grid of paper chips, tap to select, heart to favourite; "Something else?" field with autocomplete; Continue appears in its own row when 3+ picked ("Pick at least 3" before).
- Rounds 2 and 4 swipe: REAL drag gestures (pointer events; drag with rotation = x/20 deg; release past 30% width or velocity > 600px/s commits; otherwise springs back). Next card peeks behind at 96% scale and lifts up when the top card leaves. Up-swipe = "Need to know" in round 4. Buttons stay in a fixed row and never move; Continue appears in a separate row above them. Keyboard ←/→/↑ on desktop. Fact flash in round 4 = a paper sticky note that pops onto the card for 2.5s.
- Round 3 pairs: two cards stacked, both visible without scrolling; tapping one presses it in, the other folds away, the next pair pops up.
- When an action earns an object, the sticker drops into the room immediately (per the room rules), with sound + haptic; a small "+1" paper flag flutters from the sticker.

**5. Round outro (on Continue)**
- Bottom sheet folds away (220ms). Room scales up to fill the screen (`settle`). Any stickers earned this round do a quick celebratory wiggle in order (stagger 120ms), heat bar segment completes with an overshoot and a chime. Short line pops on a tag: e.g. "4 things in your room so far". Then straight into the next round title. Total ≤ 2s, tap to skip.

**6. Finale**
- After round 4: sheet folds away, room fills the screen, lamp warms slightly, all stickers do one wave (stagger), the camera does a slow 3% push-in. Line: "This is your room." (no counts). Tap anywhere to see your subjects.

**7. Reveal (story-style pages, tap right/left, progress segments at top)**
- Page A — your top 3: three paper cards pop up one at a time (stagger 250ms) over the room's lower half: subject name (Fraunces 30), the "Because of…" line from their answers, and the matching sticker beside each card (the sticker in the room glows/lifts at the same time — the link between room and result is the point).
- Page B — the wildcard: a card face-down with a "?" pattern; tap to flip (card flip) → subject + "Never on a card — it scored from everything around it." Its sticker drops into the room as the flip lands.
- Page C — explore: the 4 subjects as a compact list, each with "See courses" (Discover Uni link) and "What's it like?" (one-line plain explanation from the card). No percentages anywhere.
- Page D — make it yours: window view (city/coast/campus town/countryside, day/dusk) as paper swatches; instant swap with a crossfade in the window only.
- Page E — share (below).

## 4. Share: page + 10-second video
**Share link** (`/r/<code>`): the result is encoded in the URL (subject codes, wildcard, view, room variant/palette later; base64url, no server storage, no personal data). Opening it plays the result as a page: empty room → stickers drop in one by one → top 3 cards pop up → wildcard flips → end card "Find yours" button → landing. This is the viral loop, so it must load fast (< 1.5s on 4G) and work without the game state. OG image per link: render server-side later; for now a generic OG image.

**Video (10s, 1080×1920, 30fps)** — generated in the browser from the same scene drawn to a canvas:
- 0.0–1.0s: room, empty, lamp on, wordmark small top-left.
- 1.0–5.0s: stickers drop in one by one with thwips (spread evenly).
- 5.0–8.0s: top 3 subject cards pop up, one per second.
- 8.0–9.3s: wildcard card flips.
- 9.3–10.0s: end card "What's your inkling?" + short URL.
- Record with `canvas.captureStream(30)` + `MediaRecorder` (prefer `video/mp4;codecs=avc1` where supported — Safari; else `video/webm;codecs=vp9`), audio track from the WebAudio sounds mixed via a `MediaStreamDestination`. Render in real time behind a "Making your video…" paper progress strip (10s); then `navigator.share({ files: [video], text, url })` where `navigator.canShare` allows (Instagram/TikTok/WhatsApp via the share sheet); otherwise download + copy link. Also offer "Save image" (single 9:16 still of the final frame).
- Buttons on the share page: "Share video" (primary), "Copy link", "Save image", "Paint my room" (existing capped Muse Image endpoint; shows the painted version in place when it returns).

## 5. Quality bar (definition of done)
- Feels native at 390×844 (iPhone) and 360×780 (Android): no layout shift, no scroll inside the game except long lists, safe areas respected, nothing under the home indicator.
- 60fps animations (check Performance panel; no long tasks > 50ms during rounds). Lighthouse mobile performance ≥ 90 on the landing. Total initial JS < 200KB gzip; images lazy/preloaded as described; stickers as WebP.
- Accessible: every control is a real button with a label; visible focus ring (paper-pencil outline); swipe actions also available by button and keyboard; reduced motion respected; contrast AA.
- Copy: sentence case, plain words, consistent action names (the button that says "Find my subjects" leads to the room; "Share video" produces a video). No "love/swipe/match/spark".
- Review artefacts: add a Playwright script `web/scripts/capture.ts` that plays a scripted game at 390×844 and saves a screenshot of every scene plus a screen recording (`review_out/flow.webm`) so the whole flow can be reviewed without clicking. Run it after each phase.

## 6. Build order (commit after each, run capture after each)
0. FIRST (quick win, before anything else): 
   - Real swipe gestures on the round 2 and round 4 decks as specified in section 3.4 (pointer events, drag with rotation, commit on 30% width or 600px/s, spring back otherwise, up-swipe = "Need to know" in round 4, next card peeking behind). Swiping currently does nothing — only the buttons work. Test on a touch device emulation (Chrome DevTools, iPhone 14) and with a mouse.
   - Card layout: the question/activity text must sit ON the card art, not underneath it. Full-bleed 4:3 (or 3:4) art fills the card; the text sits on a paper label pinned to the lower part of the image (paper surface, slightly rotated -1°, Fraunces 22–26px), so it stays readable on any picture without a gradient scrim. The "1 of 5" counter sits small in the top-right corner of the card on a tiny paper tab. Same treatment for the This-or-that pair cards (label on each picture).
1. Tokens, fonts, paper surfaces, motion presets, sound + haptics helpers, flow state machine.
2. Landing + unfold + intro card.
3. Round title / round UI / round outro choreography, real swipe gestures, button layout.
4. Finale + reveal pages A–D.
5. Share page, share link route `/r/<code>`, video export, image export.
6. Polish pass: timings, reduced motion, performance, accessibility, capture review.
