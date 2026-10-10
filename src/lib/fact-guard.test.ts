import { describe, expect, it } from "vitest";
import {
  DEMO_HINGE_FACTS,
  DEMO_HINGE_SEGMENTS,
  DEMO_LINKEDIN_FACTS,
  DEMO_LINKEDIN_SEGMENTS,
  SAMPLE_ADVERSARIAL_REWRITE,
  SAMPLE_REWRITE,
} from "./demo-data";
import { checkRewrite, checkSegmentCitations, extractNumbers } from "./fact-guard";
import type { GuardWarning } from "./schemas";

const segments = DEMO_LINKEDIN_SEGMENTS;
const facts = DEMO_LINKEDIN_FACTS;

function check(content: string, usedFactIds: string[] = [], overrideFacts = facts) {
  return checkRewrite({ rewrite: { content, usedFactIds }, segments, facts: overrideFacts });
}
const kinds = (w: GuardWarning[]) => w.map((x) => x.kind);
const has = (w: GuardWarning[], kind: GuardWarning["kind"], text?: string) =>
  w.some((x) => x.kind === kind && (text === undefined || x.text.toLowerCase() === text.toLowerCase()));

describe("fabrication checks", () => {
  it("flags a fabricated metric", () => {
    const w = check("I built a course-planning web app that cut planning time by 40%.");
    expect(has(w, "unsupported_number", "40%")).toBe(true);
  });

  it("flags a fabricated company", () => {
    const w = check("I built a course-planning web app during my internship at Stripe.");
    expect(has(w, "unsupported_entity", "Stripe")).toBe(true);
  });

  it("flags a fabricated date", () => {
    const w = check("I was a teaching assistant for an introductory programming course in 2023.");
    expect(has(w, "unsupported_number", "2023")).toBe(true);
  });

  it("flags an unsupported qualification", () => {
    const w = check("I am an AWS Certified Solutions Architect and a computer science senior.");
    expect(has(w, "unsupported_entity", "AWS")).toBe(true);
    expect(has(w, "unsupported_entity", "Certified")).toBe(true);
  });

  it("flags an inflated verb (contributed -> led)", () => {
    const w = check("I led an open-source data visualization library with bug fixes and documentation.");
    expect(has(w, "inflated_verb", "led")).toBe(true);
  });

  it("flags a number written as words, and 'percent'", () => {
    const w = check("I mentored two hundred students and improved results by ninety five percent.");
    expect(has(w, "unsupported_number", "two hundred")).toBe(true);
    expect(has(w, "unsupported_number", "ninety five percent")).toBe(true);
  });
});

describe("legitimate text passes", () => {
  it("accepts a correct quotation of the original", () => {
    const w = check("I am a motivated team player who is passionate about technology.");
    expect(w).toEqual([]);
  });

  it("accepts a legitimate paraphrase of confirmed facts", () => {
    const w = check(
      "Computer science senior who built a course-planning web app with Python and React, and enjoys explaining technical ideas to non-technical people.",
      ["f1", "f4", "f5"],
    );
    expect(w).toEqual([]);
  });

  it("accepts both labeled sample rewrites with no warnings", () => {
    for (const v of SAMPLE_REWRITE.variations) {
      expect(checkRewrite({ rewrite: v.rewrite, segments, facts })).toEqual([]);
    }
  });

  it("does not flag generic title-case or heading words, but still flags titles and names", () => {
    const w = check(
      "Senior Computer Science Student | Builder of Python and React Web Apps\n\nWhat I've worked on:\nI built a course-planning web app with Python and React.",
    );
    expect(w.filter((x) => x.kind === "unsupported_entity")).toEqual([]);
    expect(has(check("Python and React Developer who studies computer science."), "unsupported_entity", "Developer")).toBe(true);
  });

  it("matches irregular verbs to their nouns (built -> Builder)", () => {
    const w = check("Python and React Builder | Teaching Assistant");
    expect(w.filter((x) => x.kind === "unsupported_entity")).toEqual([]);
  });

  it("treats '95 percent' and '95%' as the same number", () => {
    const keys = extractNumbers("up 95 percent, then 95%").map((n) => n.key);
    expect(keys).toEqual(["95%", "95%"]);
  });

  it("does not treat a bare 'one' as a number", () => {
    expect(extractNumbers("one of the best")).toEqual([]);
  });
});

describe("fact ids and confirmation", () => {
  it("flags an unconfirmed fact, and its text does not support claims", () => {
    const unconfirmed = facts.map((f) => (f.id === "f4" ? { ...f, confirmed: false } : f));
    const w = check("I built a course-planning web app with Python and React.", ["f4"], unconfirmed);
    expect(has(w, "invalid_fact_id", "f4")).toBe(true);
    // "React" only appeared in the unconfirmed fact, so it is unsupported too.
    expect(has(w, "unsupported_entity", "React")).toBe(true);
  });

  it("flags a fact id that does not exist", () => {
    const w = check("I am a computer science senior.", ["f99"]);
    expect(has(w, "invalid_fact_id", "f99")).toBe(true);
  });

  it("flags a sentence with almost no traceable content for human review", () => {
    const w = check("Skilled negotiator closing enterprise partnerships across several industries.");
    expect(kinds(w)).toContain("unsupported_claim");
  });
});

describe("adversarial sample", () => {
  it("flags everything the labeled demo fallback says it flags", () => {
    const [sample] = SAMPLE_ADVERSARIAL_REWRITE.variations;
    const w = checkRewrite({ rewrite: sample.rewrite, segments, facts });
    for (const expected of sample.warnings) {
      expect(has(w, expected.kind, expected.text)).toBe(true);
    }
  });
});

describe("segment citations", () => {
  it("flags unknown segment ids and accepts known ones", () => {
    expect(checkSegmentCitations(["s1", "s2"], segments)).toEqual([]);
    const w = checkSegmentCitations(["s1", "s99"], segments);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ kind: "unverified_segment", text: "s99" });
  });
});

describe("hinge", () => {
  const hinge = (content: string) =>
    checkRewrite({ rewrite: { content, usedFactIds: [] }, segments: DEMO_HINGE_SEGMENTS, facts: DEMO_HINGE_FACTS });

  it("counts the prompt question as source text", () => {
    // "Sunday" appears only in the prompt "A perfect Sunday", not in the answer.
    expect(hinge("Pancakes first, then a long Sunday walk with no plan.")).toEqual([]);
  });

  it("still flags a new place or number in an answer", () => {
    const w = hinge("Finding the best food truck in Austin, all 12 of them.");
    expect(has(w, "unsupported_entity", "Austin")).toBe(true);
    expect(has(w, "unsupported_number", "12")).toBe(true);
  });
});
