# 26 · Start the live calls earlier, show the inkling page last

By the time a player reaches the "Your inkling" page (reveal page 1) neither the pal image nor the text has arrived: Spark Open reasons for 20–40 s before writing, and Muse Image can take longer. Two changes in `web/src/App.tsx` (live effect ~line 440; reveal pages ~line 722 onwards; `top3`/`wildcardRow` ~line 397) and `web/src/live.ts`. Nothing else.

## A. Kick off both calls at the finale, not at the reveal

`top3`, `wildcardRow` and `answersRef` are already computed from the final answers when the scene becomes `finale` (the "This is your room." moment). Change the live effect's guard so it runs when `scene.kind` is `"finale"`, `"reveal"` or `"share"` (first of those wins; `liveKeyRef` already stops re-runs). Everything else in the effect stays. Result: the calls start ~10–15 s earlier, during the room build and the finale card.

## B. Move the inkling page to just before Share

Reveal order becomes: 0 top 3, 1 wildcard, (2 hands-on if practical), views, explore, **inkling**, share. So `inklingPage = explorePage + 1`, `sharePage = inklingPage + 1`, `pageCount = sharePage + 1`. The Next button reads "Next" on every page up to explore, "Your inkling" on the explore page, and "Share" on the inkling page (`page === inklingPage ? "Share" : page === explorePage ? "Your inkling" : "Next"`). `REVEAL_NEXT`/`REVEAL_PREV` keep using `last: inklingPage` wherever they used `last: explorePage` so Share still follows the last page, and `share` → Back returns to the inkling page. Update every reference; search for `explorePage` and `sharePage`.

## C. Timeouts so a slow call never blocks the page forever

In `live.ts`: `fetchInkling` aborts its own fetch after 90 s and resolves `{ text: "", provider: null, model: null }` (do not abort the caller's signal); `fetchPal` aborts after 120 s and resolves `null`. On the inkling page, after the text has failed or timed out, show the hero and, in place of the text, one line: "Your inkling is {top subject}." (the plain description is already in the hero) so the page is never empty.

## D. Checks

- `npm --prefix web run build`, `npm --prefix web test` pass.
- Play through under `npx wrangler pages dev web/dist`: Network tab shows `/api/inkling` and `/api/pal` start while "This is your room." is on screen; the inkling page is the one before Share and its Next button says "Share"; Back from Share returns to it.
Report the files changed and roughly how many seconds before reaching the inkling page the calls now start in your run.
