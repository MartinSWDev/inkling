# Live Meta model calls in the game (the judges require real calls on every play)

Inkling pre-renders everything, but the hackathon needs real Meta model calls in the main flow, visible in the demo. Add three, all through Cloudflare Pages Functions (keys stay server-side as secrets), each with the current static content as the fallback so the game never breaks:

1. `/api/inkling`: Muse Spark Open on Baseten writes "your inkling" from the player's answers, streamed onto the top-3 page.
2. `/api/pal`: Muse Image draws the player's paper pal, shown on the share page.
3. `/api/student` (simulation page): Spark Open writes one new student and plays Inkling as them, live, with the raw model output in a log under the town.

Keep the existing style: Pages Functions as in `functions/api/feedback.ts` (declare the Cloudflare types inline, no new npm packages), UI in the game's paper look, sentence case, Lucide icons. Secrets: `BASETEN_API_KEY` and `MODEL_API_KEY` (I'll set them with `wrangler pages secret put`). Never log or store player data.

## A. `functions/api/inkling.ts`
POST JSON `{ top: [{name, plain}] (1-3), wildcard: {name, why} | null, answers: { takes: string[], loves: string[], typed: string[], yes: string[], really: string[], picks: string[] } }`. Cap the body at 12 KB, cap every list and string (names 80, texts 240, lists 10), 400 on anything malformed, 503 if the key is missing.
Call `https://inference.baseten.co/v1/chat/completions` with model `meta-models/muse-spark-open-1026`, `stream: true`, temperature 0.5, max_tokens 220.
System prompt (use this wording): "You write two or three short, warm sentences for a UK sixth-former who has just played Inkling, a game that suggests degree subjects. Speak to them as "you". Only use the facts given: the subjects they take, what they said yes to, and the subject cards. Say plainly how their answers connect to each of their top subjects. Never invent facts about courses, jobs, grades or universities. No bullet points, no headings, no emojis, no exclamation marks, British spelling, under 70 words. Do not call it a quiz or a test."
User message: the facts as JSON, then "Write their inkling. Then, if there is a wildcard, add one sentence starting "Your wildcard," explaining why <wildcard name> fits."
Parse the SSE lines from Baseten and re-stream only the text deltas as `text/plain; charset=utf-8` (no-store), so the browser can append as they arrive. Add a response header `x-model: meta-models/muse-spark-open-1026 via Baseten`.

## B. `functions/api/pal.ts`
POST JSON `{ paper, object, subject }`. `paper` is one of the 11 paper types from `scripts/build_characters.py` (lined, graph, manuscript, blueprint, parchment, map, watercolour, lab, legal, printout, kraft); use the same paper descriptions and the same character description as `pal_prompt()` there, with two changes: the background is "flat plain warm cream paper #F3EDE4 with a faint paper grain, nothing else, soft ground shadow" (no green key, so no cutting out is needed), and the character is "proudly holding a tiny paper-cut <object>" (sanitise `object` to letters, digits, spaces, commas, hyphens, max 80 chars).
Call `https://api.meta.ai/v1/images/generations` with `{ model: "muse-image-1.0", n: 1, size: "1024x1024", output_format: "png", tool_enablement: { enable_image_search: false, enable_web_search: false }, prompt }` and the `MODEL_API_KEY` bearer token (see `api/room.py` `post_json`). Return `{ png: data[0].b64_json, paper, model: "muse-image-1.0 (Meta Model API)" }`; 502 with `{error}` if the model fails.

## C. `functions/api/student.ts`
POST, no body. Read `/data/content.json` and `/data/subjects.json` from the site's own static assets (`env.ASSETS.fetch(new Request(origin + path))`). Make two Baseten chat calls in sequence with the same model (temperature 0.8, max_tokens 1400, streamed):
1. Persona: adapt `persona_prompt()` in `scripts/simulate_students.py` to ONE student (random seed and a random focus area from: sciences and health; arts, design and media; business, law and society; computing and engineering; humanities and languages; sport, agriculture and the outdoors; no idea yet). Fields: first_name, age, where, studying, enjoys, certainty, suits (1-3 codes from the catalogue). Return only JSON.
2. Play: `play_prompt()` from the same script, verbatim in structure, built from content.json (chips with ids and names, things and questions by id and title, pairs by id with both labels and captions, extra_names). Return only JSON.
Stream everything the model writes to the client as plain text with marker lines `@@persona`, `@@play`, `@@done`, or `@@error <message>`; the page shows this raw text as the live log.

