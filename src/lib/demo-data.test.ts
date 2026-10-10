import { describe, expect, it } from "vitest";
import {
  DEMO_HINGE_FACTS,
  DEMO_HINGE_SEGMENTS,
  DEMO_LINKEDIN_SEGMENTS,
  SAMPLE_EVALUATE,
  SAMPLE_HINGE_ADVERSARIAL_CONTENT,
} from "./demo-data";
import { checkRewrite } from "./fact-guard";
import { LINKEDIN_CONFIG } from "./rubrics";
import { EvaluateResponseSchema } from "./schemas";

describe("sample evaluate", () => {
  it("is schema-valid and labeled as a sample", () => {
    expect(EvaluateResponseSchema.safeParse(SAMPLE_EVALUATE).success).toBe(true);
    expect(SAMPLE_EVALUATE.source).toBe("sample");
  });

  it("covers every LinkedIn audience x trait once", () => {
    const keys = SAMPLE_EVALUATE.critiques.map((c) => `${c.audience}|${c.trait}`);
    const expected = LINKEDIN_CONFIG.audiences.flatMap((a) => LINKEDIN_CONFIG.traits.map((t) => `${a.id}|${t.id}`));
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...expected].sort());
  });

  it("only cites real segments, and missingEvidence matches", () => {
    const ids = new Set(DEMO_LINKEDIN_SEGMENTS.map((s) => s.id));
    for (const c of SAMPLE_EVALUATE.critiques) {
      for (const id of c.segmentIds) expect(ids.has(id)).toBe(true);
      expect(c.missingEvidence).toBe(c.segmentIds.length === 0);
    }
  });
});

describe("hinge adversarial sample", () => {
  it("is flagged by FactCheck against the Hinge demo", () => {
    const w = checkRewrite({
      rewrite: { content: SAMPLE_HINGE_ADVERSARIAL_CONTENT, usedFactIds: [] },
      segments: DEMO_HINGE_SEGMENTS,
      facts: DEMO_HINGE_FACTS,
    });
    const kinds = new Set(w.map((x) => x.kind));
    expect(kinds.has("unsupported_number")).toBe(true);
    expect(kinds.has("unsupported_entity")).toBe(true);
    expect(kinds.has("inflated_verb")).toBe(true);
  });
});
