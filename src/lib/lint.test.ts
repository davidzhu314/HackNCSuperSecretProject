import { describe, expect, it } from "vitest";
import { buzzwordsIn, lintSegments, scoreRewrite, specificsIn } from "./lint";

const seg = (id: string, text: string) => ({ id, text });
const kinds = (issues: { kind: string }[]) => issues.map((i) => i.kind);

describe("lintSegments", () => {
  it("flags buzzwords once per segment", () => {
    const issues = lintSegments([seg("about-s1", "I am a passionate, hardworking team player. Passionate!")], "professional");
    const buzz = issues.filter((i) => i.kind === "buzzword").map((i) => i.text);
    expect(buzz).toEqual(["passionate", "hardworking", "team player"]);
    expect(issues.every((i) => i.segmentId === "about-s1")).toBe(true);
  });

  it("flags a LinkedIn headline with no role, and not one with a role", () => {
    expect(kinds(lintSegments([seg("headline-s1", "Aspiring tech professional | Passionate about innovation")], "professional", "headline-s1"))).toContain("no_role");
    expect(kinds(lintSegments([seg("headline-s1", "Computer science senior | Python and React")], "professional", "headline-s1"))).not.toContain("no_role");
  });

  it("flags sentences with no specifics on professional profiles only", () => {
    const text = "I like working on interesting problems with smart people every day.";
    expect(kinds(lintSegments([seg("about-s1", text)], "professional"))).toContain("vague");
    expect(kinds(lintSegments([seg("s1", text)], "dating"))).not.toContain("vague");
    expect(kinds(lintSegments([seg("about-s1", "I built a course planner in React used by 40 students.")], "professional"))).not.toContain("vague");
  });

  it("flags duties, long sentences, and repeated words", () => {
    const long = Array.from({ length: 35 }, (_, i) => `word${i}`).join(" ") + ".";
    const issues = lintSegments(
      [seg("exp1-s2", "Responsible for testing. Testing dashboards, testing pipelines, testing scripts."), seg("about-s1", long)],
      "professional",
    );
    expect(kinds(issues)).toEqual(expect.arrayContaining(["duty", "long_sentence", "repeat"]));
    expect(issues.find((i) => i.kind === "repeat")?.text).toBe("testing");
  });

  it("returns nothing for clean, specific text", () => {
    expect(lintSegments([seg("about-s1", "Computer science senior at Cedar Valley University. I TA'd CS 101 for 120 students.")], "professional")).toEqual([]);
  });
});

describe("specificsIn and scoreRewrite", () => {
  it("counts numbers, names, and tool-like tokens", () => {
    expect(specificsIn("Built a planner in React with Python. Used by 40 students at Cedar Valley.")).toEqual(
      expect.arrayContaining(["40", "React", "Python", "Cedar", "Valley"]),
    );
    expect(specificsIn("I like making pancakes.")).toEqual([]);
  });

  it("compares before and after with real counts", () => {
    const card = scoreRewrite("Passionate, hardworking student.", "CS senior who built a React app for 40 students.", 2);
    expect(card.buzzwordsBefore).toBe(2);
    expect(card.buzzwordsAfter).toBe(0);
    expect(card.specificsAfter).toBeGreaterThan(card.specificsBefore);
    expect(card.factsUsed).toBe(2);
    expect(card.charsBefore).toBe(32);
  });

  it("finds buzzwords with dashes or spaces", () => {
    expect(buzzwordsIn("A go getter and detail-oriented self starter").map((b) => b.toLowerCase())).toEqual([
      "go getter",
      "detail-oriented",
      "self starter",
    ]);
  });
});
