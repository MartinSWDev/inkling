# 24 · Make the live student visible and robust

The live student on `/simulation` works but reads as a wall of JSON after a long static wait, and one run failed. Read `web/src/Simulation.tsx` (Run a live student block, ~line 160–180, `runLivePhase`, `liveLog`), `web/src/simData.ts` (`runLiveStudent`, ~line 145), `web/src/sim.css`, `functions/api/student.ts`, `functions/api/_spark.ts`. Keep the `@@persona/@@play/@@done/@@error` protocol; add to it, do not change existing markers.

## A. Server: progress while the model reasons, and one retry

In `functions/api/student.ts`:
1. Before each model call write a status marker line: `@@status writing persona` then `@@status playing the game`, and `@@status scoring` just before `@@done`.
2. While a call is in its reasoning phase (deltas with `reasoning` but no `content`), write `@@think N` once per second where N is the running count of reasoning deltas for that call. Stop when the first `content` arrives. Never forward the reasoning text.
3. When extracting JSON from either answer, first strip Markdown fences (```json … ```) and anything before the first `{` / after the last `}`. If parsing still fails, **retry that one call once** with an extra user message: "Your last answer was not valid JSON. Return only the JSON object." Write `@@status retrying` before the retry. Only after the second failure emit `@@error the model did not return valid JSON`.
4. `@@error` messages must be plain English, lower case, no stack text.

## B. Client: a readable log, not raw JSON

In `simData.ts` `runLiveStudent`, parse the stream incrementally and call a new `onEvent(e)` instead of dumping chunks, where `e` is one of:
`{kind:"status", text}`, `{kind:"think", n}`, `{kind:"persona", persona}`, `{kind:"play", play}`, `{kind:"scored", top3: string[], suits: string[], hit: boolean}`, `{kind:"error", text}`. Keep `onLog` for the raw text (used by the raw toggle below).

In `Simulation.tsx`, replace the single `<pre class="livelog">` with a `.livefeed` list that grows as events arrive, each row with a small icon and a timestamp (mm:ss since the click):

- status → `Muse Spark Open is writing a persona…` / `…is playing the four rounds as this student…` / `Scoring with the real Inkling code…` / `Retrying…` with three CSS-animated dots on the latest row.
- think → update the latest status row's right side to `thinking · 12 s · 840 reasoning tokens` (seconds from a client timer, tokens from N). Do not add a new row per tick.
- persona → a card row: **{first_name}, {age}, {where}** · takes {studying} · one line of `enjoys` · `Would suit: {suits as subject names}` (resolve codes with the subjects list already loaded).
- play → one row per round: `Round 1 · takes Maths ♥, Physics ♥, Computing ♥, also Design & Technology`; `Round 2 · yes to 7 of 18`; `Round 3 · picked …`; `Round 4 · yes to 3, "tell me more" on 1`. Use the names from the loaded content, not ids.
- scored → `Top 3: A, B, C` then `✓ A fitting subject made the top 3` or `✗ None of their suited subjects made the top 3` (this is the honest result; show misses too).
- error → the message in a red-tinted row with a **Try again** button that reruns.

Below the feed: a `Show raw model output` toggle (`<details>`) containing the existing raw `<pre>`; collapsed by default. The provider line (`Live student · Muse Spark Open on Baseten` / `…via the Meta Model API`) stays above the feed.

## C. Put the student on the map

When the live student is added:
1. Give them a `live: true` flag (exists) and render them with a pulsing ring and a small `LIVE` tag above the sprite, visible at every zoom, for the whole walk.
2. Immediately call the existing follow logic (`followRandom` uses it) on the live student so the camera tracks them, and open their story card as it does now.
3. Add a `Watch {first_name} walk` button in the feed's scored row that re-follows them if the user clicked away.
4. If the batch replay has finished (all arrived), the live student must still walk the full path from Sixth form at 1× speed; do not spawn them already arrived.

## D. CSS (`sim.css`)

`.livefeed{display:grid;gap:6px;margin-top:10px;font-size:14px}` `.livefeed>div{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:start;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--paper)}` `.livefeed .time{color:var(--muted);font-variant-numeric:tabular-nums;font-size:12px}` `.livefeed .err{background:#fbe9e7;border-color:#e8b4ad}` `.livefeed .ok{color:#2e7d4f}` `.livefeed .miss{color:#a3452c}` dots animation same as `.inklingtag i` in styles.css (reuse the keyframes). `.sim-live-ring` pulse: `box-shadow:0 0 0 0 rgba(229,154,44,.7)` → `0 0 0 14px rgba(229,154,44,0)` over 1.4 s infinite; `.sim-live-tag{font:600 10px/1 var(--body);background:#E59A2C;color:#2A2238;border-radius:999px;padding:3px 6px;letter-spacing:.04em}`. Respect `prefers-reduced-motion`.

## E. Checks

- `npm --prefix web run build` and `npm --prefix web test` pass; add a test for the stream parser in `simData.test.ts`: feed a fixture stream with `@@status`, `@@think`, fenced JSON persona, play, done, and assert the event sequence.
- `npx wrangler pages dev web/dist` → `/simulation` → Run a live student: feed shows writing → thinking timer → persona card → four round rows → scored row; the student appears with the LIVE tag, the camera follows them, they walk to their building. Run it twice. Report whether either run hit the retry or error path, with the message.
