#!/bin/sh
# Updates render.mjs scene ids/starts for the new cut and clears old per-scene renders.
cd "$(dirname "$0")"
sed -i '' 's/^const starts = .*/const starts = [0, 24.4, 34.4, 48.4, 63.4, 80.4, 89.4, 100.4, 108.4, 134.4, 164.4, 171.4, 177.4];/' render.mjs
sed -i '' 's/^const ids = .*/const ids = ["ad", "intro", "round1", "rounds", "reveal", "inkling", "courses", "share", "models", "sim", "built", "end"];/' render.mjs
sed -i '' 's/const a = starts\[i\] \* 30, b = starts\[i + 1\] \* 30 - 1;/const a = Math.round(starts[i] * 30), b = Math.round(starts[i + 1] * 30) - 1;/' render.mjs
grep -n "const a = " render.mjs
mkdir -p out/old && mv out/[0-9][0-9]_*.mp4 out/old/ 2>/dev/null
echo patched
