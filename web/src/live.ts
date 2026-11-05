/** Live Meta model calls during play (prompts/21 D). Every call degrades
 * silently: the static game content is always the fallback. */
import type { Answers, Chip, DeckCard, Pair } from "./api";
import type { Paper } from "./simData";

/** CAH prefix -> paper type, ported from PAPER_BY_AREA in
 * scripts/simulate_students.py (longest prefix wins). */
const PAPER_BY_AREA: Record<string, Paper> = {
  "CAH09": "graph", "CAH07-01": "graph", "CAH07-04": "graph", "CAH10": "graph", "CAH15-02": "graph",
  "CAH25-02": "manuscript", "CAH13": "blueprint", "CAH20": "parchment", "CAH26": "map",
  "CAH25-01": "watercolour", "CAH01": "lab", "CAH02": "lab", "CAH03": "lab", "CAH04": "lab", "CAH07-02": "lab",
  "CAH16": "legal", "CAH15": "legal", "CAH17": "legal", "CAH11": "printout", "CAH05": "kraft", "CAH06": "kraft",
};

export function paperFor(code: string): Paper {
  for (const k of Object.keys(PAPER_BY_AREA).sort((a, b) => b.length - a.length))
    if (code.startsWith(k)) return PAPER_BY_AREA[k];
  return "lined";
}

export const PAPER_NAME: Record<Paper, string> = {
  lined: "lined paper", graph: "graph paper", manuscript: "manuscript paper",
  blueprint: "blueprint paper", parchment: "parchment", map: "map paper",
  watercolour: "watercolour paper", lab: "lab notebook paper", legal: "legal pad paper",
  printout: "computer printout paper", kraft: "kraft paper",
};

export interface InklingInput {
  top: { name: string; plain: string }[];
  wildcard: { name: string; why: string } | null;
  answers: { takes: string[]; loves: string[]; typed: string[]; yes: string[]; really: string[]; picks: string[] };
  /** Country pack; the server defaults to uk when absent. */
  country?: "uk" | "us" | "other";
}

/** The facts sent to /api/inkling: nothing but names and titles. */
export function answerSummary(
  answers: Answers, chips: Chip[], things: DeckCard[], questions: DeckCard[], pairs: Pair[],
): InklingInput["answers"] {
  const chipName = new Map(chips.map((c) => [c.id, c.name]));
  const thingTitle = new Map(things.map((c) => [c.id, c.title]));
  const questionTitle = new Map(questions.map((c) => [c.id, c.title]));
  const pairById = new Map(pairs.map((p) => [p.id, p]));
  return {
    takes: (answers.chips || []).filter((c) => c.state !== "love").map((c) => chipName.get(c.id)).filter((n): n is string => !!n),
    loves: (answers.chips || []).filter((c) => c.state === "love").map((c) => chipName.get(c.id)).filter((n): n is string => !!n),
    typed: [...(answers.typed || [])],
    yes: (answers.swipes || []).filter((s) => s.answer === "yes" && thingTitle.has(s.card_id)).map((s) => thingTitle.get(s.card_id)!),
    really: (answers.swipes || []).filter((s) => s.answer === "up" && questionTitle.has(s.card_id)).map((s) => questionTitle.get(s.card_id)!),
    picks: (answers.pairs || []).flatMap((p) => {
      const pair = pairById.get(p.pair_id);
      return pair && (p.side === "a" || p.side === "b") ? [pair[p.side].label] : [];
    }),
  };
}

export interface InklingResult {
  text: string;
  provider: "baseten" | "meta" | null;
  model: string | null;
}

/** Stream the live inkling text; calls onText with everything so far
 * (BEL thinking ticks stripped, counted via onThinking). Resolves to the
 * final text, or "" on any failure. Never throws. */
export async function fetchInkling(
  input: InklingInput,
  onText: (textSoFar: string) => void,
  signal?: AbortSignal,
  onThinking?: (ticks: number) => void,
): Promise<InklingResult> {
  // Own 90s timeout (prompts/26 C): aborting this controller never touches
  // the caller's signal; the caller just sees an empty result.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90000);
  const onCallerAbort = () => ctl.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  try {
    const res = await fetch("/api/inkling", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: ctl.signal,
    });
    const providerHeader = res.headers.get("x-provider");
    const provider: InklingResult["provider"] =
      providerHeader === "baseten" || providerHeader === "meta" ? providerHeader : null;
    const model = res.headers.get("x-model");
    if (!res.ok || !res.body) return { text: "", provider, model };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let ticks = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const bels = chunk.split("\u0007").length - 1;
      if (bels > 0) {
        ticks += bels;
        onThinking?.(ticks);
      }
      const clean = chunk.replaceAll("\u0007", "");
      if (clean) {
        text += clean;
        onText(text);
      }
    }
    // Flush any trailing decoded bytes the same way.
    const tail = decoder.decode();
    if (tail) {
      const bels = tail.split("\u0007").length - 1;
      if (bels > 0) { ticks += bels; onThinking?.(ticks); }
      const clean = tail.replaceAll("\u0007", "");
      if (clean) { text += clean; onText(text); }
    }
    return { text: text.trim() ? text : "", provider, model };
  } catch {
    return { text: "", provider: null, model: null };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

/** Draw the player's paper pal; resolves to an object URL, or null. */
export async function fetchPal(
  input: { paper: Paper; object: string; subject: string }, signal?: AbortSignal,
): Promise<string | null> {
  // Own 120s timeout (prompts/26 C), independent of the caller's signal.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 120000);
  const onCallerAbort = () => ctl.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });
  try {
    const res = await fetch("/api/pal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { png?: string };
    if (!data.png) return null;
    const bytes = Uint8Array.from(atob(data.png), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
