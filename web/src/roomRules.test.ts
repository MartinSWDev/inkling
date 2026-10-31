import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { qualifiedSubjects, scoreAnswers } from "./scoring";
import { ROUND_CAPS, growRoom } from "./roomRules";

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

  it("a full room swaps out only the weakest for a bigger riser", () => {
    const ranked = [
      { code: "NEW", display_name: "New", score: 9, uncertainty: 1, direct: 1, reasons: [] },
      { code: "A", display_name: "A", score: 5, uncertainty: 1, direct: 1, reasons: [] },
      { code: "B", display_name: "B", score: 1, uncertainty: 1, direct: 1, reasons: [] },
    ];
    const next = growRoom(["A", "B"], { A: 5, B: 1 }, ranked, new Set(["NEW", "A", "B"]), 2);
    expect(next).toEqual(["A", "NEW"]);
  });
});
