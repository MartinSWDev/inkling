# Deploy to www.findyourinkling.com (Cloudflare Pages, static, no server)

Goal: the whole app runs as static files — no FastAPI in production — so it's free and survives a viral spike. Do A–D, then stop and tell me the exact commands for E (the Cloudflare login and deploy are mine to run).

## A. Remove the runtime API
The client still calls /api/content and /api/subjects (web/src/api.ts). Replace with static JSON generated at build time:
- New scripts/export_static_data.py: writes web/public/data/content.json (exactly what /api/content returns now: cards, profiles, decks, pairs, merged aliases incl. subject_aliases_extra.json) and web/public/data/subjects.json (what /api/subjects returns). Reuse the functions in api/main.py so the output is identical; add a pytest that compares them.
- web/src/api.ts fetches /data/content.json and /data/subjects.json. Remove every other /api call from the client (Paint my room is already gone; /api/score is test-only). grep to confirm nothing in web/src references /api/ or localhost:8000.
- Add an npm script "prebuild" (or document a step) that runs the export so a fresh `npm --prefix web run build` always has current data. Keep FastAPI for local dev/tests only.

## B. Static hosting files (in web/public/)
- _redirects: `/*  /index.html  200` so /simulation, /built and /r/<code> work on refresh and when shared.
- _headers:
  - `/assets/*`, `/stickers/*`, `/characters/*`, `/cards/*`, `/views/*`, `/room/*`, `/sim/buildings/*`, `/img/*`: `Cache-Control: public, max-age=31536000, immutable` (only if filenames are hashed or never change; otherwise max-age=86400)
  - `/data/*`, `/sim/snapshot.json`, `/subjects/*`: `Cache-Control: public, max-age=3600`
  - `/*`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Check every file is under Cloudflare Pages' 25 MiB per-file limit and the total file count is well under 20,000; list the 10 largest files and convert any big PNG that's only displayed (room.png/room_tall.png) to WebP if it's not already used as WebP.

## C. Share-ready metadata
- index.html: proper <title> "Inkling — find the degree subjects that fit you", meta description, theme-color, favicon set (from the mini room or a pal), apple-touch-icon, and Open Graph + Twitter card tags pointing to https://www.findyourinkling.com/og.png.
- Make og.png (1200×630): the finished room with a few stickers and pals, the "Inkling" wordmark and "What's your inkling?" — render it with the existing canvas composer or Playwright from a static HTML page; commit it to web/public/og.png.
- All absolute URLs use SHORT_DOMAIN "www.findyourinkling.com" over https.

## D. Production checks (locally)
- `npm --prefix web run build` then serve web/dist with a plain static server (no API running) and play the full game at 390×844 and desktop: content loads, rounds work, reveal, course sheets, apprenticeship tab, simulation page, share page all work with NO backend. Refresh on /simulation and on a /r/<code> link works (vite preview + the _redirects rule, or a static server with SPA fallback).
- Lighthouse mobile on the landing page (report the Performance/Accessibility scores) and fix anything obvious (unused JS, unsized images).
- Commit.

## E. Tell me the deploy commands (don't run login yourself)
Write a short "Deploy" section in README.md with:
1. First time: `npx wrangler login` (opens the browser), then `npx wrangler pages project create inkling --production-branch main`.
2. Each deploy: `npm --prefix web run build && npx wrangler pages deploy web/dist --project-name inkling`.
3. Custom domain: Cloudflare dashboard → Workers & Pages → inkling → Custom domains → add www.findyourinkling.com (and `findyourinkling.com` redirecting to it). DNS is automatic because the domain is on Cloudflare.
4. Optional: enable Cloudflare Web Analytics for the project (cookie-free) to count plays and shares.
