# 22 · Spark Open provider fallback + thinking heartbeat

Read `prompts/21_live_models.md` section G first; it was not implemented. Then do the following. Keep the existing behaviour of `functions/api/inkling.ts`, `functions/api/student.ts` and the UI exactly as it is unless named below. No new npm packages. Cloudflare Pages Functions, TypeScript, inline types only.

## A. Shared helper `functions/api/_spark.ts`

Export `sparkChat(env, body, opts)`:

- `body` is the OpenAI-style chat body **without** `model` (messages, temperature, max_tokens, stream: true).
- Try **Baseten** first: `POST https://inference.baseten.co/v1/chat/completions`, bearer `env.BASETEN_API_KEY`, `model: "meta-models/muse-spark-open-1026"`. Skip it if the key is missing.
- If Baseten throws, returns non-2xx, or returns a 2xx with no body, fall back to the **Meta Model API**: `POST https://api.meta.ai/v1/chat/completions`, bearer `env.MODEL_API_KEY`, `model: "muse-spark-1.3"`, same body. Skip if the key is missing.
- Return `{ res: Response, provider: "baseten" | "meta", model: string }`, or throw `Error("no model provider available")` if both fail.
- Also export `readSSE(res, onDelta)` that parses the SSE stream and calls `onDelta({ content?: string; reasoning?: string })` per chunk. Read `choices[0].delta.content` and, when present, `choices[0].delta.reasoning_content` (Baseten) or `choices[0].delta.reasoning` (Meta API) as `reasoning`. Keep the existing tolerant line buffering (`data:` prefix, ignore `[DONE]`, skip partial JSON).
- Both routes must use these two functions instead of their own fetch + SSE loop. Remove the duplicated loops.
- Type `Env` as `{ BASETEN_API_KEY?: string; MODEL_API_KEY?: string; ASSETS?: Fetcher }` in a shared place both files import.

## B. Response headers

Both `/api/inkling` and `/api/student` set these headers on the streamed response:

```
x-model: meta-models/muse-spark-open-1026   (or muse-spark-1.3)
x-provider: baseten                          (or meta)
Access-Control-Expose-Headers: x-model, x-provider
```

Because the response is already streaming when the provider is known, choose the provider **before** constructing the `Response` (call `sparkChat` first, then build the ReadableStream from `res`). If both providers fail on `/api/inkling`, return `jsonError("model unavailable", 502)` as now. On `/api/student` emit the existing `@@error` marker.

## C. Thinking heartbeat on `/api/inkling`

While the model is reasoning (deltas with `reasoning` but no `content`), the client currently sees nothing for 20–40 s. Emit one literal `\u0007` (BEL) byte for every ~40 reasoning deltas received, never more than one per 400 ms. Stop emitting BEL once the first `content` delta arrives. Never forward the reasoning text itself.

In `web/src/live.ts` `fetchInkling`: strip `\u0007` characters from the accumulated text before calling `onText`, and count them into a new optional callback `onThinking(ticks: number)`. Also read the `x-model` and `x-provider` headers from the response and return them: change the return type to `Promise<{ text: string; provider: "baseten" | "meta" | null; model: string | null }>` with `text` `""` on any failure. Update the call site in `App.tsx`.

## D. UI tags

In `web/src/App.tsx`, the `.inklingcard` footer:
- While waiting with no content yet: `Muse Spark Open is thinking` followed by 1–3 trailing dots cycling from `onThinking` ticks (ticks % 3 + 1). If no ticks have arrived keep the current text.
- When done, provider `baseten`: `Written for you by Muse Spark Open (a Meta model, live on Baseten).`
- When done, provider `meta`: `Written for you by Muse Spark (a Meta model, live via the Meta Model API).`

In `web/src/Simulation.tsx` and `simData.ts` (`runLiveStudent`): read the same two headers from the `/api/student` response and pass them through so the live-student log header says `Live student · Muse Spark Open on Baseten` or `Live student · Muse Spark via the Meta Model API`. Keep the existing @@ marker protocol unchanged.

## E. Checks

- `npm --prefix web run build` passes; `npx tsc --noEmit -p web` passes; `npx wrangler pages dev web/dist` serves `/api/inkling` (needs `.dev.vars` with both keys; do not print them).
- With `BASETEN_API_KEY` deliberately unset in `.dev.vars`, `/api/inkling` still streams and returns `x-provider: meta`.
- Add two unit tests next to `web/src/feedback.test.ts` style: one that `fetchInkling` strips BEL and counts ticks, one that it returns provider/model from headers (mock `fetch`).
- README "Live during play" table: add a short sentence under it: "Spark Open runs on Baseten; if that endpoint is unavailable the same calls fall back to `muse-spark-1.3` on the Meta Model API, and the page says which one answered."

Report: files changed, the two test names, and whether the fallback path was exercised locally.
