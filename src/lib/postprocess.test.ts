import { describe, expect, it } from "vitest";
import { buildCandidateFacts, buildCritiques, buildHingeAnswers, buildHingeVariations, buildVariations } from "./postprocess";
import { DEMO_HINGE_FACTS, DEMO_HINGE_SEGMENTS, DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_SEGMENTS } from "./demo-data";

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

describe("buildHingeAnswers", () => {
  it("returns one answer per segment in original order, with prompts", () => {
    const out = buildHingeAnswers(
      { answers: [{ segmentId: "s2", text: " Pancakes, then a walk. " }, { segmentId: "s1", text: "Food trucks." }] },
      DEMO_HINGE_SEGMENTS,
    );
    expect(out.answers.map((a) => [a.segmentId, a.text])).toEqual([
      ["s1", "Food trucks."],
      ["s2", "Pancakes, then a walk."],
    ]);
    expect(out.answers[0].prompt).toBe(DEMO_HINGE_SEGMENTS[0].prompt);
    expect(out.content).toBe("Food trucks.\n\nPancakes, then a walk.");
    expect(out.warnings).toEqual([]);
    expect(out.keptOriginal).toEqual([]);
  });

  it("keeps the original for a missing or empty answer and flags unknown ids", () => {
    const out = buildHingeAnswers(
      {
        answers: [
          { segmentId: "s1", text: "  " },
          { segmentId: "s9", text: "A made-up answer." },
          { segmentId: "s2", text: "First." },
          { segmentId: "s2", text: "Duplicate." },
        ],
      },
      DEMO_HINGE_SEGMENTS,
    );
    expect(out.answers.map((a) => a.text)).toEqual([DEMO_HINGE_SEGMENTS[0].text, "First."]);
    expect(out.keptOriginal.map((s) => s.id)).toEqual(["s1"]);
    expect(out.warnings).toEqual([expect.objectContaining({ kind: "unverified_segment", text: "s9" })]);
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

describe("buildHingeVariations", () => {
  it("returns both styles with per-answer text, FactCheck, and kept-original notes", () => {
    const [direct, narrative] = buildHingeVariations(
      {
        direct: {
          answers: [
            { segmentId: "s1", text: "Finding the best food truck in any city." },
            { segmentId: "s2", text: "Pancakes, then a long walk with no plan." },
          ],
          usedFactIds: ["h1"],
          changeSummary: ["Tightened the second answer."],
        },
        narrative: {
          answers: [{ segmentId: "s1", text: "I have tried 40 food trucks in Paris." }],
          usedFactIds: [],
          changeSummary: [],
        },
      },
      DEMO_HINGE_SEGMENTS,
      DEMO_HINGE_FACTS,
    );
    expect(direct).toMatchObject({ style: "direct", warnings: [] });
    expect(direct.rewrite.answers?.map((a) => a.segmentId)).toEqual(["s1", "s2"]);
    expect(narrative.rewrite.answers?.[1].text).toBe(DEMO_HINGE_SEGMENTS[1].text);
    expect(narrative.rewrite.changeSummary[0]).toContain("Kept your answer");
    expect(narrative.warnings.map((w) => `${w.kind}:${w.text}`)).toEqual(
      expect.arrayContaining(["unsupported_number:40", "unsupported_entity:Paris"]),
    );
  });
});
