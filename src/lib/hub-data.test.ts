import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_FACTS } from "./demo-data";
import { DEMO_HUB_PROFILE, factCoverageLocal, profileSections } from "./hub-data";

describe("factCoverageLocal", () => {
  const cov = factCoverageLocal(DEMO_HUB_PROFILE, DEMO_LINKEDIN_FACTS);
  const where = (id: string) => cov.perFact.find((f) => f.factId === id)?.sectionKeys;

  it("finds a fact in the entry that states it", () => {
    expect(where("f3")).toContain("exp1"); // teaching assistant
    expect(where("f2")).toContain("exp2"); // open-source contributions
    expect(where("f4")).toContain("proj1"); // course planner
  });

  it("reports a fact that appears nowhere", () => {
    expect(where("f5")).toEqual([]); // explaining technical ideas: not on the profile
  });

  it("counts only confirmed facts, as real numbers", () => {
    expect(cov.summary.confirmed).toBe(5);
    expect(cov.summary.covered).toBe(cov.perFact.filter((f) => f.sectionKeys.length).length);
    const unconfirmed = DEMO_LINKEDIN_FACTS.map((f) => ({ ...f, confirmed: false }));
    expect(factCoverageLocal(DEMO_HUB_PROFILE, unconfirmed).summary).toEqual({ confirmed: 0, covered: 0 });
  });

  it("does not credit the vague headline and About with any fact", () => {
    for (const f of cov.perFact) {
      expect(f.sectionKeys).not.toContain("headline");
      expect(f.sectionKeys).not.toContain("about");
    }
  });
});

describe("profileSections", () => {
  it("lists sections in LinkedIn order and skips empty ones", () => {
    expect(profileSections(DEMO_HUB_PROFILE).map((s) => s.key)).toEqual(["headline", "about", "exp1", "exp2", "edu1", "proj1"]);
  });
});
