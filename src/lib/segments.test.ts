import { describe, expect, it } from "vitest";
import { LIMITS } from "./schemas";
import { resolveSegmentIds, segmentHinge, segmentLinkedIn } from "./segments";

describe("segmentLinkedIn", () => {
  it("makes the headline one segment and splits About into sentences", () => {
    const s = segmentLinkedIn({ headline: "CS senior", about: "I built an app. I was a TA!" });
    expect(s.map((x) => x.text)).toEqual(["CS senior", "I built an app.", "I was a TA!"]);
    expect(s.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("splits an overlong sentence into chunks at word boundaries without losing text", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const s = segmentLinkedIn({ headline: "", about: words });
    expect(s.length).toBeGreaterThan(1);
    for (const seg of s) expect(seg.text.length).toBeLessThanOrEqual(LIMITS.segmentText);
    expect(s.map((x) => x.text).join(" ")).toBe(words);
  });
});

describe("segmentHinge", () => {
  it("keeps each prompt with its answer and skips empty answers", () => {
    const s = segmentHinge([
      { prompt: "A perfect Sunday", answer: "Pancakes." },
      { prompt: "Empty", answer: "  " },
    ]);
    expect(s).toEqual([{ id: "s1", text: "Pancakes.", prompt: "A perfect Sunday" }]);
  });
});

describe("resolveSegmentIds", () => {
  it("separates known and unknown ids and drops duplicates", () => {
    const segs = segmentLinkedIn({ headline: "a", about: "B." });
    const r = resolveSegmentIds(["s1", "s1", "s9"], segs);
    expect(r.resolved.map((x) => x.id)).toEqual(["s1"]);
    expect(r.unknown).toEqual(["s9"]);
  });
});
