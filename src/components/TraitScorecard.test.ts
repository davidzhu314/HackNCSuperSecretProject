import { describe, expect, it } from "vitest";
import { averageTraitScores } from "../lib/trait-scores";
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
});
