# 32 · /built: tell it in the order the video does

Rewrite the section order and copy of `web/src/Built.tsx` (and `built.css` where a new block needs styling). Keep the existing components and data hooks (`cal`, `heldBefore/After`, the PALS header, model cards' bullet lists, the timeline, the data credits, the country table). Keep every number as it is. Fix the contradictions listed at the end. Use the exact copy below where given; where a section says "keep", keep its content but tighten any sentence that contradicts the new facts.

## New order and copy

**Header**
- h1: `How Inkling was built`
- lede: `One developer, nine days, and Meta's models doing two jobs: they built the game, and they run live inside it.`

**1. The problem** (new `simcard`)
`I build university websites. Their main job is getting students to pick a course from a huge catalogue, and they assume you already know what subject you want. Many don't: in the 2026 cycle 344,760 UK school leavers applied by the 30 June deadline, and among graduates aged 25 to 30, 27% would pick a different course or university with hindsight. Inkling helps you find the inkling you already have, then explore real options from there.`
Keep the two source links from the README (UCAS; The Benefits of Hindsight, Bristol/HEPI/Advance HE 2025) as inline links.

**2. What happens when you play** (new `simcard`, an ordered list; each item has a bold lead and, where a model is involved, a small pill at the end naming it)
1. **Four quick rounds.** What you take (type anything, it understands), things you'd get stuck into, this or that, big questions. Every pick lands as a paper object in your room.
2. **Your room.** Tap any object to see which subject it stands for.
3. **Your top 3, plus a wildcard** you'd never have gone looking for. Scoring runs in the browser; no model is involved. `pill: Inkling scoring`
4. **Real UK courses and apprenticeships.** By city, coast, campus town or countryside; the apprenticeships closest to each subject. `pill: Discover Uni · Skills England`
5. **Your inkling, written live.** Muse Spark reads your answers and says why your top subject fits, while Muse Image draws your paper pal. Both start the moment your room is built so they are usually waiting for you. `pill: Muse Spark 1.2 · Muse Image · live`
6. **Share.** A ten-second video of your room, or your inkling as a card.

**3. Built it. Runs live in it.** Two short columns (reuse `model-grid` styling, two cards):
- *Built it, before launch*: Muse Spark Open wrote and reviewed every subject card · Muse Image drew the paper world · SAM 3.1 checked every sticker · Muse Code helped build it.
- *Runs live in it*: Muse Spark writes your inkling (Meta Model API) · Muse Image draws your paper pal · Spark Open writes and plays new simulated students (Baseten). Each live call has a fallback provider and degrades silently; the game never depends on it.

**4. What each Meta model did** — keep the four model cards and their bullets, with these fixes:
- Muse Spark Open card first line: replace `All text work ran once as batch jobs. No AI calls happen while you play.` with `All the content work ran once as batch jobs before launch. The same model also plays new simulated students live on the simulation page.`
- Add a fifth card, **Muse Spark — the live voice**: `muse-spark-1.2 via the Meta Model API · live`. Body: `Writes your inkling at the end of every game: two sentences on why your top subject fits, one naming the others, a wildcard line when you have one. Falls back to Spark Open on Baseten if the Meta API is unavailable. 5 seconds to first word in testing, against 20 to 40 for the reasoning model.`
- Muse Image card: add a bullet `Draws your paper pal live on the inkling page, and it goes on your share card.`

**5. Testing it before real students: the simulation** — keep the current "Testing it properly" section as is, retitled, plus one closing paragraph: `You can run a new one yourself: "Run a live student" on the simulation page has Spark Open write a student, play every round as them, and the real scoring code walk them to their building, with the model's progress shown as it happens.`

**6. Why open weights** — keep, but replace the second paragraph with: `The game itself plays with no model calls; the three live touches (your inkling, your pal, live students) are extras that degrade silently, so the core stays free at any scale.`

**7. The data underneath** — keep.

**8. Build journey** — keep; update the commit count from `git rev-list --count HEAD` at build time (hard-code the current number in the copy).

**9. What's next** — keep.

**Footer** — add links: demo video `https://youtu.be/GkDJKz8-Weg`, the X thread `https://x.com/MartinSWDev/status/2118059722070790600`, GitHub (existing).

## Contradictions to remove
- Any sentence saying no AI calls happen while you play.
- "Your inkling (Muse Spark Open, on Baseten) … on the share page" → it is Muse Spark 1.2 on the Meta Model API, on its own page before Share.
- "Your paper pal … on the share page" → on the inkling page and the share card.
- Remove the old "Live during play" section entirely (its content now lives in sections 2, 3 and 4).

## Checks
`npm --prefix web run build` and `npm --prefix web test` pass; the page reads top to bottom at 390px and 1280px without horizontal scroll; the new ordered list and the two-column card look right in both. Report files changed.
