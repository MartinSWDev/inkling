import { describe, expect, it } from "vitest";
import { BUILDINGS, LiveStreamParser, normaliseSuits, PAPERS, placeholderSnapshot, type LiveEvent } from "./simData";

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
  it("normalises suits given as code+name, bare names, or nonsense (prompts/25)", () => {
    const subjects = [
      { code: "CAH06-01-03", display_name: "Agriculture" },
      { code: "CAH03-02-01", display_name: "Sport and exercise sciences" },
    ];
    expect(normaliseSuits(["CAH06-01-03 Agriculture", "sport and exercise sciences", "nonsense"], subjects))
      .toEqual(["CAH06-01-03", "CAH03-02-01"]);
    expect(normaliseSuits("CAH03-02-01", subjects)).toEqual(["CAH03-02-01"]);
    expect(normaliseSuits(["CAH06-01-03", "CAH06-01-03 Agriculture"], subjects)).toEqual(["CAH06-01-03"]);
    expect(normaliseSuits(null, subjects)).toEqual([]);
  });
  it("parses the live @@ stream into events, split mid-line", () => {
    const fixture = [
      "@@status writing persona\n@@persona\n@@think 840\n",
      "```json\n{\"first_name\":\"Maya\",\"age\":17,\"where\":\"Leeds\",\"studying\":\"A-level Biology\",\"enjoys\":\"Keeps bees.\",\"certainty\":\"torn\",\"suits\":[\"CAH01-01-02\"]}\n```\n",
      "@@status playing the game\n@@pl",
      "ay\n{\"chips\":[{\"id\":\"biology\",\"state\":\"love\"}],\"typed\":[],\"things\":{\"radio\":\"yes\"},\"pairs\":{\"p1\":\"a\"},\"questions\":{\"dream\":\"up\"}}\n",
      "@@status scoring\n@@done\n",
    ];
    const parser = new LiveStreamParser();
    const events: LiveEvent[] = fixture.flatMap((c) => parser.push(c));
    events.push(...parser.finish());
    expect(events.map((e) => e.kind)).toEqual(["status", "think", "persona", "status", "play", "status"]);
    expect(events[0]).toEqual({ kind: "status", text: "writing persona" });
    expect(events[1]).toEqual({ kind: "think", n: 840 });
    const persona = events.find((e) => e.kind === "persona");
    expect(persona?.kind === "persona" && persona.persona).toMatchObject({ first_name: "Maya", suits: ["CAH01-01-02"] });
    const play = events.find((e) => e.kind === "play");
    expect(play?.kind === "play" && play.play).toMatchObject({ things: { radio: "yes" }, questions: { dream: "up" } });
    expect(parser.sawDone).toBe(true);
    expect(parser.persona?.first_name).toBe("Maya");
  });
  it("is deterministic", () => {
    expect(placeholderSnapshot().students.map((s) => s.id))
      .toEqual(placeholderSnapshot().students.map((s) => s.id));
  });
});
