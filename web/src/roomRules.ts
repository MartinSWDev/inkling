import type { RankedRow } from "./scoring";

export const ROUND_CAPS = [2, 4, 6, 8];

/** At most one new object per action: add the biggest qualified riser, or swap out the weakest. */
export function growRoom(
  prev: string[], prevScores: Record<string, number>, ranked: RankedRow[],
  qualified: Set<string>, cap: number,
): string[] {
  const scores: Record<string, number> = Object.fromEntries(ranked.map((r) => [r.code, r.score]));
  const candidates = ranked
    .filter((r) => qualified.has(r.code) && !prev.includes(r.code))
    .sort((a, b) => ((b.score - (prevScores[b.code] ?? 0)) - (a.score - (prevScores[a.code] ?? 0))) || (b.score - a.score));
  if (!candidates.length) return prev;
  const best = candidates[0];
  if (prev.length < cap) return [...prev, best.code];
  let weakest = prev[0];
  for (const code of prev) if ((scores[code] ?? 0) < (scores[weakest] ?? 0)) weakest = code;
  if (best.score <= (scores[weakest] ?? 0)) return prev;
  return [...prev.filter((c) => c !== weakest), best.code];
}
