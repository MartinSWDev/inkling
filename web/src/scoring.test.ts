import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { handsOnPicks, isPractical, lengthLabel, levelLabel, scoreAnswers, type Apprenticeship } from "./scoring";

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

describe("hands-on routes (prompts/12 D)", () => {
  it("needs two practical signals", () => {
    expect(isPractical({ swipes: [{ card_id: "radio", answer: "yes" }], pairs: [] })).toBe(false);
    expect(isPractical({ swipes: [{ card_id: "radio", answer: "yes" }], pairs: [{ pair_id: "why_vs_make", side: "b" }] })).toBe(true);
    expect(isPractical({ swipes: [{ card_id: "radio", answer: "yes" }, { card_id: "bridge", answer: "yes" }], pairs: [] })).toBe(true);
    expect(isPractical({ swipes: [{ card_id: "code", answer: "yes" }], pairs: [{ pair_id: "indoors_vs_outdoors", side: "a" }] })).toBe(false);
    expect(isPractical({ swipes: [], pairs: [{ pair_id: "why_vs_make", side: "b" }, { pair_id: "indoors_vs_outdoors", side: "b" }] })).toBe(true);
  });
  it("prefers degree apprenticeships, then levels 3-5, titles unique", () => {
    const mk = (title: string, level: number, degree: boolean): Apprenticeship =>
      ({ ref: title, title, level, months: 36, degree, url: "https://example.com", reason: "r" });
    const picks = handsOnPicks({ A: [mk("Welder", 3, false), mk("Engineer", 6, true)], B: [mk("Welder", 3, false), mk("Tech", 4, false), mk("Other", 2, false)] }, ["A", "B"]);
    expect(picks.map((p) => p.title)).toEqual(["Engineer", "Welder", "Tech"]);
  });
  it("labels levels and lengths in plain words", () => {
    expect(levelLabel(3)).toContain("Hands-on");
    expect(levelLabel(5)).toBe("Higher apprenticeship");
    expect(levelLabel(6)).toBe("Degree apprenticeship");
    expect(levelLabel(7)).toBe("Master's level");
    expect(lengthLabel(60)).toBe("about 5 years");
    expect(lengthLabel(36)).toBe("about 3 years");
  });
});
