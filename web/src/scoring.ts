// Browser port of api/scoring.py — same maths, verified by the shared fixture
// (api/tests/fixtures/scoring_cases.json) in both pytest and vitest.
export type CardLike = { code: string; display_name: string; name: string; keywords: string[]; neighbours: string[]; slot: string; object: string };
export type AnswersLike = {
  chips?: { id: string; state: string }[];
  typed?: string[];
  swipes?: { card_id: string; answer: string }[];
  subject_swipes?: { code: string; answer: string }[];
  pairs?: { pair_id: string; side: string | null }[];
  shown?: string[];
};
export type DeckLike = { chips: { id: string; name: string; terms: string[] }[]; things: DeckCardW[]; questions: DeckCardW[] };
export type DeckCardW = { id: string; title: string; terms: Record<string, number> };
export type PairLike = { id: string; a: { label: string; scores: Record<string, number> }; b: { label: string; scores: Record<string, number> } };
export type RankedRow = { code: string; display_name: string; score: number; uncertainty: number; direct: number; reasons: string[] };

const MULT: Record<string, number> = { yes: 1, no: -0.5, up: 2 };
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function tokens(card: CardLike) {
  return (card.display_name + " " + card.name + " " + card.keywords.join(" ")).toLowerCase();
}

export function expandTerms(termWeights: Record<string, number>, cards: CardLike[]) {
  const out: Record<string, number> = {};
  for (const card of cards) {
    const text = tokens(card);
    let total = 0;
    for (const [term, w] of Object.entries(termWeights)) if (text.includes(term.toLowerCase())) total += w;
    if (total > 0) out[card.code] = Math.min(total, 0.9);
  }
  return out;
}

type State = { score: Record<string, number>; unc: Record<string, number>; direct: Record<string, number>; contrib: Record<string, Record<string, number>> };

function apply(state: State, byCode: Record<string, CardLike>, weights: Record<string, number>, mult: number, label: string) {
  const { score, unc, direct, contrib } = state;
  for (const [code, wt] of Object.entries(weights)) {
    if (!(code in byCode)) continue;
    const d = wt * mult;
    score[code] += d;
    unc[code] *= 1 - 0.6 * wt * Math.min(1, Math.abs(mult));
    if (mult > 0) {
      direct[code] += wt;
      contrib[code][label] = (contrib[code][label] || 0) + d;
    }
    for (const nb of byCode[code].neighbours || []) {
      if (nb in score) {
        score[nb] += d * 0.35;
        unc[nb] *= 1 - 0.2 * wt;
      }
    }
  }
}

function zscores(profiles: Record<string, Record<string, number>>) {
  const measures = new Set<string>();
  for (const p of Object.values(profiles)) for (const [k, v] of Object.entries(p)) if (typeof v === "number") measures.add(k);
  const stats: Record<string, [number, number]> = {};
  for (const m of measures) {
    const vals = Object.values(profiles).map((p) => p[m]).filter((v) => typeof v === "number");
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length) || 1;
    stats[m] = [mean, sd];
  }
  return stats;
}

