// Live "your inkling" text, written by Muse Spark Open on Baseten and
// streamed to the top-3 page. Keys stay server-side; the game falls back to
// its static text whenever this is unavailable. No player data is stored.
// Minimal Cloudflare types, declared here so the repo needs no extra packages.
type PagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;
import { readSSE, sparkChat, type Env } from "./_spark";
type Country = "uk" | "us" | "au" | "other";
const isCountry = (v: unknown): v is Country => v === "uk" || v === "us" || v === "au" || v === "other";
// Only the first sentence differs by country pack; uk and other share the live wording.
const WHO: Record<Country, string> = {
  uk: "a UK sixth-former who has just played Inkling, which suggests degree subjects",
  other: "a UK sixth-former who has just played Inkling, which suggests degree subjects",
  us: "a US high-schooler choosing a college major who has just played Inkling, which suggests majors",
  au: "an Australian Year 12 student who has just played Inkling, which suggests uni subjects",
};
const SPELLING: Record<Country, string> = { uk: "British spelling", other: "British spelling", us: "American spelling", au: "Australian spelling" };
const systemFor = (c: Country) => `You write a short, warm note for ${WHO[c]}. Speak to them as "you". Their inkling is the first subject in "top". Write two sentences about how their answers point to that subject, using only the facts given: the subjects they take, what they said yes to, and the card text. Then one sentence that mentions the other top subjects by name as also fitting. Never invent facts about courses, jobs, grades or universities. No bullet points, headings, emojis or exclamation marks. ${SPELLING[c]}. Under 60 words. Do not call it a quiz or a test.`;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const capStr = (v: unknown, max: number): string | null =>
  typeof v === "string" ? v.slice(0, max) : null;

function capList(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 50) return null;
  const out: string[] = [];
  for (const item of v.slice(0, 10)) {
    const s = capStr(item, 240);
    if (s === null) return null;
    out.push(s);
  }
  return out;
}

function capSubject(v: unknown): { name: string; text: string } | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const name = capStr(o.name, 80);
  const text = capStr(o.plain ?? o.why, 240);
  if (name === null || text === null) return null;
  return { name, text };
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const lenHeader = request.headers.get("content-length");
  if (lenHeader && parseInt(lenHeader, 10) > 12000) return jsonError("payload too large", 400);
  let text: string;
  try {
    text = await request.text();
  } catch {
    return jsonError("invalid body", 400);
  }
  if (text.length > 12000) return jsonError("payload too large", 400);

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return jsonError("invalid json", 400);
    data = parsed as Record<string, unknown>;
  } catch {
    return jsonError("invalid json", 400);
  }

  if (!Array.isArray(data.top) || data.top.length < 1 || data.top.length > 3) return jsonError("invalid top", 400);
  const top: { name: string; plain: string }[] = [];
  for (const t of data.top) {
    const s = capSubject(t);
    if (!s) return jsonError("invalid top", 400);
    top.push({ name: s.name, plain: s.text });
  }
  let wildcard: { name: string; why: string } | null = null;
  if (data.wildcard !== null && data.wildcard !== undefined) {
    const w = capSubject(data.wildcard);
    if (!w) return jsonError("invalid wildcard", 400);
    wildcard = { name: w.name, why: w.text };
  }
  if (typeof data.answers !== "object" || data.answers === null || Array.isArray(data.answers))
    return jsonError("invalid answers", 400);
  const a = data.answers as Record<string, unknown>;
  const answers: Record<string, string[]> = {};
  for (const key of ["takes", "loves", "typed", "yes", "really", "picks"]) {
    const list = a[key] === undefined ? [] : capList(a[key]);
    if (list === null) return jsonError("invalid answers", 400);
    answers[key] = list;
  }

  if (data.country !== undefined && !isCountry(data.country)) return jsonError("invalid country", 400);
  const country: Country = isCountry(data.country) ? data.country : "uk";

  const facts = { top, wildcard, answers };
  const user = JSON.stringify(facts) + (wildcard
    ? `\n\nWrite their inkling. Then add one sentence starting "Your wildcard," explaining why ${wildcard.name} fits.`
    : "\n\nWrite their inkling.");

  let sparked: Awaited<ReturnType<typeof sparkChat>>;
  try {
    sparked = await sparkChat(env, {
      stream: true, temperature: 0.5, max_tokens: 8000, // this model reasons for ~2k tokens before writing; the prompt caps the visible text at 70 words
      messages: [
        { role: "system", content: systemFor(country) },
        { role: "user", content: user },
      ],
    }, { prefer: "meta" });
  } catch {
    return jsonError("model unavailable", 502);
  }
  const { res: upstream, provider, model } = sparked;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let reasoningCount = 0;
      let lastBel = 0;
      let sawContent = false;
      try {
        await readSSE(upstream, ({ content, reasoning }) => {
          if (content) {
            sawContent = true;
            controller.enqueue(encoder.encode(content));
            return;
          }
          if (reasoning && !sawContent) {
            reasoningCount += 1;
            if (reasoningCount % 40 === 0) {
              const now = Date.now();
              if (now - lastBel >= 400) {
                lastBel = now;
                controller.enqueue(encoder.encode("\u0007"));
              }
            }
          }
        });
      } catch { /* upstream died; the client falls back silently */ }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-model": model,
      "x-provider": provider,
      "Access-Control-Expose-Headers": "x-model, x-provider",
    },
  });
};
