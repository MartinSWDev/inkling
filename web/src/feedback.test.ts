import { describe, it, expect } from "vitest";
import { feedbackPayload, newGameId, APP_VERSION } from "./feedback";

describe("feedback", () => {
  it("keeps at most 3 top codes", () => {
    const payload = feedbackPayload({
      gameId: "test-game-123",
      kind: "vote",
      vote: "up",
      top: ["CAH01-01-01", "CAH01-01-02", "CAH01-01-03", "CAH01-01-04"],
      wildcard: null,
      answers: {},
    });
    expect(payload.top).toEqual(["CAH01-01-01", "CAH01-01-02", "CAH01-01-03"]);
    expect(payload.top.length).toBe(3);
  });

  it("sets app_version", () => {
    const payload = feedbackPayload({
      gameId: "test-game-123",
      kind: "vote",
      vote: "up",
      top: [],
      wildcard: null,
      answers: {},
    });
    expect(payload.app_version).toBe(APP_VERSION);
    expect(payload.app_version).toBe("2026-11-03");
  });

  it("newGameId returns 8-64 chars of [A-Za-z0-9-]", () => {
    const id = newGameId();
    expect(id.length).toBeGreaterThanOrEqual(8);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(id).toMatch(/^[A-Za-z0-9-]+$/);
  });
});
