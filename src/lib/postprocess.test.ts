import { describe, expect, it } from "vitest";
import { buildCandidateFacts, buildCritiques, buildVariations } from "./postprocess";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_SEGMENTS } from "./demo-data";

const requested = { audienceIds: ["startup_founder"], traitIds: ["clarity", "relevance"] };
const base = { rating: "weak" as const, rationale: "r", suggestion: "s" };

describe("buildCandidateFacts", () => {
  it("never confirms, dedupes, and drops empties", () => {
    const f = buildCandidateFacts(["I study CS.", " i study cs. ", "", "I like tea."]);
    expect(f.map((x) => x.id)).toEqual(["f1", "f2"]);
    expect(f.every((x) => x.confirmed === false && x.source === "extracted")).toBe(true);
  });
});

describe("buildCritiques", () => {
  it("removes unknown segment ids, warns, and sets missingEvidence", () => {
    const out = buildCritiques(
      {
        critiques: [
          { ...base, audience: "startup_founder", trait: "clarity", segmentIds: ["s99"], missingEvidence: false },
          { ...base, audience: "startup_founder", trait: "relevance", segmentIds: ["s1", "s2"], missingEvidence: true },
        ],
      },
      requested,
      DEMO_LINKEDIN_SEGMENTS,
    );
    expect(out.source).toBe("live");
    expect(out.critiques[0]).toMatchObject({ segmentIds: [], missingEvidence: true });
    expect(out.critiques[1]).toMatchObject({ segmentIds: ["s1", "s2"], missingEvidence: false });
    expect(out.warnings).toEqual([expect.objectContaining({ kind: "unverified_segment", text: "s99" })]);
  });

  it("drops unrequested audiences/traits and duplicates", () => {
    const c = { ...base, segmentIds: ["s1"], missingEvidence: false };
    const out = buildCritiques(
      {
        critiques: [
          { ...c, audience: "startup_founder", trait: "clarity" },
          { ...c, audience: "startup_founder", trait: "clarity" },
          { ...c, audience: "technical_recruiter", trait: "clarity" },
          { ...c, audience: "startup_founder", trait: "warmth" },
        ],
      },
      requested,
      DEMO_LINKEDIN_SEGMENTS,
    );
    expect(out.critiques).toHaveLength(1);
  });
});

describe("buildVariations", () => {
  it("returns both styles, each with its own FactCheck and style warnings", () => {
    const [direct, narrative] = buildVariations(
      {
        direct: { content: "I am a computer science senior.", usedFactIds: ["f1"], changeSummary: ["x"] },
        narrative: {
          content: "I leveraged my role at Google to teach.",
          usedFactIds: ["f1", "f42"],
          changeSummary: [],
        },
      },
      "linkedin",
      DEMO_LINKEDIN_SEGMENTS,
      DEMO_LINKEDIN_FACTS,
    );
    expect(direct).toMatchObject({ style: "direct", warnings: [], styleWarnings: [] });
    expect(narrative.style).toBe("narrative");
    expect(narrative.warnings.map((w) => `${w.kind}:${w.text}`)).toEqual(
      expect.arrayContaining(["unsupported_entity:Google", "invalid_fact_id:f42"]),
    );
    expect(narrative.styleWarnings.map((w) => w.text)).toEqual(["leveraged"]);
  });
});
