import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchInkling, type InklingInput } from "./live";

const input: InklingInput = {
  top: [{ name: "Biology", plain: "Living things" }],
  wildcard: null,
  answers: { takes: [], loves: [], typed: [], yes: [], really: [], picks: [] },
};

function streamResponse(chunks: string[], headers: Record<string, string>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchInkling", () => {
  it("strips BEL and counts ticks", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      streamResponse(["\u0007\u0007Hel", "lo\u0007 wor", "ld\u0007"], { "x-provider": "baseten", "x-model": "meta-models/muse-spark-open-1026" })));
    const texts: string[] = [];
    const ticksSeen: number[] = [];
    const result = await fetchInkling(input, (t) => texts.push(t), undefined, (n) => ticksSeen.push(n));
    expect(result.text).toBe("Hello world");
    expect(texts).toEqual(["Hel", "Hello wor", "Hello world"]);
    expect(texts.join("")).not.toContain("\u0007");
    expect(ticksSeen).toEqual([2, 3, 4]);
    expect(ticksSeen[ticksSeen.length - 1]).toBe(4);
  });

  it("returns provider/model from headers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      streamResponse(["Hi there"], { "x-provider": "meta", "x-model": "muse-spark-1.3" })));
    const result = await fetchInkling(input, () => undefined);
    expect(result).toEqual({ text: "Hi there", provider: "meta", model: "muse-spark-1.3" });
  });
});
