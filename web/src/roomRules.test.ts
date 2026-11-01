import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qualifiedSubjects, scoreAnswers } from "./scoring";
import { ROUND_CAPS, collectRoundAdds, diverseTop, ensureFloorOrBed, ensureResults, growRoom } from "./roomRules";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const cards = load("../../data/subject_cards.json").cards;
const profiles = load("../../data/subject_profiles.json").subjects;
const pairs = load("../../data/pairs.json").pairs;
const decks = load("../../data/scoring_decks.json");
const scoresOf = (ans: object) => Object.fromEntries(scoreAnswers(ans as never, cards, profiles, pairs, decks).ranked.map((r) => [r.code, r.score]));
const rankedOf = (ans: object) => scoreAnswers(ans as never, cards, profiles, pairs, decks).ranked;

describe("room growth rules", () => {
  it("tapping 3 chips adds 0 objects", () => {
    const ans = { chips: [{ id: "maths", state: "take" }, { id: "english", state: "take" }, { id: "biology", state: "take" }] };
    const qualified = qualifiedSubjects(ans, cards, profiles, pairs, decks);
    expect(qualified.size).toBe(0);
    expect(growRoom([], {}, rankedOf(ans), qualified, ROUND_CAPS[0])).toEqual([]);
  });

  it("hearting 1 chip adds exactly its closest subject", () => {
    const ans = { chips: [{ id: "physics", state: "love" }] };
    const qualified = qualifiedSubjects(ans, cards, profiles, pairs, decks);
    expect([...qualified]).toEqual(["CAH07-01-01"]);
    expect(growRoom([], {}, rankedOf(ans), qualified, ROUND_CAPS[0])).toEqual(["CAH07-01-01"]);
  });

  it("one swipe never adds more than 1, and the room respects the round cap", () => {
    let room: string[] = [];
    let prev = scoresOf({});
    for (const id of ["radio", "rover", "code", "printer", "chart"]) {
      const ans = { swipes: [{ card_id: id, answer: "yes" }] };
      const ranked = rankedOf(ans);
      const next = growRoom(room, prev, ranked, qualifiedSubjects(ans, cards, profiles, pairs, decks), ROUND_CAPS[1]);
      expect(next.length - room.length).toBeLessThanOrEqual(1);
      expect(next.length).toBeLessThanOrEqual(ROUND_CAPS[1]);
      room = next; prev = scoresOf(ans);
    }
    expect(room.length).toBeGreaterThan(0);
  });

  it("one pair choice counts as round 2+ evidence and adds at most 1 object", () => {
    const ans = { pairs: [{ pair_id: "why_vs_make", side: "a" }] };
    const qualified = qualifiedSubjects(ans, cards, profiles, pairs, decks);
    expect(qualified.size).toBeGreaterThan(0);
    const room = growRoom([], {}, rankedOf(ans), qualified, ROUND_CAPS[2]);
    expect(room.length).toBe(1);
    expect(qualified.has(room[0])).toBe(true);
  });

  it("an undecided pair adds no objects", () => {
    const ans = { pairs: [{ pair_id: "why_vs_make", side: null }] };
    const qualified = qualifiedSubjects(ans, cards, profiles, pairs, decks);
    expect(growRoom([], {}, rankedOf(ans), qualified, ROUND_CAPS[2])).toEqual([]);
  });

  it("the room never exceeds 7 during the rounds", () => {
    expect(ROUND_CAPS).toEqual([2, 4, 6, 7]);
    let room: string[] = [];
    let prev = scoresOf({});
    for (const id of ["radio", "rover", "code", "printer", "chart", "fossil", "bridge", "gig", "club", "paint"]) {
      const ans = { swipes: [{ card_id: id, answer: "yes" }] };
      room = growRoom(room, prev, rankedOf(ans), qualifiedSubjects(ans, cards, profiles, pairs, decks), ROUND_CAPS[3]);
      expect(room.length).toBeLessThanOrEqual(7);
      prev = scoresOf(ans);
    }
    expect(room.length).toBe(7);
  });

  it("round-end batch: hearting 1 chip collects exactly its subject, nothing before", () => {
    const ans = { chips: [{ id: "physics", state: "love" }] };
    const qualified = qualifiedSubjects(ans, cards, profiles, pairs, decks);
    expect(collectRoundAdds([], {}, rankedOf(ans), qualified, ROUND_CAPS[0])).toEqual(["CAH07-01-01"]);
  });

  it("round-end batch: several swipes collect up to the round cap at once", () => {
    const ans = { swipes: ["radio", "rover", "code", "printer", "chart"].map((id) => ({ card_id: id, answer: "yes" })) };
    const adds = collectRoundAdds([], {}, rankedOf(ans), qualifiedSubjects(ans, cards, profiles, pairs, decks), ROUND_CAPS[1]);
    expect(adds.length).toBeGreaterThan(0);
    expect(adds.length).toBeLessThanOrEqual(ROUND_CAPS[1]);
    expect(new Set(adds).size).toBe(adds.length);
    const room = ["X1", "X2", "X3"];
    const more = collectRoundAdds(room, {}, rankedOf(ans), qualifiedSubjects(ans, cards, profiles, pairs, decks), ROUND_CAPS[1]);
    expect(room.length + more.length).toBeLessThanOrEqual(ROUND_CAPS[1]);
    expect(more).not.toContain("X1");
  });

  it("round-end batch: undecided pair and take-only chips collect nothing", () => {
    const pairAns = { pairs: [{ pair_id: "why_vs_make", side: null }] };
    expect(collectRoundAdds([], {}, rankedOf(pairAns), qualifiedSubjects(pairAns, cards, profiles, pairs, decks), ROUND_CAPS[2])).toEqual([]);
    const chipAns = { chips: [{ id: "maths", state: "take" }, { id: "english", state: "take" }, { id: "biology", state: "take" }] };
    expect(collectRoundAdds([], {}, rankedOf(chipAns), qualifiedSubjects(chipAns, cards, profiles, pairs, decks), ROUND_CAPS[0])).toEqual([]);
  });

  it("reveal keeps a floor or bed object when a qualified one exists", () => {
    const ranked = [
      { code: "A", display_name: "A", score: 5, uncertainty: 1, direct: 1, reasons: [] },
      { code: "B", display_name: "B", score: 1, uncertainty: 1, direct: 1, reasons: [] },
      { code: "F", display_name: "F", score: 3, uncertainty: 1, direct: 1, reasons: [] },
    ];
    const slots: Record<string, string> = { A: "shelf", B: "desk", F: "floor" };
    expect(ensureFloorOrBed(["A", "B"], ranked, new Set(["A", "B", "F"]), (c) => slots[c])).toEqual(["A", "F"]);
    expect(ensureFloorOrBed(["A", "F"], ranked, new Set(["A", "F"]), (c) => slots[c])).toEqual(["A", "F"]);
  });

  it("during rounds a placed object never leaves, even at the cap", () => {
    const ranked = [
      { code: "NEW", display_name: "New", score: 9, uncertainty: 1, direct: 1, reasons: [] },
      { code: "A", display_name: "A", score: 5, uncertainty: 1, direct: 1, reasons: [] },
      { code: "B", display_name: "B", score: 1, uncertainty: 1, direct: 1, reasons: [] },
    ];
    expect(growRoom(["A", "B"], { A: 5, B: 1 }, ranked, new Set(["NEW", "A", "B"]), 2)).toEqual(["A", "B"]);
    expect(growRoom(["A"], { A: 5 }, ranked, new Set(["NEW", "A", "B"]), 2)).toEqual(["A", "NEW"]);
  });

  it("top 3 keeps at most one subject per CAH level-2 parent", () => {
    const row = (code: string, score: number) => ({ code, display_name: code, score, uncertainty: 1, direct: 1, reasons: [] });
    const ranked = [row("CAH10-01-01", 10), row("CAH10-01-02", 9), row("CAH07-01-01", 8), row("CAH03-01-02", 7)];
    const parentOf = (c: string) => c.split("-").slice(0, 2).join("-");
    expect(diverseTop(ranked, parentOf).map((r) => r.code)).toEqual(["CAH10-01-01", "CAH07-01-01", "CAH03-01-02"]);
    // ...unless the next distinct subject scores under 70% of the duplicate
    const weak = [row("CAH10-01-01", 10), row("CAH10-01-02", 9), row("CAH07-01-01", 6), row("CAH03-01-02", 5)];
    expect(diverseTop(weak, parentOf).map((r) => r.code)).toEqual(["CAH10-01-01", "CAH10-01-02", "CAH07-01-01"]);
  });

  it("reveal puts every result in the room, swapping only non-results", () => {
    const ranked = [
      { code: "T1", display_name: "T1", score: 9, uncertainty: 1, direct: 1, reasons: [] },
      { code: "W", display_name: "W", score: 8, uncertainty: 1, direct: 0, reasons: [] },
      { code: "A", display_name: "A", score: 5, uncertainty: 1, direct: 1, reasons: [] },
      { code: "B", display_name: "B", score: 1, uncertainty: 1, direct: 1, reasons: [] },
    ];
    const full = ["A", "B", "C1", "C2", "C3", "C4", "C5", "C6"];
    const out = ensureResults(full, ["T1", "W"], ranked);
    expect(out.length).toBe(8);
    expect(out).toContain("T1");
    expect(out).toContain("W");
    expect(ensureResults(["A"], ["T1"], ranked)).toEqual(["A", "T1"]);
  });
});
