// Shared Muse Spark chat helper with provider fallback (prompts/22 A).
// Tries the preferred provider first (Baseten by default; prompts/28), the
// other one as fallback. Minimal Cloudflare types, declared here so the
// repo needs no extra packages.
export interface Fetcher { fetch: (request: Request) => Promise<Response> }

export type Env = { BASETEN_API_KEY?: string; MODEL_API_KEY?: string; ASSETS?: Fetcher };

export type SparkProvider = "baseten" | "meta";

export interface SparkBody {
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream: true;
  [key: string]: unknown;
}

export interface SparkResult {
  res: Response;
  provider: SparkProvider;
  model: string;
}

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
const BASETEN_MODEL = "meta-models/muse-spark-open-1026";
const META_URL = "https://api.meta.ai/v1/chat/completions";
const META_MODEL = "muse-spark-1.2";

async function tryProvider(
  url: string,
  key: string,
  model: string,
  provider: SparkProvider,
  body: SparkBody,
): Promise<SparkResult | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, model }),
    });
    if (!res.ok || !res.body) return null;
    return { res, provider, model };
  } catch {
    return null;
  }
}

export async function sparkChat(
  env: Env,
  body: SparkBody,
  opts?: { prefer?: SparkProvider },
): Promise<SparkResult> {
  const providers: { key?: string; url: string; model: string; provider: SparkProvider }[] = [
    { key: env.BASETEN_API_KEY, url: BASETEN_URL, model: BASETEN_MODEL, provider: "baseten" },
    { key: env.MODEL_API_KEY, url: META_URL, model: META_MODEL, provider: "meta" },
  ];
  if (opts?.prefer === "meta") providers.reverse();
  for (const p of providers) {
    if (!p.key) continue;
    const r = await tryProvider(p.url, p.key, p.model, p.provider, body);
    if (r) return r;
  }
  throw new Error("no model provider available");
}

export interface SSEDelta {
  content?: string;
  reasoning?: string;
}

export async function readSSE(
  res: Response,
  onDelta: (delta: SSEDelta) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const handleLine = (line: string) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload) as {
        choices?: { delta?: { content?: string; reasoning_content?: string; reasoning?: string } }[];
      };
      const delta = json.choices?.[0]?.delta;
      if (!delta) return;
      const out: SSEDelta = {};
      if (delta.content) out.content = delta.content;
      const reasoning = delta.reasoning_content ?? delta.reasoning;
      if (reasoning) out.reasoning = reasoning;
      if (out.content !== undefined || out.reasoning !== undefined) onDelta(out);
    } catch { /* keep streaming past a partial line */ }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
}
