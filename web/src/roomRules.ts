import type { RankedRow } from "./scoring";

/** Round caps during play: max 7 in the room; the wildcard becomes the 8th in the reveal. */
export const ROUND_CAPS = [2, 4, 6, 7];

/** At most one new object per action: add the biggest qualified riser, or swap out the weakest. */
export function growRoom(
  prev: string[], prevScores: Record<string, number>, ranked: RankedRow[],
  qualified: Set<string>, cap: number,
): string[] {
  const candidates = ranked
    .filter((r) => qualified.has(r.code) && !prev.includes(r.code))
    .sort((a, b) => ((b.score - (prevScores[b.code] ?? 0)) - (a.score - (prevScores[a.code] ?? 0))) || (b.score - a.score));
  if (!candidates.length) return prev;
  // Once placed, an object stays for the rest of the rounds. At the cap,
  // nothing new is added (no swaps during play).
  if (prev.length >= cap) return prev;
  return [...prev, candidates[0].code];
}

/** Reveal: make sure every result subject is in the room, swapping out the
 * weakest non-result objects (never exceeding 8). */
export function ensureResults(room: string[], resultCodes: string[], ranked: RankedRow[]): string[] {
  const scores: Record<string, number> = Object.fromEntries(ranked.map((r) => [r.code, r.score]));
  const out = [...room];
  for (const code of resultCodes) {
    if (out.includes(code)) continue;
    if (out.length < 8) { out.push(code); continue; }
    let weakest: string | null = null;
    for (const c of out) if (!resultCodes.includes(c) && (weakest === null || (scores[c] ?? 0) < (scores[weakest] ?? 0))) weakest = c;
    if (weakest === null) break;
    out[out.indexOf(weakest)] = code;
  }
  return out;
}

/** Reveal preference: keep at least one floor/bed object when a qualified one exists. */
export function ensureFloorOrBed(
  room: string[], ranked: RankedRow[], qualified: Set<string>,
  slotOf: (code: string) => string | undefined, keep: string[] = [],
): string[] {
  if (!room.length || room.some((c) => slotOf(c) === "floor" || slotOf(c) === "bed")) return room;
  const cand = ranked.find((r) => qualified.has(r.code) && !room.includes(r.code)
    && (slotOf(r.code) === "floor" || slotOf(r.code) === "bed"));
  if (!cand) return room;
  const scores: Record<string, number> = Object.fromEntries(ranked.map((r) => [r.code, r.score]));
  let weakest: string | null = null;
  for (const code of room) if (!keep.includes(code) && (weakest === null || (scores[code] ?? 0) < (scores[weakest] ?? 0))) weakest = code;
  if (weakest === null) return room;
  return [...room.filter((c) => c !== weakest), cand.code];
}
