# 23 · "Your inkling" gets its own page

The live inkling text and paper pal currently render as an absolutely-positioned `.pc` card inside `.top3wrap`, so it sits on top of the "Your top 3" heading and first card. Move both onto a dedicated page in the reveal flow. Read `web/src/App.tsx` (reveal `pages` block ~line 722–800, live effect ~line 440), `web/src/styles.css` (`.pc`, `.top3wrap`, `.palcard`), `web/src/live.ts`, `functions/api/inkling.ts`. Keep everything else as it is.

## A. New reveal page, after the top 3

Reveal pages today: 0 top 3, 1 wildcard, (2 hands-on if practical), views, explore, share. Insert **page 1 = "Your inkling"** and shift the rest by one (`viewsPage`, `explorePage`, `sharePage`, `pageCount` all derive from this; the progress dots, Next/Share button labels and `REVEAL_NEXT/PREV` must keep working with `last: explorePage`).

Markup, one full-height paper card, nothing absolutely positioned inside it:

```
<div class="page"><div class="pc bottom inklingpc">
  <p class="eyebrow">Your inkling</p>
  <div class="inklinghero">
    <figure class="palframe">            <!-- always rendered, fixed aspect 1:1 -->
      <img src={pal url} />              <!-- when ready -->
      <div class="palshimmer" />         <!-- while waiting -->
      <figcaption>Drawn live by Muse Image</figcaption>   <!-- only when ready -->
    </figure>
    <div class="inklingtitle">
      <img class="stick" src="/stickers/{top3[0].code}.webp" />
      <h2>{top3[0].display_name}</h2>
      <p class="note">{plainOf(top3[0].code)}</p>
    </div>
  </div>
  <div class="inklingtext">
    <p>{text}<span class="inklingcaret"/></p>    <!-- streaming -->
    <div class="skeleton"><i/><i/><i/></div>     <!-- while no text yet: three shimmering lines -->
  </div>
  <p class="inklingtag"><Sparkles/> {status line}</p>
</div></div>
```

Remove the `.inklingcard` block from `.top3wrap` and the `.palcard` block from the share page (`.sharepics` goes back to the room `.phone` only; keep `composeRoomCanvas(..., palUrl)` for the share image exactly as now).

Status line:
- waiting, no text: `Muse Spark Open is thinking…` with the three dots animated by **CSS** (`@keyframes` cycling opacity on three `<i>`), not by heartbeat ticks. Keep `onThinking` wired but the loader must look alive even if no ticks arrive.
- streaming: `Muse Spark Open is writing…`
- done, provider baseten: `Written for you by Muse Spark Open (a Meta model, live on Baseten).` ; provider meta: `Written for you by Muse Spark (a Meta model, live via the Meta Model API).`
- call failed (empty text when done): hide `.inklingtext` and the tag; the page still shows the hero so it is never blank. If the pal fails, hide `.palframe` and let the title take the full width.

CSS (`styles.css`): `.inklingpc{max-height:92%;gap:12px}` `.inklinghero{display:grid;grid-template-columns:min(40%,150px) 1fr;gap:12px;align-items:center}` `.palframe{margin:0;aspect-ratio:1;border-radius:12px;overflow:hidden;background:var(--paper);border:1px solid var(--line);box-shadow:var(--paper-shadow);position:relative}` `.palframe img{width:100%;height:100%;object-fit:cover;display:block}` `.palshimmer,.skeleton i{background:linear-gradient(90deg,#f3ecdf 25%,#faf5ec 50%,#f3ecdf 75%);background-size:200% 100%;animation:shimmer 1.4s linear infinite}` `.palshimmer{position:absolute;inset:0}` `.skeleton{display:grid;gap:8px}.skeleton i{display:block;height:14px;border-radius:7px}.skeleton i:last-child{width:60%}` `@keyframes shimmer{to{background-position:-200% 0}}` `.inklingtitle h2{font-family:var(--display);font-weight:900;font-size:26px;line-height:1.05;margin:4px 0 2px}` `.inklingtitle .stick{width:48px;height:48px;object-fit:contain}` `.inklingtext p{font-size:16px;line-height:1.5;margin:0;white-space:pre-wrap}` `.inklingtag{font-size:12.5px;color:var(--muted);display:flex;gap:6px;align-items:center}` `.inklingtag i{animation:blink 1.2s infinite}.inklingtag i:nth-child(2){animation-delay:.2s}.inklingtag i:nth-child(3){animation-delay:.4s}@keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}`. Respect `prefers-reduced-motion` (no animation). Must fit a 390×700 viewport without the page scrolling: shrink the pal column to 110px under `@media(max-height:700px)`.

## B. The text is about the one subject

Change `SYSTEM` in `functions/api/inkling.ts` to:

"You write a short, warm note for a UK sixth-former who has just played Inkling, which suggests degree subjects. Speak to them as "you". Their inkling is the first subject in "top". Write two sentences about how their answers point to that subject, using only the facts given: the subjects they take, what they said yes to, and the card text. Then one sentence that mentions the other top subjects by name as also fitting. Never invent facts about courses, jobs, grades or universities. No bullet points, headings, emojis or exclamation marks. British spelling. Under 60 words. Do not call it a quiz or a test."

Keep the wildcard sentence instruction in the user message as now. Keep validation, headers, heartbeat, fallback unchanged.

## C. Pal call timing

The pal fetch starts when the reveal begins (page 0), as now, so it is usually ready by the time the player taps Next. Keep that. Do not start it again when the page changes.

## D. Checks

- `npm --prefix web run build`, `npm --prefix web test` pass (update `flow.test.ts` if it counts reveal pages).
- `npx wrangler pages dev web/dist`: play through; page 0 shows the top 3 and the feedback card with nothing over them; Next → "Your inkling" page shows the pal frame shimmering, skeleton lines, animated dots, then the pal and streamed text; the share page shows only the room preview.
- Check at 390×700 (DevTools device toolbar) that the inkling page does not overflow.

Report: files changed and a one-line description of what the inkling page looked like at 390×700.
