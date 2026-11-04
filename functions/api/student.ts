// One brand-new simulated student, written and played live by Muse Spark
// Open on Baseten (prompts/21 C). Everything the model writes is streamed
// raw to the simulation page as its live log; the browser parses the two
// JSON blocks, scores the student itself, and walks them to their building.
// Minimal Cloudflare types, declared here so the repo needs no extra packages.
type PagesFunction<E> = (context: { request: Request; env: E; waitUntil?: (p: Promise<unknown>) => void }) => Promise<Response>;
import { readSSE, sparkChat, type Env, type SparkResult } from "./_spark";
const FOCI = [
  "sciences and health", "arts, design and media", "business, law and society",
  "computing and engineering", "humanities and languages",
  "sport, agriculture and the outdoors", "no idea yet",
];

type Json = Record<string, unknown>;

function personaPrompt(seed: number, focus: string, catalogue: string): string {
  return `Create ONE realistic, varied student aged 16-18 living in the UK (England, Scotland, Wales or Northern Ireland; a city, town or rural area), for testing a game that suggests degree subjects. They might be at sixth form, FE college, doing a BTEC or Scottish Highers.

Centre this student's interests on this subject area (but keep them a believable person, not a stereotype): ${focus}.
Variation seed: ${seed} (use it to make this student distinct from any other).

Give:
- "first_name": a common UK first name
- "age": 16, 17 or 18
- "where": town or region
- "studying": 3-4 school/college subjects they take (e.g. "A-level Biology", "BTEC Sport")
- "enjoys": 2 sentences about what they genuinely like doing in and out of school (hobbies, part-time jobs, curiosities) — concrete, no personality labels
- "certainty": "knows" | "torn" | "no idea"
- "suits": an array of 2 to 4 subject codes exactly as given in the list, codes only, no names

Degree subjects (code name):
${catalogue}

Return only JSON: {"first_name": "...", "age": 17, "where": "...", "studying": "...", "enjoys": "...", "certainty": "torn", "suits": ["..."]}`;
}

function playPrompt(student: Json, content: Json): string {
  const chips = (content.chips as { id: string; name: string }[]).map((c) => `${c.id} (${c.name})`).join(", ");
  const things = (content.things as { id: string; title: string }[]).map((t) => `${t.id}: ${t.title}`).join("\n");
  const qs = (content.questions as { id: string; title: string }[]).map((q) => `${q.id}: ${q.title}`).join("\n");
  const pairs = (content.pairs as { id: string; a: { label: string; caption?: string }; b: { label: string; caption?: string } }[])
    .map((p) => `${p.id}: a = ${p.a.label} (${p.a.caption ?? ""}) | b = ${p.b.label} (${p.b.caption ?? ""})`).join("\n");
  const persona = {
    first_name: student.first_name, age: student.age, where: student.where,
    studying: student.studying, enjoys: student.enjoys, certainty: student.certainty,
  };
  return `You are role-playing this student honestly while they play a quick game about what they enjoy:
${JSON.stringify(persona)}

Answer every part the way THIS student really would (it's fine to say no to most things; don't just say yes to everything):
1. "chips": which of these school subjects they take, each with state "take" or "love" (love = a favourite): ${chips}
   "typed": up to 2 other subjects they take that aren't in that list, chosen from: ${(content.extra_names as string[]).join(", ")}
2. "things": for each card, "yes" (would get stuck into it) or "no":
${things}
3. "pairs": for each pair, "a", "b", or null if they genuinely can't decide:
${pairs}
4. "questions": for each, "yes" (would want to find out), "no", or "up" (really need to know):
${qs}

Return only JSON: {"chips": [{"id": "...", "state": "take|love"}], "typed": [...], "things": {"<id>": "yes|no", ...}, "pairs": {"<id>": "a|b|null", ...}, "questions": {"<id>": "yes|no|up", ...}}`;
}

/** Strip Markdown fences and anything outside the outer braces, then parse. */
export function extractJson(text: string): Json | null {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(unfenced.slice(start, end + 1));
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Json) : null;
  } catch {
    return null;
  }
}

