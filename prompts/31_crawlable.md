# 31 · Make the site readable without JavaScript (SEO / LLM search)

Small, static-only change. Files: `web/index.html`, new `web/public/llms.txt`, new `web/public/robots.txt` (only if none exists), `README.md`. No app code changes.

1. `web/index.html` `<head>`: make sure these exist (replace any existing equivalents):
   - `<title>Inkling — find the degree subjects that fit you</title>`
   - `<meta name="description" content="Inkling is a free game that helps UK school leavers find the degree subjects that fit them. Four quick rounds of cards, then your top 3 subjects, a wildcard, real UK courses and apprenticeships. No sign-up.">`
   - Open Graph and Twitter card tags (title, description, `og:image` = `https://www.findyourinkling.com/og.png`, `og:url`, `twitter:card` = `summary_large_image`).
   - `<link rel="canonical" href="https://www.findyourinkling.com/">`
   - A JSON-LD `<script type="application/ld+json">` of type `WebApplication`: name Inkling, url, description (same as above), applicationCategory "EducationalApplication", operatingSystem "Any", isAccessibleForFree true, offers price 0 GBP, author Person "Martin" with url `https://github.com/MartinSWDev`, `sameAs` [`https://x.com/MartinSWDev/status/2118059722070790600`, `https://github.com/MartinSWDev/inkling`, `https://youtu.be/0AtiOCTx2ow`].
2. `web/index.html` `<body>`, inside the root div (so it is replaced when React mounts) or in a `<noscript>` block: a short plain-HTML description a crawler without JS can read: an `<h1>Inkling</h1>`, two sentences on what it does, a list of the Meta models used (Muse Spark Open on Baseten; Muse Spark; Muse Image; SAM 3.1; Muse Code), links to `/simulation`, `/built`, the GitHub repo, the demo video and the X post. Keep it under 150 words. It must not flash visibly before React mounts: if it is inside the root div, React replaces it; if `<noscript>`, it only shows without JS.
3. `web/public/llms.txt` (Markdown, per the llms.txt convention): `# Inkling`, a one-line summary, then sections: What it is (3 sentences), How it works (the four rounds, top 3, wildcard, courses, apprenticeships, the live inkling and paper pal), Meta models used (one line each, including that Spark Open runs on Baseten and the inkling on the Meta Model API), Data and licences (Discover Uni/HESA CC BY 4.0, O*NET 31.0 CC BY 4.0, Skills England OGL v3), Links (site, /simulation, /built, GitHub, demo video, X post). Under 400 words.
4. `web/public/robots.txt` if missing: allow all, `Sitemap:` line omitted (no sitemap). Do not block any AI crawlers.
5. `README.md` top links line: add ` · **X post:** [x.com/MartinSWDev/status/2118059722070790600](https://x.com/MartinSWDev/status/2118059722070790600)` after the demo video link.
6. Check: `npm --prefix web run build` passes; `curl -s http://127.0.0.1:8788/ | grep -c "application/ld+json"` returns 1 under `wrangler pages dev`; `/llms.txt` is served. Report files changed.
