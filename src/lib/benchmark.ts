import { checkRewrite } from "./fact-guard";
import type { GuardWarning, IdentityFact, Segment } from "./schemas";

// FactCheck benchmark: synthetic rewrites with planted fabrications, run through the real
// deterministic FactCheck, plus clean rewrites to count false alarms. Real counts, computed by
// running FactCheck (the /factcheck page and the tests); misses are listed, not hidden. Fictitious people only.

export type PlantKind = "number" | "employer" | "title" | "credential" | "subtle";

export const PLANT_LABEL: Record<PlantKind, string> = {
  number: "Invented number",
  employer: "Invented employer or name",
  title: "Inflated title or verb",
  credential: "Invented credential",
  subtle: "Subtle exaggeration",
};

export type BenchmarkCase = {
  id: string;
  /** The user's own text (what FactCheck accepts as evidence). */
  source: string;
  facts: string[];
  rewrite: string;
  /** Planted fabrications, as they appear in the rewrite. Empty for a clean control. */
  planted: { text: string; kind: PlantKind }[];
};

const PRIYA = "I built a course-planning web app with Python and React. I was a teaching assistant for an intro programming course.";
const MAYA = "I make pancakes most Sundays and I am always looking for the best food truck in town.";
const DEV = "Software engineering intern at Tallowtree Analytics. Wrote data cleaning scripts in Python.";

export const BENCHMARK_CASES: BenchmarkCase[] = [
  { id: "n1", source: PRIYA, facts: [], rewrite: "Built a course-planning web app with Python and React used by 5,000 students.", planted: [{ text: "5,000", kind: "number" }] },
  { id: "n2", source: DEV, facts: [], rewrite: "Wrote Python data cleaning scripts that cut processing time by 40%.", planted: [{ text: "40%", kind: "number" }] },
  { id: "n3", source: PRIYA, facts: [], rewrite: "Teaching assistant for three semesters of intro programming.", planted: [{ text: "three", kind: "number" }] },
  { id: "e1", source: PRIYA, facts: [], rewrite: "I worked at Google for 5 years building course tools in Python.", planted: [{ text: "Google", kind: "employer" }, { text: "5", kind: "number" }] },
  { id: "e2", source: DEV, facts: [], rewrite: "Software engineering intern at Tallowtree Analytics, previously at Microsoft.", planted: [{ text: "Microsoft", kind: "employer" }] },
  { id: "e3", source: MAYA, facts: [], rewrite: "Pancakes most Sundays, and I was featured in Bon Appetit for my food truck reviews.", planted: [{ text: "Bon Appetit", kind: "employer" }] },
  { id: "t1", source: DEV, facts: [], rewrite: "Led the data team at Tallowtree Analytics, writing cleaning scripts in Python.", planted: [{ text: "Led", kind: "title" }] },
  { id: "t2", source: PRIYA, facts: [], rewrite: "Founded a course-planning startup built with Python and React.", planted: [{ text: "Founded", kind: "title" }] },
  { id: "t3", source: PRIYA, facts: [], rewrite: "Head instructor for an intro programming course; built a planner in React.", planted: [{ text: "Head instructor", kind: "title" }] },
  { id: "c1", source: PRIYA, facts: [], rewrite: "Built a course-planning app in Python and React. AWS Certified Solutions Architect.", planted: [{ text: "AWS Certified Solutions Architect", kind: "credential" }] },
  { id: "c2", source: DEV, facts: [], rewrite: "Intern at Tallowtree Analytics with a PhD in machine learning.", planted: [{ text: "PhD", kind: "credential" }] },
  { id: "s1", source: PRIYA, facts: [], rewrite: "Expert in Python and React who built a course-planning web app.", planted: [{ text: "Expert", kind: "subtle" }] },
  { id: "s2", source: MAYA, facts: [], rewrite: "I make the best pancakes in town most Sundays.", planted: [{ text: "the best pancakes in town", kind: "subtle" }] },
  { id: "s3", source: DEV, facts: [], rewrite: "Wrote production data pipelines in Python as an intern at Tallowtree Analytics.", planted: [{ text: "production data pipelines", kind: "subtle" }] },
  // Clean controls: faithful rewrites, which should come back with no warnings.
  { id: "ok1", source: PRIYA, facts: [], rewrite: "Built a course-planning web app with Python and React, and was a teaching assistant for intro programming.", planted: [] },
  { id: "ok2", source: MAYA, facts: [], rewrite: "Pancakes most Sundays, and always hunting for the best food truck in town.", planted: [] },
  { id: "ok3", source: DEV, facts: ["I presented my internship project to the analytics team."], rewrite: "Software engineering intern at Tallowtree Analytics: wrote data cleaning scripts in Python and presented my project to the analytics team.", planted: [] },
];

export type CaseResult = {
  case: BenchmarkCase;
  warnings: GuardWarning[];
  caught: { text: string; kind: PlantKind }[];
  missed: { text: string; kind: PlantKind }[];
};

export type BenchmarkResult = {
  cases: CaseResult[];
  planted: number;
  caught: number;
  /** Clean rewrites that got at least one warning. */
  falseAlarms: number;
  cleanCases: number;
  byKind: Record<PlantKind, { planted: number; caught: number }>;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/** A plant counts as caught when a warning names it (or a sentence containing it). */
function flags(warnings: GuardWarning[], plant: string): boolean {
  const p = norm(plant);
  return warnings.some((w) => {
    const t = norm(w.text);
    return t.includes(p) || (p.includes(t) && t.length > 1);
  });
}

function toInput(c: BenchmarkCase): { segments: Segment[]; facts: IdentityFact[] } {
  return {
    segments: [{ id: "s1", text: c.source }],
    facts: c.facts.map((text, i) => ({ id: `f${i + 1}`, text, confirmed: true, source: "user" as const })),
  };
}

export function runBenchmark(cases: BenchmarkCase[] = BENCHMARK_CASES): BenchmarkResult {
  const byKind = Object.fromEntries(
    (Object.keys(PLANT_LABEL) as PlantKind[]).map((k) => [k, { planted: 0, caught: 0 }]),
  ) as Record<PlantKind, { planted: number; caught: number }>;
  const results = cases.map((c) => {
    const { segments, facts } = toInput(c);
    const warnings = checkRewrite({ rewrite: { content: c.rewrite, usedFactIds: [] }, segments, facts });
    const caught = c.planted.filter((p) => flags(warnings, p.text));
    const missed = c.planted.filter((p) => !flags(warnings, p.text));
    for (const p of c.planted) {
      byKind[p.kind].planted++;
      if (caught.includes(p)) byKind[p.kind].caught++;
    }
    return { case: c, warnings, caught, missed };
  });
  const clean = results.filter((r) => !r.case.planted.length);
  return {
    cases: results,
    planted: results.reduce((n, r) => n + r.case.planted.length, 0),
    caught: results.reduce((n, r) => n + r.caught.length, 0),
    falseAlarms: clean.filter((r) => r.warnings.length > 0).length,
    cleanCases: clean.length,
    byKind,
  };
}
