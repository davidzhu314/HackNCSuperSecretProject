import { describe, expect, it } from "vitest";
import {
  DEMO_HINGE_FACTS,
  DEMO_HINGE_SEGMENTS,
  DEMO_LINKEDIN_FACTS,
  DEMO_LINKEDIN_PROFILE,
  DEMO_LINKEDIN_SEGMENTS,
  SAMPLE_ADVERSARIAL_REWRITE,
  SAMPLE_EVALUATE,
  SAMPLE_HINGE_ADVERSARIAL_CONTENT,
  SAMPLE_PROFILE_EVALUATE,
  SAMPLE_REWRITE,
  SAMPLE_SECTION_REWRITES,
} from "./demo-data";
import { checkRewrite } from "./fact-guard";
import { factCheckSegments, rewritableSections, segmentProfile } from "./profile";
import { checkStyle } from "./style-check";
import { formatOf, STYLE_ORDER, styleIssues } from "./styles";
import { DEFAULT_LINKEDIN_AUDIENCES, LINKEDIN_CONFIG } from "./rubrics";
import { EvaluateResponseSchema, LIMITS, RatingSchema, RewriteResponseSchema, RewriteSectionResponseSchema } from "./schemas";

describe("sample evaluate", () => {
  it("is schema-valid and labeled as a sample", () => {
    expect(EvaluateResponseSchema.safeParse(SAMPLE_EVALUATE).success).toBe(true);
    expect(SAMPLE_EVALUATE.source).toBe("sample");
  });

  it("covers the original three LinkedIn lenses x every trait once", () => {
    const keys = SAMPLE_EVALUATE.critiques.map((c) => `${c.audience}|${c.trait}`);
    const original = ["startup_founder", "technical_recruiter", "research_lead"];
    const expected = original.flatMap((a) => LINKEDIN_CONFIG.traits.map((t) => `${a}|${t.id}`));
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

describe("sectioned sample evaluate", () => {
  const ids = new Set(segmentProfile(DEMO_LINKEDIN_PROFILE).map((s) => s.id));

  it("is schema-valid and labeled as a sample", () => {
    expect(EvaluateResponseSchema.safeParse(SAMPLE_PROFILE_EVALUATE).success).toBe(true);
    expect(SAMPLE_PROFILE_EVALUATE.source).toBe("sample");
  });

  it("covers every LinkedIn lens x every trait once, including the defaults", () => {
    const keys = SAMPLE_PROFILE_EVALUATE.critiques.map((c) => `${c.audience}|${c.trait}`);
    const expected = LINKEDIN_CONFIG.audiences.flatMap((a) => LINKEDIN_CONFIG.traits.map((t) => `${a.id}|${t.id}`));
    expect([...keys].sort()).toEqual([...expected].sort());
    for (const id of DEFAULT_LINKEDIN_AUDIENCES) expect(LINKEDIN_CONFIG.audiences.some((a) => a.id === id)).toBe(true);
  });

  it("has exactly 2 lenses in each of the 4 categories", () => {
    const categories = LINKEDIN_CONFIG.categories!.map((c) => c.id);
    expect(categories).toHaveLength(4);
    for (const c of categories) expect(LINKEDIN_CONFIG.audiences.filter((a) => a.category === c)).toHaveLength(2);
  });

  it("fits within the critique limit and the default lenses span 3 categories", () => {
    expect(SAMPLE_PROFILE_EVALUATE.critiques.length).toBeLessThanOrEqual(LIMITS.maxCritiques);
    const cats = DEFAULT_LINKEDIN_AUDIENCES.map((id) => LINKEDIN_CONFIG.audiences.find((a) => a.id === id)!.category);
    expect(new Set(cats).size).toBe(3);
  });

  it("only cites real profile segments, and missingEvidence matches", () => {
    for (const c of SAMPLE_PROFILE_EVALUATE.critiques) {
      for (const id of c.segmentIds) expect(ids.has(id)).toBe(true);
      expect(c.missingEvidence).toBe(c.segmentIds.length === 0);
    }
  });

  it("has a sentence two lenses rate at least two levels apart", () => {
    const level = (r: string) => RatingSchema.options.indexOf(r as never);
    const bySegment = new Map<string, { audience: string; level: number }[]>();
    for (const c of SAMPLE_PROFILE_EVALUATE.critiques)
      for (const id of c.segmentIds) bySegment.set(id, [...(bySegment.get(id) ?? []), { audience: c.audience, level: level(c.rating) }]);
    const disagree = [...bySegment.values()].some((rs) =>
      rs.some((a) => rs.some((b) => a.audience !== b.audience && Math.abs(a.level - b.level) >= 2)),
    );
    expect(disagree).toBe(true);
  });
});

describe("sample section rewrites", () => {
  const sections = rewritableSections(DEMO_LINKEDIN_PROFILE);

  it("cover every rewritable demo section in both styles", () => {
    expect(Object.keys(SAMPLE_SECTION_REWRITES).sort()).toEqual(sections.map((s) => s.key).sort());
  });

  for (const section of sections) {
    for (const style of STYLE_ORDER) {
      it(`${section.key} / ${style}: valid, labeled, within limits, and clean`, () => {
        const r = SAMPLE_SECTION_REWRITES[section.key][style];
        expect(RewriteSectionResponseSchema.safeParse(r).success).toBe(true);
        expect(r.source).toBe("sample");
        expect(r.sectionKey).toBe(section.key);
        expect(r.style).toBe(style);
        const cap =
          section.kind === "headline" || section.kind === "about"
            ? LIMITS.sectionRewriteChars[section.kind]
            : LIMITS.sectionRewriteChars.entry;
        expect(r.rewrite.content.length).toBeLessThanOrEqual(cap);
        if (section.kind === "headline") expect(r.rewrite.content).not.toContain("\n");
        // Checked independently here, not just trusted from the stored fields.
        const warnings = checkRewrite({
          rewrite: r.rewrite,
          segments: factCheckSegments(DEMO_LINKEDIN_PROFILE, section.key)!,
          facts: DEMO_LINKEDIN_FACTS,
        });
        expect(warnings).toEqual([]);
        expect(r.warnings).toEqual([]);
        expect(checkStyle(r.rewrite.content)).toEqual([]);
        expect(styleIssues(style, r.rewrite.content, formatOf(section.kind, section.text))).toEqual([]);
        expect(r.chars.actual).toBe(r.rewrite.content.length);
        expect(r.styleWarnings).toEqual([]);
      });
    }
  }
});

describe("lens picker summaries", () => {
  it("every LinkedIn lens has a short one-line summary for the picker", () => {
    for (const a of LINKEDIN_CONFIG.audiences) {
      expect(a.summary, a.id).toBeTruthy();
      expect(a.summary!.length, a.id).toBeLessThanOrEqual(70);
    }
  });
});
