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

describe("real-world number and name formats (synthetic text)", () => {
  const source = [
    "Competed in the 2024–2025 Regional Rover Challenge, reaching the highest altitude in the region (~12,500 ft).",
    "Contributed to the launch and recovery of the payload.",
    "Began as a volunteer tutor and expanded to mentoring 8+ students.",
    "Served over 40 guests each week.",
    "Presented four research posters at the Spring Science Fair.",
    "Evaluated open-weight models (Mistral, Llama 3.1, GPT-OSS-20B) with partners at Northwind Aerospace and Contoso.",
  ];
  const segs = source.map((text, i) => ({ id: `exp1-s${i + 1}`, text }));
  const run = (content: string) => checkRewrite({ rewrite: { content, usedFactIds: [] }, segments: segs, facts: [] });

  it("keeps numbers with ~, +, 'over', word numbers, en-dash ranges, and versions unflagged", () => {
    const kept = [
      "- Reached the highest altitude in the region (~12,500 ft) in the 2024–2025 Regional Rover Challenge",
      "- Mentored 8+ students after starting as a volunteer tutor",
      "- Served over 40 guests each week",
      "- Presented 4 research posters at the Spring Science Fair",
      "- Evaluated Llama 3.1, Mistral, and GPT-OSS-20B with partners at Northwind Aerospace and Contoso",
      "- Competed in the 2024-2025 Regional Rover Challenge",
    ].join("\n");
    expect(run(kept)).toEqual([]);
  });

  it("still flags a changed number, version, or range year", () => {
    const w = run("- Reached ~13,000 ft\n- Mentored 10+ students\n- Evaluated Llama 3.2\n- Competed in 2024–2026");
    for (const n of ["13,000", "10", "3.2", "2026"]) expect(has(w, "unsupported_number", n)).toBe(true);
  });

  it("flags 'Contributed to' turned into 'Led'", () => {
    const w = run("- Led the launch and recovery of the payload");
    expect(has(w, "inflated_verb", "led")).toBe(true);
  });
});

describe("entity heuristic edge cases from live runs", () => {
  const segs = [
    { id: "exp1-s1", text: "Studied calibration in Large Language Models with the Spring Science Fair team." },
    { id: "exp1-s2", text: "Recognized as Tutor of the Month." },
  ];
  const run = (content: string) => checkRewrite({ rewrite: { content, usedFactIds: [] }, segments: segs, facts: [] });

  it("accepts an acronym of a capitalized phrase in the sources", () => {
    expect(run("Studied LLM calibration. Worked with LLMs.")).toEqual([]);
  });

  it("still flags an acronym the sources don't spell out", () => {
    expect(has(run("Studied NLP calibration."), "unsupported_entity", "NLP")).toBe(true);
  });

  it("doesn't treat a past-tense verb opening a line as a name, but checks the words after it", () => {
    expect(run("Named Tutor of the Month.")).toEqual([]);
    expect(has(run("Named Tutor of the Year by Contoso."), "unsupported_entity", "Contoso")).toBe(true);
  });
});

describe("acronyms inside long title-case runs", () => {
  it("finds the phrase even at the end of a long paper title", () => {
    const segs = [{ id: "exp1-s1", text: "Wrote “Cross-Domain Robustness of Reward Estimation in Large Language Models”." }];
    const w = checkRewrite({ rewrite: { content: "Studied LLM reward estimation.", usedFactIds: [] }, segments: segs, facts: [] });
    expect(w).toEqual([]);
  });
});

describe("verb support from base forms and synonyms", () => {
  const run = (source: string, content: string) =>
    checkRewrite({ rewrite: { content, usedFactIds: [] }, segments: [{ id: "exp1-s2", text: source }], facts: [] });

  it("counts 'lead' in the sources as support for 'led'/'leading'", () => {
    expect(run("Design and lead weekly activities for students.", "- Leading weekly activities for students")).toEqual([]);
  });

  it("still flags 'led' when the sources only say 'contributed'", () => {
    expect(has(run("Contributed to the payload launch.", "- Led the payload launch"), "inflated_verb", "led")).toBe(true);
  });

  it("never treats a base form in the rewrite as a claim, and ignores 'found' (find)", () => {
    expect(has(run("Found a bug in the parser.", "- Founded a parser project"), "inflated_verb", "founded")).toBe(true);
  });

  it("treats 'authored' as support for 'wrote'", () => {
    expect(run("Contributed to the launch and authored the team's report.", "- Contributed to the launch and wrote the team's report")).toEqual([]);
  });
});

describe("durations are checked with their unit", () => {
  const src = [{ id: "s1", text: "Teaching Assistant, January 2025 - Present (1 year 10 months). Intern for 3 months." }];
  const check = (content: string) => checkRewrite({ rewrite: { content, usedFactIds: [] }, segments: src, facts: [] });

  it("flags a duration whose number appears only with another unit", () => {
    const w = check("Teaching assistant with 10 years of experience.");
    expect(w.some((x) => x.kind === "unsupported_number" && x.text === "10 years")).toBe(true);
    expect(check("Intern for 3 years.").some((x) => x.kind === "unsupported_number")).toBe(true);
  });

  it("passes the same duration, in digits or words, and plain numbers as before", () => {
    expect(check("Teaching assistant for 1 year 10 months.").filter((x) => x.kind === "unsupported_number")).toEqual([]);
    expect(check("A three-month internship.").filter((x) => x.kind === "unsupported_number")).toEqual([]);
    expect(check("Teaching assistant since 2025.").filter((x) => x.kind === "unsupported_number")).toEqual([]);
  });

  it("reads the unit after a plus sign or abbreviation", () => {
    expect(extractNumbers("10+ years")[0]).toMatchObject({ key: "10", unit: "year" });
    expect(extractNumbers("6 mos")[0]).toMatchObject({ key: "6", unit: "month" });
    expect(extractNumbers("ten weeks")[0]).toMatchObject({ key: "10", unit: "week" });
    expect(extractNumbers("2025")[0].unit).toBeUndefined();
  });
});

describe("status and title words", () => {
  const check = (source: string, content: string) =>
    checkRewrite({ rewrite: { content, usedFactIds: [] }, segments: [{ id: "s1", text: source }], facts: [] }).filter(
      (w) => w.kind === "inflated_verb",
    );

  it("flags rank or standing the sources never state", () => {
    const source = "Software engineering intern. Wrote data cleaning scripts in Python.";
    expect(check(source, "Senior software engineer writing Python.").map((w) => w.text)).toEqual(["Senior"]);
    expect(check(source, "Head of data cleaning in Python.").map((w) => w.text)).toEqual(["Head"]);
    expect(check(source, "Python expert who wrote data cleaning scripts.").map((w) => w.text)).toEqual(["expert"]);
    expect(check(source, "Award-winning intern writing Python.").map((w) => w.text)).toEqual(["Award-winning"]);
  });

  it("passes the same words when the sources use them", () => {
    expect(check("I am a senior studying computer science.", "Computer science senior.")).toEqual([]);
    expect(check("I led the robotics club.", "Lead of the robotics club.")).toEqual([]);
    expect(check("Always looking for the best food truck.", "Finding the best food truck.")).toEqual([]);
    expect(check("Co-founder of a study group.", "Founder of a study group.")).toEqual([]);
  });
});
