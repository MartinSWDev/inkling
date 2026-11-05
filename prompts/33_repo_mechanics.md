# 33 · Repo mechanics: Dockerfile, eval/, tests/, CI

Four small additions, no app code changes, nothing that needs a deploy. Keep each file short and correct.

1. `Dockerfile` at the repo root, multi-stage: `node:20-alpine` builder runs `npm ci --prefix web` then, inside `web/`, `npx tsc -b && npx vite build` (not `npm run build`: its `prebuild` hook runs a Python exporter that is not needed because the exported data is committed under `web/public/data/`); final stage `nginx:alpine` copies `web/dist` to `/usr/share/nginx/html` with a minimal `nginx.conf` that serves `index.html` for unknown paths (SPA fallback) and sets `Cache-Control` for `/assets/`. Note in a comment that the live model routes (`functions/api/*`) are Cloudflare Pages Functions and are not served by this image; the game plays fully without them. Add `.dockerignore` (node_modules, web/dist, video, tmp_stage, .env, .dev.vars, out).

2. `eval/` directory:
   - `eval/README.md`: what the simulation measures (200 simulated students written by Muse Spark Open, ground truth noted first), the metrics with their current values from the calibration data: held-out top-3 hit 38% → 54%, top-5 56% → 67%, right subject family in top 3 49% → 67%, subjects ever reaching a top 3 53 → 99; all-200 after the fix: top-3 51%, top-5 63.5%, 121 of 163 subjects reached; and how to re-run it (the exact `scripts/` commands that generate students, play them and compute calibration; read the scripts to get the names right). Use the words "accuracy" and "metrics".
   - `eval/results.json`: copy of the calibration/results JSON the simulation page reads (find it under `web/public/data/`), so the numbers are in the repo under `eval/`.

3. `tests/` directory:
   - `tests/README.md`: where the suites live (`web/src/*.test.ts`, vitest; any Python tests under `scripts/`), and how to run them.
   - `tests/run.sh` (executable): runs `npm --prefix web test` and, if a `scripts/test_*.py` or `pytest` config exists, `python -m pytest scripts -q`; exits non-zero on failure.

4. `.github/workflows/ci.yml`: on push and pull_request to main: checkout, `actions/setup-node@v4` with node 20 and npm cache (cache-dependency-path `web/package-lock.json`), `npm ci --prefix web`, `npm --prefix web test`, then `npx tsc -b && npx vite build` with `working-directory: web` (same reason as the Dockerfile: skip the Python `prebuild` hook). Nothing that needs secrets.

Checks: `docker build .` is not required (no Docker locally); verify the Dockerfile and nginx.conf by reading them. `sh tests/run.sh` passes locally. The workflow YAML is valid. Report the files added.
