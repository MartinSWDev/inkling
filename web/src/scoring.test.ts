import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scoreAnswers } from "./scoring";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const cards = load("../../data/subject_cards.json").cards;
const profiles = load("../../data/subject_profiles.json").subjects;
const pairs = load("../../data/pairs.json").pairs;
const decks = load("../../data/scoring_decks.json");
const fixture = load("../../api/tests/fixtures/scoring_cases.json");

describe("shared scoring fixture (same file as pytest)", () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const result = scoreAnswers(c.answers, cards, profiles, pairs, decks);
      const rows: Record<string, (typeof result.ranked)[number]> = Object.fromEntries(result.ranked.map((r) => [r.code, r]));
      const exp = c.expect;
      if (exp.zero_all) for (const r of result.ranked) { expect(r.score).toBe(0); expect(r.uncertainty).toBe(1); }
      if (exp.top) expect(result.ranked[0].code).toBe(exp.top);
      if (exp.top_score !== undefined) expect(Math.abs(result.ranked[0].score - exp.top_score)).toBeLessThan(0.02);
      for (const code of exp.positive || []) expect(rows[code].score).toBeGreaterThan(0);
      for (const code of exp.negative || []) expect(rows[code].score).toBeLessThan(0);
      for (const [code, labels] of Object.entries(exp.reasons || {}))
        for (const label of labels as string[]) expect(rows[code].reasons).toContain(label);
      for (const [a, b] of exp.greater || []) expect(rows[a].score).toBeGreaterThan(rows[b].score);
      for (const code of exp.room_includes || []) expect(result.room).toContain(code);
    });
  }
});
