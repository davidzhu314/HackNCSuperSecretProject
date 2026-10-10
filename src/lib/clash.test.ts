import { describe, expect, it } from "vitest";
import { critiquesBySection, findDisagreements, missingEvidence } from "./clash";
import { DEMO_LINKEDIN_PROFILE, SAMPLE_PROFILE_EVALUATE } from "./demo-data";
import { sectionOfSegment, segmentProfile } from "./profile";
import type { AudienceCritique } from "./schemas";

const c = (audience: string, rating: AudienceCritique["rating"], segmentIds: string[], trait = "clarity"): AudienceCritique => ({
  audience,
  trait,
  rating,
  segmentIds,
  missingEvidence: segmentIds.length === 0,
  rationale: "r",
  suggestion: "s",
});

describe("findDisagreements", () => {
  it("finds sentences two audiences rate two or more levels apart", () => {
    const d = findDisagreements([c("a", "strong", ["s1"]), c("b", "weak", ["s1"]), c("c", "moderate", ["s1"])]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ segmentId: "s1", gap: 2 });
    expect(d[0].high.audience).toBe("a");
    expect(d[0].low.audience).toBe("b");
  });

  it("ignores one-level gaps and same-audience pairs", () => {
    expect(findDisagreements([c("a", "strong", ["s1"]), c("b", "moderate", ["s1"])])).toEqual([]);
    expect(findDisagreements([c("a", "strong", ["s1"]), c("a", "not_evident", ["s1"], "relevance")])).toEqual([]);
  });

  it("keeps the widest gap per sentence and sorts widest first, then by profile order", () => {
    const d = findDisagreements(
      [c("a", "moderate", ["s2"]), c("b", "not_evident", ["s2"]), c("a", "strong", ["s1"]), c("b", "not_evident", ["s1"]), c("c", "weak", ["s3"]), c("a", "strong", ["s3"])],
      ["s1", "s2", "s3"],
    );
    expect(d.map((x) => [x.segmentId, x.gap])).toEqual([["s1", 3], ["s2", 2], ["s3", 2]]);
  });
});

describe("critiquesBySection / missingEvidence", () => {
  it("groups the sample critiques by section and separates missing evidence", () => {
    const all = SAMPLE_PROFILE_EVALUATE.critiques;
    const groups = critiquesBySection(all, sectionOfSegment);
    const missing = missingEvidence(all);
    const grouped = [...groups.values()].flat();
    expect(grouped.length + missing.length).toBe(all.length);
    const known = new Set(segmentProfile(DEMO_LINKEDIN_PROFILE).map((s) => sectionOfSegment(s.id)));
    for (const key of groups.keys()) expect(known.has(key)).toBe(true);
  });
});