## D. Game client: `web/src/live.ts` plus edits to `web/src/App.tsx`
- `paperFor(code)` ported from `PAPER_BY_AREA` / `paper_for()` in `scripts/simulate_students.py`, and `PAPER_NAME` (lined paper, graph paper, …) for captions.
- `answerSummary(answers, chips, things, questions, pairs)` → the facts object in A: chip names taken and loved, typed subjects, titles of things swiped yes, titles of questions swiped up, labels of pair picks. Nothing else.
- `fetchInkling(input, onText, signal)` reads the stream and calls `onText(textSoFar)`; resolves to the final text, or "" on any failure (never throws).
- `fetchPal({paper, object, subject}, signal)` → an object URL for the PNG, or null.
- In `App.tsx`, fire both once per reveal from the existing effect that pre-renders the share video (it runs when the reveal starts and has `top3`, `wildcardRow`, `surprise` and `shareKey`); key the state by `shareKey`, abort the previous controller on a new game.
- Top-3 page (`.top3wrap`, after the three cards, before `FeedbackPrompt`): a paper card `.inklingcard` with the text arriving (blinking orange caret while writing) and a small teal tag with a Sparkles icon: "Muse Spark Open is writing your inkling, live on Baseten" → "Written for you by Muse Spark Open, live on Baseten". If the call fails, render nothing (the top-3 cards already have their static text).
- Share page: put the `.phone` and a new `.palcard` side by side (`.sharepics`, flex, same width as the phone). The pal card shows a striped "drying" placeholder with three bobbing dots and "Muse Image is drawing your paper pal…", then the image and "Your paper pal, drawn live by Muse Image". Hide the card entirely if the call fails. Keep the share page fitting at 360×640 (shrink both at the existing `max-height` breakpoints).
- Add the pal to the share image (`composeRoomCanvas`): bottom-right corner on a small paper card, if it exists. Don't change the share video.

## E. Simulation client: `web/src/liveStudent.ts` plus edits to `Simulation.tsx`, `SimScene.tsx`, `simData.ts`
- `runLiveStudent(onLog, signal)`: POST `/api/student`, split the stream on the marker lines, call `onLog(textSoFar, phase)` as it arrives. When done, parse the two JSON blocks, convert the play to the game's `Answers` exactly as `to_answers()` does in `scripts/simulate_students.py` (fixed deck order; unknown ids dropped), score with `scoreAnswers` from `web/src/scoring.ts` (same inputs as `App.tsx` uses), take the top 3 with `diverseTop` from `roomRules.ts`, compute hit3/hit5/family3 against `suits`, and build a `SimStudent` (`paper` from `paperFor(suits[0])`, `dest_paper` from `paperFor(top3[0])`, `answers` summarised like the snapshot's, `live: true`).
- `simData.ts`: add `live?: boolean` to `SimStudent`.
- `SimScene.tsx`: a student with `live: true` starts walking at the scene time it was added (keep a ref of id → start time), not on the wave schedule, and doesn't count towards the "total" used for the final state.
- `Simulation.tsx`: an orange "Run a new student live" button (Sparkles icon; disabled with "Spark Open is playing…" while running) beside "Follow a random student". While it runs and after, show a dark log panel `.livelog` under the scene (monospace, max 200px, auto-scrolls) with a header "Muse Spark Open on Baseten, live" and a phase line: "Writing a new student…" → "Playing Inkling as them…" → "Done: scored in your browser, now walking to their subject" (or the error). On success, append the student to `snap.students` so they walk from the sixth form to their building, and open their student card.
- Note on the /built page's model table and the README: each of the three live calls, one line each, under a "Live during play" heading.

## F. Checks
- `npm --prefix web test` and `tsc` clean.
- Local: `npx wrangler pages dev` after a build, with a `.dev.vars` file holding the two keys (git-ignored). Play one game: the inkling text streams in on the top-3 page; the pal appears on the share page within ~20 s; failures degrade silently (test by unsetting a key). On /simulation, "Run a new student live" shows the log scrolling, then a new pal walks to a building and their card opens.
- Screenshot the top-3 page, the share page and the simulation log at 390×844 and look at them before reporting.
- Don't deploy; give me the deploy command. Add `.dev.vars` to `.gitignore`.

## G. Provider fallback (the Baseten balance can't be read from our key)
In A and C, put the chat call behind one helper `sparkChat(messages, opts)`: try Baseten (`inference.baseten.co`, `meta-models/muse-spark-open-1026`, `BASETEN_API_KEY`) first; if it returns a non-2xx status or the connection fails, retry once through the Meta Model API (`https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.3`, `MODEL_API_KEY`, same OpenAI-style streaming body). Report which one answered in the `x-model` header and, for C, as the first log line ("via Baseten (open weights)" or "via Meta Model API"). The UI tag should say "live on Baseten" only when that header says so; otherwise "live via the Meta Model API". Both are real Meta model calls, so the demo stays valid either way.
