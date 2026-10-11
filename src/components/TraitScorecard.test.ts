import { describe, expect, it } from "vitest";
import { averageTraitScores, compareOverallTraitScores } from "../lib/trait-scores";
import type { EvaluateResponse } from "../lib/schemas";

const response: EvaluateResponse = {
  source: "live",
  warnings: [],
  critiques: [
    { audience: "recruiter", trait: "clarity", rating: "strong", segmentIds: [], missingEvidence: false, rationale: "Clear role.", suggestion: "" },
    { audience: "manager", trait: "clarity", rating: "moderate", segmentIds: [], missingEvidence: false, rationale: "Mostly clear.", suggestion: "" },
    { audience: "manager", trait: "evidence", rating: "weak", segmentIds: [], missingEvidence: false, rationale: "Needs proof.", suggestion: "" },
  ],
};

describe("trait score aggregation", () => {
  it("averages only the selected audiences on the display scale", () => {
    expect(averageTraitScores(response, ["recruiter", "manager"], ["clarity", "evidence", "missing"])).toEqual({ clarity: 84, evidence: 33, missing: null });
  });
  it("reports whether the rewrite improved the average selected-trait rating", () => {
    const changed: EvaluateResponse = { ...response, critiques: response.critiques.map((item) => ({ ...item, rating: "strong" })) };
    expect(compareOverallTraitScores(response, changed, ["recruiter", "manager"], ["clarity", "evidence"]).improved).toBe(true);
  });
});
