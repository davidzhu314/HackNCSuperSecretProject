import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_SEGMENTS, SAMPLE_ADVERSARIAL_REWRITE, SAMPLE_EVALUATE, SAMPLE_REWRITE } from "./demo-data";
import { checkStyle } from "./style-check";
import { LINKEDIN_CONFIG } from "./rubrics";
import { EvaluateResponseSchema, RewriteResponseSchema } from "./schemas";

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

describe("sample rewrites", () => {
  it("are schema-valid, labeled, and offer both styles", () => {
    expect(RewriteResponseSchema.safeParse(SAMPLE_REWRITE).success).toBe(true);
    expect(RewriteResponseSchema.safeParse(SAMPLE_ADVERSARIAL_REWRITE).success).toBe(true);
    expect(SAMPLE_REWRITE.source).toBe("sample");
    expect(SAMPLE_REWRITE.variations.map((v) => v.style)).toEqual(["direct", "narrative"]);
  });

  it("stored style warnings match what the lint actually finds", () => {
    for (const v of [...SAMPLE_REWRITE.variations, ...SAMPLE_ADVERSARIAL_REWRITE.variations]) {
      expect(checkStyle(v.rewrite.content)).toEqual(v.styleWarnings);
    }
  });
});
