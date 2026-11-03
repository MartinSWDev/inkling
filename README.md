# inkling

A mobile-first web game that helps 16-18 year olds discover UK degree subjects: four quick rounds fill a halls bedroom with objects, then a tap-through reveal suggests subjects to explore.

## Run locally

Needs Python 3.11+ and Node 20+. Keys live in `.env` (`MODEL_API_KEY`, `BASETEN_API_KEY`) and never reach the browser.

```sh
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cd web && npm install && cd ..
sh scripts/dev.sh
```

Open http://127.0.0.1:5173 in a browser (phone-sized is the design target). The game itself is fully static: content and subjects are exported to `web/public/data/*.json` by `scripts/export_static_data.py` (run automatically by `npm --prefix web run build` via the `prebuild` script, reusing `api/main.py`). The FastAPI app remains for local dev and tests only.

Tests: `.venv/bin/python -m pytest api/tests/ -q`. Room loop check: `.venv/bin/python -m api.room_demo CAH07-01-01 CAH25-02-02`.

## Deploy

The production site is static (Cloudflare Pages, no server): `web/dist` is the whole deploy, with SPA fallback in `web/public/_redirects` and cache/security headers in `web/public/_headers`.

First time:

```sh
npx wrangler login
npx wrangler pages project create inkling --production-branch main
```

(`npx wrangler login` opens the browser — run it yourself.)

Each deploy:

```sh
npm --prefix web run build && npx wrangler pages deploy web/dist --project-name inkling
```

Custom domain: Cloudflare dashboard → Workers & Pages → inkling → Custom domains → add `www.findyourinkling.com` (and `findyourinkling.com` redirecting to it). DNS is automatic because the domain is on Cloudflare.

Optional: enable Cloudflare Web Analytics for the project (cookie-free) to count plays and shares.

## Feedback

After the top 3, Inkling asks “Does this feel like you?” with thumbs up / thumbs down. Votes are stored anonymously in Cloudflare D1 to re-tune scoring weights.

What is stored: `game_id` (random per game, not per person), `kind` (`vote` or `off`), `vote` (`up` | `down`), `off_code` (subject code or `all`), `top` (JSON array of up to 3 subject codes), `wildcard` (subject code or null), `answers` (JSON), `app_version`, `created_at`.

What is not stored: names, accounts, cookies, IP addresses, user agents, request headers.

Setup:

```sh
npx wrangler d1 create inkling-feedback          # copy the database_id into wrangler.toml
npx wrangler d1 execute inkling-feedback --remote --file db/feedback.sql
npm --prefix web run build && npx wrangler pages deploy
npx wrangler d1 execute inkling-feedback --remote --command "SELECT vote, COUNT(*) FROM feedback WHERE kind='vote' GROUP BY vote"
```

Note that `wrangler pages deploy` now reads `wrangler.toml` and must be run from the repo root so `functions/` is included.

## Data attribution

Contains public sector information licensed under the Open Government Licence v3.0. Apprenticeship standards © Skills England.
