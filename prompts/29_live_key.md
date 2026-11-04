# 29 · Key the live calls by the answers only, and use muse-spark-1.2

Two tiny changes.

1. `web/src/App.tsx`, live-calls effect (~line 440): it is keyed by `shareKey`, which also contains the room sticker codes, the window view and the time of day, so a view change or the room finishing filling aborts and restarts `/api/inkling` and `/api/pal`. Add `const liveKey = top3.map((r) => r.code).join(",") + "|" + (surprise ?? "");` and use `liveKey` everywhere the effect used `shareKey` (`liveKeyRef`, `key`, the `setLiveInkling`/`setLivePal` keys, the effect deps, and every `liveInkling.key === shareKey` / `livePal.key === shareKey` comparison in the JSX and in the share/compose code). The share video keeps `shareKey`. The pal still gets composed into the share image when ready (`composeRoomCanvas(..., url)` call stays, keyed by `shareKey` for `imageRef`).
2. `functions/api/_spark.ts`: `META_MODEL = "muse-spark-1.2"` (measured 5 s to first text vs 10 s for 1.3). Update the README model column for the inkling row to `Muse Spark 1.2 · Meta Model API (falls back to Spark Open on Baseten)` and the App.tsx/Room.tsx tag strings to say `Muse Spark 1.2`.

Checks: build and tests pass; under `wrangler pages dev`, open DevTools Network, play to the finale, then change the window view on the views page: `/api/inkling` and `/api/pal` must each appear exactly once for the game. Report the files changed.
