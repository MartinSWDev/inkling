import { describe, expect, it } from "vitest";
import { BUILDINGS, PAPERS, placeholderSnapshot } from "./simData";

describe("simulation placeholder data (prompts/14 B)", () => {
  it("generates 30 labelled fake students with a full summary", () => {
    const s = placeholderSnapshot();
    expect(s.placeholder).toBe(true);
    expect(s.students).toHaveLength(30);
    expect(s.summary.students).toBe(30);
    expect(s.summary.total_subjects).toBe(163);
    for (const st of s.students) {
      expect(st.top3.length).toBeGreaterThan(0);
      expect(PAPERS).toContain(st.paper);
      expect(PAPERS).toContain(st.dest_paper);
      expect(st.answers.yes.things_total).toBe(18);
      expect(st.answers.yes.questions_total).toBe(16);
    }
  });
  it("has a building for every paper type", () => {
    for (const p of PAPERS) expect(BUILDINGS[p].length).toBeGreaterThan(2);
    expect(Object.keys(BUILDINGS)).toHaveLength(11);
  });
  it("is deterministic", () => {
    expect(placeholderSnapshot().students.map((s) => s.id))
      .toEqual(placeholderSnapshot().students.map((s) => s.id));
  });
});
