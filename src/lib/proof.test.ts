import { describe, expect, it } from "vitest";
import { checkRewrite } from "./fact-guard";
import { buildProofText } from "./proof";

const segments = [{ id: "about-s1", text: "I built a course planner in Python and React." }];
const facts = [{ id: "f1", text: "I was a teaching assistant for an intro programming course.", confirmed: true, source: "user" as const }];

describe("buildProofText", () => {
  it("lists each sentence with its source and a clean FactCheck line", () => {
    const text = "Built a course planner in Python and React. Teaching assistant for an intro programming course.";
    const out = buildProofText({ platformLabel: "LinkedIn", section: "About", text, segments, facts, warnings: [] });
    expect(out).toContain("LinkedIn: About");
    expect(out).toContain('Your profile: "I built a course planner in Python and React."');
    expect(out).toContain('Your fact: "I was a teaching assistant for an intro programming course."');
    expect(out).toContain("No unsupported concrete claims detected.");
    expect(out).not.toContain("verified true");
  });

  it("marks untraced sentences and lists FactCheck warnings", () => {
    const text = "Worked at Google for five years leading a global platform team.";
    const warnings = checkRewrite({ rewrite: { content: text, usedFactIds: [] }, segments, facts });
    const out = buildProofText({ platformLabel: "LinkedIn", section: "About", text, segments, facts, warnings });
    expect(out).toContain("No source in your text or facts.");
    expect(out).toMatch(/Google/);
    expect(out).not.toContain("No unsupported concrete claims detected.");
  });
});
