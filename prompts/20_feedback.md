# Feedback: "Does this feel like you?" (anonymous, stored in Cloudflare D1)

Goal: after the top 3, ask "Does this feel like you?" with thumbs up / thumbs down. Store the vote with the answers and result so the scoring weights can be re-tuned on real students later. Everything is anonymous: no names, accounts, cookies, IP addresses or user agents are stored.

Make ONLY the changes below. Keep every other line of every file exactly as it is.

## 1. `db/feedback.sql` (new)
```sql
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  game_id TEXT NOT NULL,          -- random per game, not per person
  kind TEXT NOT NULL,             -- 'vote' or 'off'
  vote TEXT,                      -- 'up' | 'down' (kind = vote)
  off_code TEXT,                  -- subject code that felt wrong, or 'all' (kind = off)
  top TEXT NOT NULL,              -- JSON array of up to 3 subject codes, in order
  wildcard TEXT,                  -- subject code or NULL
  answers TEXT NOT NULL,          -- JSON of the Answers object
  app_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_game ON feedback(game_id);
```

## 2. `wrangler.toml` (new, repo root)
```toml
name = "inkling"
pages_build_output_dir = "web/dist"
compatibility_date = "2026-10-01"

[[d1_databases]]
binding = "DB"
database_name = "inkling-feedback"
database_id = "REPLACE_WITH_ID_FROM_wrangler_d1_create"
```

## 3. `functions/api/feedback.ts` (new, repo root, Cloudflare Pages Function)
- Export `onRequestPost` only (other methods get Cloudflare's default 405).
- Reject bodies over 20000 bytes with 413 (check `content-length` and the text length).
- Parse JSON. Validate, returning 400 with `{ "error": "..." }` on any failure:
  - `game_id`: string, 8–64 chars, only `[A-Za-z0-9-]`.
  - `kind`: `"vote"` or `"off"`.
  - if `kind === "vote"`: `vote` is `"up"` or `"down"`.
  - if `kind === "off"`: `off_code` is `"all"` or a subject code.
  - `top`: array of 0–3 subject codes. `wildcard`: subject code or null.
  - Subject code pattern: `/^CAH\d{2}-\d{2}-\d{2}$/`.
  - `answers`: an object (store `JSON.stringify(answers)`).
  - `app_version`: string up to 32 chars.
- Insert one row with a prepared statement: `env.DB.prepare("INSERT INTO feedback (game_id, kind, vote, off_code, top, wildcard, answers, app_version) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)").bind(...).run()`.
- Return `new Response(null, { status: 204 })`. On a database error return 500 with `{ "error": "store failed" }`. Never log or store request headers or the IP.
- Type the env as `{ DB: D1Database }` and the handler as `PagesFunction<{ DB: D1Database }>`. Do not add any npm packages.

## 4. `web/src/feedback.ts` (new)
```ts
export const APP_VERSION = "2026-11-03";
export type Vote = "up" | "down";
export function newGameId(): string { /* crypto.randomUUID() if available, else 16 random hex chars from crypto.getRandomValues */ }
export function feedbackPayload(o: { gameId: string; kind: "vote" | "off"; vote?: Vote; offCode?: string; top: string[]; wildcard: string | null; answers: unknown }) {
  /* returns the JSON body described in section 3, with app_version: APP_VERSION */
}
export async function sendFeedback(body: ReturnType<typeof feedbackPayload>): Promise<boolean> {
  /* POST to "/api/feedback" with keepalive: true and content-type application/json.
     Resolve true on 2xx, false on any error. Never throw (local dev has no endpoint). */
}
```
Add `web/src/feedback.test.ts` (vitest) checking that `feedbackPayload` keeps at most 3 top codes, sets `app_version`, and that `newGameId()` returns 8–64 chars of `[A-Za-z0-9-]`.

## 5. `web/src/FeedbackPrompt.tsx` + `web/src/feedback.css` (new)
Props: `{ gameId: string; top: { code: string; name: string }[]; wildcard: string | null; answers: unknown }`.
- State: `"ask" | "thanks" | "which" | "done"`.
- `ask`: a small paper card (match the existing `.pc` look: `var(--paper)` background, `1px solid var(--line)`, radius 16px, `var(--paper-shadow-sm)`), title "Does this feel like you?" in `var(--display)`, two round 52px icon buttons using lucide-react `ThumbsUp` and `ThumbsDown` with `aria-label`s "Yes, it feels like me" and "No, not really". Under them, a 12px muted line: "Anonymous: sends your vote, answers and result. No names or accounts."
- Tapping thumbs up: send `kind: "vote", vote: "up"`, show "Thanks, that helps tune Inkling." (state `thanks`).
- Tapping thumbs down: send `kind: "vote", vote: "down"`, then show "Which one felt off?" with one chip per top-3 subject name plus "All of them" and a "Skip" text button (state `which`). Picking one sends `kind: "off"` with that code (or `"all"`), then shows the thanks line. Skip goes straight to thanks.
- Once voted it never asks again for this game (state lives in App per game; see below).
- `feedback.css` is imported by the component. Everything fits at 360px wide with no horizontal overflow, and buttons are at least 44px.

## 6. `web/src/App.tsx` (two small edits only)
- Create a per-game id: `const [gameId, setGameId] = useState(newGameId);` and in the existing `restart()` function, call `setGameId(newGameId())`.
- On the top-3 page, directly after the `{top3.map(...)}` cards inside `<div className="top3wrap">` and before the `{!top3.length && ...}` line, render:
  `{top3.length > 0 && <FeedbackPrompt key={gameId} gameId={gameId} top={top3.map((r) => ({ code: r.code, name: r.display_name }))} wildcard={surprise} answers={answersRef.current} />}`
- Change the share page heading text `What's your inkling?` to `Find your inkling.`
- Add the imports. Change nothing else.

## 7. Wording: "Find your inkling"
- `web/src/share.ts`: in `shareMessage`, `What's your inkling? ${HOME_URL}` becomes `Find your inkling: ${HOME_URL}`. In the video end card, `"What's your inkling?"` becomes `"Find your inkling."`.
- `web/src/ShareReplay.tsx`: `What's your inkling?` becomes `Find your inkling.`

## 8. README: add a "Feedback" section
How it works, what is stored (and what is not), and the commands:
```
npx wrangler d1 create inkling-feedback          # copy the database_id into wrangler.toml
npx wrangler d1 execute inkling-feedback --remote --file db/feedback.sql
npm --prefix web run build && npx wrangler pages deploy
npx wrangler d1 execute inkling-feedback --remote --command "SELECT vote, COUNT(*) FROM feedback WHERE kind='vote' GROUP BY vote"
```
Note that `wrangler pages deploy` now reads `wrangler.toml` and must be run from the repo root so `functions/` is included.
