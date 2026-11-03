export const APP_VERSION = "2026-11-03";
export type Vote = "up" | "down";

export function newGameId(): string {
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // older browsers: fall back to random hex below
  }
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function feedbackPayload(o: {
  gameId: string;
  kind: "vote" | "off";
  vote?: Vote;
  offCode?: string;
  top: string[];
  wildcard: string | null;
  answers: unknown;
}) {
  return {
    game_id: o.gameId,
    kind: o.kind,
    vote: o.vote ?? null,
    off_code: o.offCode ?? null,
    top: o.top.slice(0, 3),
    wildcard: o.wildcard,
    answers: o.answers,
    app_version: APP_VERSION,
  };
}

export async function sendFeedback(body: ReturnType<typeof feedbackPayload>): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
