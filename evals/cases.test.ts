import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkRewrite } from "../src/lib/fact-guard";
import { caseConfirmedFacts, caseSegments, EvalCaseSchema, type EvalCase } from "./schema";

// Runs with `npm test`, no API key needed.
// 1. Every case file is valid and consistent.
// 2. Every non-semantic trap, written verbatim into a rewrite, is caught by FactCheck
//    with the expected warning kind. A failure here is either a badly written trap or a
//    real FactCheck gap; fix whichever it is.

const CASES_DIR = new URL("./cases/", import.meta.url);

function loadCases(): { file: string; data: EvalCase }[] {
  const out: { file: string; data: EvalCase }[] = [];
  for (const platform of ["linkedin", "hinge"]) {
    const dir = new URL(`${platform}/`, CASES_DIR);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
      out.push({ file: `${platform}/${file}`, data: EvalCaseSchema.parse(raw) });
    }
  }
  return out;
}

const cases = loadCases();

describe("eval case files", () => {
  it("loads at least one case per platform", () => {
    expect(cases.some((c) => c.data.platform === "linkedin")).toBe(true);
    expect(cases.some((c) => c.data.platform === "hinge")).toBe(true);
  });

  it("has unique ids", () => {
    const ids = cases.map((c) => c.data.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(cases.map((c) => [c.file, c.data] as const))("%s is consistent", (file, c) => {
    expect(file.endsWith(`${c.id}.json`)).toBe(true);
    expect(c.input.platform).toBe(c.platform);
    expect(c.id.startsWith(c.platform === "linkedin" ? "li-" : "hg-")).toBe(true);
    expect(caseSegments(c).length).toBeGreaterThan(0);
  });
});

const deterministicTraps = cases.flatMap(({ data: c }) =>
  c.traps
    .filter((t) => t.expect !== "semantic")
    .map((t) => [c.id, t.expect, t.text, c] as const),
);

describe("FactCheck catches deterministic traps", () => {
  it.each(deterministicTraps)("%s: %s in %j", (_id, kind, text, c) => {
    const warnings = checkRewrite({
      rewrite: { content: text, usedFactIds: [] },
      segments: caseSegments(c),
      facts: caseConfirmedFacts(c),
    });
    expect(warnings.map((w) => w.kind)).toContain(kind);
  });
});

describe("gold facts do not trip FactCheck on their own", () => {
  // If a confirmed fact, restated verbatim, raises a number/entity/verb warning,
  // the guard would punish a faithful rewrite. That's a false positive to fix.
  it.each(cases.map((c) => [c.data.id, c.data] as const))("%s", (_id, c) => {
    const warnings = checkRewrite({
      rewrite: { content: c.goldFacts.join(" "), usedFactIds: [] },
      segments: caseSegments(c),
      facts: caseConfirmedFacts(c),
    });
    expect(warnings).toEqual([]);
  });
});
