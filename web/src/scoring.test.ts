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
      if (exp.top_calibrated !== undefined) expect(Math.abs(result.ranked[0].calibrated - exp.top_calibrated)).toBeLessThan(0.02);
      if (exp.raw_top) {
        const rawTop = result.ranked.reduce((a, b) => (b.score > a.score ? b : a));
        expect(rawTop.code).toBe(exp.raw_top);
        if (exp.raw_top_score !== undefined) expect(Math.abs(rawTop.score - exp.raw_top_score)).toBeLessThan(0.02);
      }
      if (exp.calibrated_first3) expect(result.ranked.slice(0, 3).map((r) => r.code)).toEqual(exp.calibrated_first3);
      for (const [a, b] of exp.greater_calibrated || []) expect(rows[a].calibrated).toBeGreaterThan(rows[b].calibrated);
      for (const code of exp.positive || []) expect(rows[code].score).toBeGreaterThan(0);
      for (const code of exp.negative || []) expect(rows[code].score).toBeLessThan(0);
      for (const [code, labels] of Object.entries(exp.reasons || {}))
        for (const label of labels as string[]) expect(rows[code].reasons).toContain(label);
      for (const [a, b] of exp.greater || []) expect(rows[a].score).toBeGreaterThan(rows[b].score);
      for (const code of exp.room_includes || []) expect(result.room).toContain(code);
    });
  }
});

describe("calibrated scoring (prompts/15 A)", () => {
  it("shipped calibration copy matches data/score_calibration.json", () => {
    const shipped = load("../public/data/score_calibration.json");
    const canonical = load("../../data/score_calibration.json");
    expect(shipped).toEqual(canonical);
  });
  it("missing calibration falls back to raw ranking", () => {
    const result = scoreAnswers({ chips: [{ id: "maths", state: "love" }] }, cards, profiles, pairs, decks, {}, null);
    expect(result.ranked[0].code).toBe("CAH09-01-01");
    for (const r of result.ranked) expect(r.calibrated).toBe(r.score);
  });
  it("Agriculture persona (s00-12) top 3 is not Zoology/Biology/Ecology", () => {
    const students = load("../../data/sim/students.json").students;
    const persona = students.find((s: { id: string }) => s.id === "s00-12");
    expect(persona.suits).toContain("CAH06-01-03");
    const answers: Record<string, unknown[]> = { chips: [], typed: [], swipes: [], pairs: [] };
    for (const [kind, value] of persona.steps as [string, unknown][]) answers[kind].push(value);
    const top3 = scoreAnswers(answers as never, cards, profiles, pairs, decks).ranked.slice(0, 3).map((r) => r.code);
    expect(new Set(top3)).not.toEqual(new Set(["CAH03-01-06", "CAH03-01-03", "CAH03-01-02"]));
    expect(top3.some((c) => c.startsWith("CAH06-01"))).toBe(true);
    expect(top3.some((c) => persona.suits.includes(c))).toBe(true);
  });
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
