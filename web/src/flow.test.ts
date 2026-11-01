import { describe, expect, it } from "vitest";
import { shuffledDeck } from "./flow";

const cards = Array.from({ length: 18 }, (_, i) => "card" + i);

describe("shuffledDeck (prompts/16 3)", () => {
  it("same seed replays the same order, a different seed differs", () => {
    expect(shuffledDeck(cards, 42)).toEqual(shuffledDeck(cards, 42));
    expect(shuffledDeck(cards, 42)).not.toEqual(shuffledDeck(cards, 7));
    expect([...shuffledDeck(cards, 42)].sort()).toEqual([...cards].sort());
  });
  it("seed 0 keeps the fixed order and never mutates the input", () => {
    const input = [...cards];
    expect(shuffledDeck(input, 0)).toEqual(cards);
    shuffledDeck(input, 99);
    expect(input).toEqual(cards);
  });
});
