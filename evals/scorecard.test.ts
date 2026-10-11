import { describe, expect, it } from "vitest";
import { scoreRewrite, HumanRatingsSchema } from "./scorecard";
import type { EvalCase } from "./schema";

const sample: EvalCase = {
  id: "li-001", platform: "linkedin", origin: "synthetic", status: "draft", tags: ["average"],
  input: { platform: "linkedin", headline: "Student engineer", about: "Built a web app with TypeScript." },
  goldFacts: ["Built a web app with TypeScript."], traps: [{ text: "Managed 20 people", expect: "unsupported_number" }, { text: "Won a national award", expect: "unsupported_entity" }],
  audiences: ["Recruiter"], traits: ["Clarity"],
};

describe("offline rewrite scorecard", () => {
  it("checks platform length and unsupported concrete claims", () => {
    const score = scoreRewrite(sample, "Managed 20 people as a senior engineer.", 20);
    expect(score.overLimit).toBe(true);
    expect(score.unsupportedClaims).toBeGreaterThan(0);
  });
  it("validates human rating anchors", () => {
    expect(HumanRatingsSchema.safeParse({ concision: 5, naturalness: 4, platformFit: 4, critiqueUsefulness: 3, notes: "Specific and grounded." }).success).toBe(true);
    expect(HumanRatingsSchema.safeParse({ concision: 6, naturalness: 4, platformFit: 4, critiqueUsefulness: 3, notes: "" }).success).toBe(false);
  });
});
