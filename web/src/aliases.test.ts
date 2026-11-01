import { describe, expect, it } from "vitest";
import { lookupAlias, normalise, suggestAliases } from "./aliases";

const index = {
  psych: { "CAH04-01-01": 0.8, "CAH04-01-05": 0.8 },
  psychology: { "CAH04-01-01": 1.0 },
  "btec sport": { "CAH03-02-01": 1.0, "CAH02-06-05": 0.5 },
  sport: { "CAH03-02-01": 0.8 },
};

describe("typed subject aliases", () => {
  it("normalises case, punctuation and spaces", () => {
    expect(normalise("  BTEC  Sport!! ")).toBe("btec sport");
  });
  it('"psych" resolves to psychology', () => {
    const m = lookupAlias(index, "psych");
    expect(m).not.toBeNull();
    expect(Object.keys(m!)).toContain("CAH04-01-01");
  });
  it('"btec sport" resolves to sport and exercise sciences', () => {
    const m = lookupAlias(index, "BTEC Sport");
    expect(m).not.toBeNull();
    expect(m!["CAH03-02-01"]).toBeGreaterThan(0);
  });
  it('"psycology" fuzzy-matches psychology', () => {
    const m = lookupAlias(index, "psycology");
    expect(m).not.toBeNull();
    expect(Object.keys(m!)).toContain("CAH04-01-01");
  });
  it("suggests subject names while typing", () => {
    const names: Record<string, string> = { "CAH04-01-01": "Psychology", "CAH04-01-05": "Others in psychology", "CAH03-02-01": "Sport and exercise sciences" };
    expect(suggestAliases(index, "psy", (c) => names[c])).toContain("Psychology");
    expect(suggestAliases(index, "btec", (c) => names[c])).toContain("Sport and exercise sciences");
  });
});