export function scoreAnswers(
  answers: AnswersLike, cards: CardLike[], profiles: Record<string, Record<string, number>>,
  pairsData: PairLike[], decks: DeckLike,
): { ranked: RankedRow[]; surprise: string | null; room: string[] } {
  const byCode: Record<string, CardLike> = Object.fromEntries(cards.map((c) => [c.code, c]));
  const state: State = {
    score: Object.fromEntries(cards.map((c) => [c.code, 0])),
    unc: Object.fromEntries(cards.map((c) => [c.code, 1])),
    direct: Object.fromEntries(cards.map((c) => [c.code, 0])),
    contrib: Object.fromEntries(cards.map((c) => [c.code, {}])),
  };
  const chips: Record<string, DeckLike["chips"][number]> = Object.fromEntries(decks.chips.map((c) => [c.id, c]));
  const deckCards: Record<string, DeckCardW> = Object.fromEntries([...decks.things, ...decks.questions].map((c) => [c.id, c]));
  for (const pick of answers.chips || []) {
    const chip = chips[pick.id];
    if (chip) apply(state, byCode, expandTerms(Object.fromEntries(chip.terms.map((t) => [t, 0.6])), cards), pick.state === "love" ? 1 : 0.4, chip.name);
  }
  for (const name of answers.typed || []) {
    const w = expandTerms({ [name.toLowerCase()]: 0.6 }, cards);
    if (Object.keys(w).length) apply(state, byCode, w, 0.4, name);
  }
  for (const swipe of answers.swipes || []) {
    const card = deckCards[swipe.card_id];
    if (card && swipe.answer in MULT) apply(state, byCode, expandTerms(card.terms, cards), MULT[swipe.answer], card.title);
  }
  for (const swipe of answers.subject_swipes || []) {
    if (swipe.code in byCode && swipe.answer in MULT)
      apply(state, byCode, { [swipe.code]: 1 }, MULT[swipe.answer], byCode[swipe.code].display_name);
  }
  const pairs: Record<string, PairLike> = Object.fromEntries(pairsData.map((p) => [p.id, p]));
  const stats = zscores(profiles);
  const userVec: Record<string, number> = {};
  const pairLabels: Record<string, string> = {};
  for (const pick of answers.pairs || []) {
    const pair = pairs[pick.pair_id];
    if (!pair || (pick.side !== "a" && pick.side !== "b")) continue;
    for (const [m, v] of Object.entries(pair[pick.side].scores || {})) {
      userVec[m] = (userVec[m] || 0) + v;
      pairLabels[m] = pair[pick.side].label;
    }
  }
  if (Object.keys(userVec).length) {
    for (const [code, prof] of Object.entries(profiles)) {
      if (!(code in state.score)) continue;
      let total = 0;
      for (const m of Object.keys(userVec)) if (typeof prof[m] === "number" && m in stats) total += userVec[m] * (prof[m] - stats[m][0]) / stats[m][1];
      if (total) {
        state.score[code] += total * 0.35;
        state.unc[code] *= 0.9;
        const top = Object.keys(userVec).reduce((a, b) => (Math.abs(userVec[a]) >= Math.abs(userVec[b]) ? a : b));
        if (total > 0) state.contrib[code][pairLabels[top]] = (state.contrib[code][pairLabels[top]] || 0) + total * 0.35;
      }
    }
  }
  const ranked: RankedRow[] = cards.map((c) => ({
    code: c.code, display_name: c.display_name, score: round3(state.score[c.code]),
    uncertainty: round3(state.unc[c.code]), direct: round3(state.direct[c.code]),
    reasons: Object.entries(state.contrib[c.code]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k),
  })).sort((a, b) => b.score - a.score);
  const surprise = ranked.find((r) => r.score > 0.3 && r.direct < 0.15)?.code ?? null;
  const room = ranked.filter((r) => r.score > 0.15).slice(0, 8).map((r) => r.code);
  return { ranked, surprise, room };
}

export function qualifiedSubjects(
  answers: AnswersLike, cards: CardLike[], profiles: Record<string, Record<string, number>>,
  pairsData: PairLike[], decks: DeckLike,
): Set<string> {
  const out = new Set<string>();
  const chips: Record<string, DeckLike["chips"][number]> = Object.fromEntries(decks.chips.map((c) => [c.id, c]));
  const deckCards: Record<string, DeckCardW> = Object.fromEntries([...decks.things, ...decks.questions].map((c) => [c.id, c]));
  for (const pick of answers.chips || []) {
    if (pick.state !== "love") continue;
    const chip = chips[pick.id];
    if (!chip) continue;
    const weights = expandTerms(Object.fromEntries(chip.terms.map((t) => [t, 0.6])), cards);
    let best: string | null = null;
    for (const c of cards) if (weights[c.code] && (best === null || weights[c.code] > weights[best])) best = c.code;
    if (best) out.add(best);
  }
  for (const swipe of answers.swipes || []) {
    const card = deckCards[swipe.card_id];
    if (card && (swipe.answer === "yes" || swipe.answer === "up"))
      for (const code of Object.keys(expandTerms(card.terms, cards))) out.add(code);
  }
  for (const swipe of answers.subject_swipes || [])
    if (swipe.answer === "yes" || swipe.answer === "up") out.add(swipe.code);
  const pairs: Record<string, PairLike> = Object.fromEntries(pairsData.map((p) => [p.id, p]));
  const stats = zscores(profiles);
  const userVec: Record<string, number> = {};
  for (const pick of answers.pairs || []) {
    const pair = pairs[pick.pair_id];
    if (!pair || (pick.side !== "a" && pick.side !== "b")) continue;
    for (const [m, v] of Object.entries(pair[pick.side].scores || {})) userVec[m] = (userVec[m] || 0) + v;
  }
  for (const [code, prof] of Object.entries(profiles)) {
    let total = 0;
    for (const m of Object.keys(userVec)) if (typeof prof[m] === "number" && m in stats) total += userVec[m] * (prof[m] - stats[m][0]) / stats[m][1];
    if (total > 0) out.add(code);
  }
  return out;
}