const plainError = (e: unknown): string =>
  (e instanceof Error ? e.message : "something went wrong").toLowerCase();

type Write = (text: string) => void;
type Messages = { role: string; content: string }[];

/** Stream one model call, emitting @@think N once a second while the model
 * is only reasoning (never forwarding the reasoning text itself). */
async function streamCall(res: Response, write: Write): Promise<string> {
  let text = "";
  let reasoning = 0;
  let sawContent = false;
  let lastThink = Date.now();
  await readSSE(res, (delta) => {
    if (delta.reasoning && !sawContent) {
      reasoning += 1;
      const now = Date.now();
      if (now - lastThink >= 1000) { lastThink = now; write(`@@think ${reasoning}\n`); }
    }
    if (delta.content) { sawContent = true; text += delta.content; write(delta.content); }
  });
  return text;
}

/** One logical model call: status marker, streamed answer, and exactly one
 * retry with a corrective message if the answer is not valid JSON. */
async function callForJson(
  env: Env, messages: Messages, write: Write,
  status: string, section: string, firstRes?: Response,
): Promise<Json> {
  write(`\n@@status ${status}\n`);
  write(`${section}\n`);
  let res = firstRes;
  if (!res) res = (await sparkChat(env, { stream: true, temperature: 0.8, max_tokens: 8000, messages })).res;
  let parsed = extractJson(await streamCall(res, write));
  if (parsed) return parsed;
  write("\n@@status retrying\n");
  write(`${section}\n`);
  const retry = await sparkChat(env, {
    stream: true, temperature: 0.8, max_tokens: 8000,
    messages: [...messages, { role: "user", content: "Your last answer was not valid JSON. Return only the JSON object." }],
  });
  parsed = extractJson(await streamCall(retry.res, write));
  if (parsed) return parsed;
  throw new Error("the model did not return valid JSON");
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const encoder = new TextEncoder();
  const errorResponse = (e: unknown) => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`\n@@error ${plainError(e)}\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  };

  // Choose the provider before constructing the streamed response, so the
  // x-model / x-provider headers can be set (prompts/22 B).
  let content: Json;
  let first: SparkResult;
  let personaMessages: Messages = [];
  try {
    if (!env.ASSETS) throw new Error("static assets unavailable");
    const origin = new URL(request.url).origin;
    const [contentRes, subjectsRes] = await Promise.all([
      env.ASSETS.fetch(new Request(origin + "/data/content.json")),
      env.ASSETS.fetch(new Request(origin + "/data/subjects.json")),
    ]);
    if (!contentRes.ok || !subjectsRes.ok) throw new Error("static data unavailable");
    content = (await contentRes.json()) as Json;
    const subjectsData = (await subjectsRes.json()) as { subjects: { code: string; display_name: string }[] };
    const catalogue = subjectsData.subjects.map((s) => `${s.code} ${s.display_name}`).join("\n");
    const focus = FOCI[Math.floor(Math.random() * FOCI.length)];
    const seed = Math.floor(Math.random() * 1_000_000_000);
    personaMessages = [{ role: "user", content: personaPrompt(seed, focus, catalogue) }];
    first = await sparkChat(env, {
      stream: true, temperature: 0.8, max_tokens: 8000, // this model reasons for ~2-3k tokens before writing; the JSON itself is short
      messages: personaMessages,
    });
  } catch (e) {
    return errorResponse(e);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      try {
        const student = await callForJson(env, personaMessages, write, "writing persona", "@@persona", first.res);
        await callForJson(env, [{ role: "user", content: playPrompt(student, content) }], write, "playing the game", "@@play");
        write("\n@@status scoring\n");
        write("@@done\n");
      } catch (e) {
        write(`\n@@error ${plainError(e)}\n`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-model": first.model,
      "x-provider": first.provider,
      "Access-Control-Expose-Headers": "x-model, x-provider",
    },
  });
};
