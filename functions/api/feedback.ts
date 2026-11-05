// Minimal Cloudflare types, declared here so the repo needs no extra packages.
interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; run(): Promise<unknown> }
interface D1Database { prepare(query: string): D1PreparedStatement }
type PagesFunction<E> = (context: { request: Request; env: E }) => Promise<Response>;

type Env = { DB: D1Database };

const GAME_ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const SUBJECT_RE = /^CAH\d{2}-\d{2}-\d{2}$/;

function isSubjectCode(s: unknown): boolean {
  return typeof s === "string" && SUBJECT_RE.test(s);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const req = context.request;
  const env = context.env;

  const lenHeader = req.headers.get("content-length");
  if (lenHeader) {
    const n = parseInt(lenHeader, 10);
    if (!isNaN(n) && n > 20000) {
      return jsonError("payload too large", 413);
    }
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return jsonError("invalid body", 400);
  }
  if (text.length > 20000) {
    return jsonError("payload too large", 413);
  }

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return jsonError("invalid json", 400);
    data = parsed as Record<string, unknown>;
  } catch {
    return jsonError("invalid json", 400);
  }

  const { game_id, kind, vote, off_code, top, wildcard, answers, app_version } = data;

  if (typeof game_id !== "string" || !GAME_ID_RE.test(game_id)) {
    return jsonError("invalid game_id", 400);
  }
  if (typeof app_version !== "string" || app_version.length === 0 || app_version.length > 32) {
    return jsonError("invalid app_version", 400);
  }

  // Country packs: { type: "country", country } from the "Other" pack's
  // explore page. Stored in the same table as kind = 'country', with the
  // typed country in the answers JSON.
  if (data.type === "country") {
    const country = data.country;
    if (typeof country !== "string" || country.trim().length === 0 || country.length > 80) {
      return jsonError("invalid country", 400);
    }
    try {
      await env.DB.prepare(
        "INSERT INTO feedback (game_id, kind, vote, off_code, top, wildcard, answers, app_version) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)"
      )
        .bind(game_id, "country", null, null, "[]", null, JSON.stringify({ country: country.trim() }), app_version)
        .run();
    } catch {
      return jsonError("store failed", 500);
    }
    return new Response(null, { status: 204 });
  }
  if (kind !== "vote" && kind !== "off") {
    return jsonError("invalid kind", 400);
  }
  if (kind === "vote") {
    if (vote !== "up" && vote !== "down") {
      return jsonError("invalid vote", 400);
    }
  }
  if (kind === "off") {
    if (off_code !== "all" && !isSubjectCode(off_code)) {
      return jsonError("invalid off_code", 400);
    }
  }
  if (!Array.isArray(top) || top.length > 3) {
    return jsonError("invalid top", 400);
  }
  for (const c of top) {
    if (!isSubjectCode(c)) {
      return jsonError("invalid top", 400);
    }
  }
  if (wildcard !== null && !isSubjectCode(wildcard)) {
    return jsonError("invalid wildcard", 400);
  }
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return jsonError("invalid answers", 400);
  }

  const voteVal = kind === "vote" ? vote : null;
  const offCodeVal = kind === "off" ? off_code : null;
  const topStr = JSON.stringify(top);
  const wildcardVal = wildcard ?? null;
  const answersStr = JSON.stringify(answers);

  try {
    await env.DB.prepare(
      "INSERT INTO feedback (game_id, kind, vote, off_code, top, wildcard, answers, app_version) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)"
    )
      .bind(game_id, kind, voteVal, offCodeVal, topStr, wildcardVal, answersStr, app_version)
      .run();
  } catch {
    return jsonError("store failed", 500);
  }

  return new Response(null, { status: 204 });
};
