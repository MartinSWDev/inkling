import { describe, expect, it } from "vitest";
import { heartChip, toggleChip } from "./chips";

describe("round-1 chip heart (B1)", () => {
  it("select Physics, tap heart: selected AND favourited", () => {
    let state = toggleChip(undefined);
    expect(state).toBe("take");
    state = heartChip(state);
    expect(state).toBe("love"); // still selected, now favourited
  });
  it("heart on an unselected chip selects and favourites it", () => {
    expect(heartChip(undefined)).toBe("love");
  });
  it("heart on a favourited chip unfavourites but keeps it selected", () => {
    expect(heartChip("love")).toBe("take");
  });
  it("chip body toggles selection off and on", () => {
    expect(toggleChip("take")).toBeUndefined();
    expect(toggleChip("love")).toBeUndefined();
    expect(toggleChip(undefined)).toBe("take");
  });
});
