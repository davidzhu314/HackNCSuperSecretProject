import { describe, expect, it } from "vitest";
import { BENCHMARK_CASES, runBenchmark } from "./benchmark";

// Locks in FactCheck's current benchmark result, so a change that catches more (or less) shows up
// here. If FactCheck improves, update these numbers; the page always shows the live result.

describe("FactCheck benchmark", () => {
  const r = runBenchmark();

  it("catches 13 of 15 planted fabrications with no false alarms", () => {
    expect(r.planted).toBe(15);
    expect(r.caught).toBe(13);
    expect(r.cleanCases).toBe(3);
    expect(r.falseAlarms).toBe(0);
  });

  it("catches every invented number, employer, and credential", () => {
    for (const kind of ["number", "employer", "credential"] as const) expect(r.byKind[kind].caught).toBe(r.byKind[kind].planted);
  });

  it("catches every invented title, and reports its known misses: subtle exaggerations", () => {
    expect(r.byKind.title.caught).toBe(r.byKind.title.planted);
    const missed = r.cases.flatMap((c) => c.missed.map((m) => m.text)).sort();
    expect(missed).toEqual(["production data pipelines", "the best pancakes in town"]);
  });

  it("uses fictitious people only, and every plant appears in its rewrite", () => {
    for (const c of BENCHMARK_CASES) for (const p of c.planted) expect(c.rewrite).toContain(p.text);
  });
});
