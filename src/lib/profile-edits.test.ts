import { describe, expect, it } from "vitest";
import { DEMO_HINGE_FACTS, DEMO_HINGE_INPUT, DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE } from "./demo-data";
import { factCoverage } from "./profile";
import { changedSections, hingeFactIds, profileAsText, sectionText, withSectionText } from "./profile-edits";

const profile = DEMO_LINKEDIN_PROFILE;

describe("using a rewrite", () => {
  it("reads and replaces headline, About, and entry descriptions", () => {
    expect(sectionText(profile, "headline")).toBe(profile.headline);
    expect(sectionText(profile, "exp1")).toBe(profile.experience[0].description);
    expect(sectionText(profile, "nope")).toBeUndefined();

    const next = withSectionText(profile, "exp1", "Cleaned survey data in Python.");
    expect(next.experience[0].description).toBe("Cleaned survey data in Python.");
    // Titles, organizations, and dates are never touched; the original is not mutated.
    expect(next.experience[0].title).toBe(profile.experience[0].title);
    expect(profile.experience[0].description).not.toBe("Cleaned survey data in Python.");
    expect(withSectionText(profile, "nope", "x")).toBe(profile);
  });

  it("lists the sections that differ from the original", () => {
    expect(changedSections(profile, profile)).toEqual([]);
    const next = withSectionText(withSectionText(profile, "headline", "CS senior | Python"), "proj1", "Built a planner.");
    expect(changedSections(profile, next).sort()).toEqual(["headline", "proj1"]);
    // Undoing restores "no changes".
    expect(changedSections(profile, withSectionText(next, "proj1", profile.projects[0].description))).toEqual(["headline"]);
  });

  it("formats the profile as labeled sections for copying", () => {
    const text = profileAsText(profile);
    expect(text.startsWith(`Headline\n${profile.headline}\n\nAbout\n`)).toBe(true);
    expect(text).toContain(profile.experience[0].description.trim());
  });

  it("applying a rewrite that mentions a missing fact raises LinkedIn coverage", () => {
    const facts = DEMO_LINKEDIN_FACTS.filter((f) => f.confirmed);
    const before = factCoverage(profile, facts).summary.covered;
    const missing = factCoverage(profile, facts).perFact.find((f) => !f.sectionKeys.length);
    expect(missing).toBeDefined();
    const fact = facts.find((f) => f.id === missing!.factId)!;
    const after = factCoverage(withSectionText(profile, "about", `${profile.about} ${fact.text}`), facts).summary.covered;
    expect(after).toBe(before + 1);
  });
});

describe("hingeFactIds", () => {
  it("finds confirmed facts in the Hinge answers", () => {
    const facts = [
      { id: "f1", text: "I make pancakes and take long walks.", confirmed: true as const, source: "user" as const },
      { id: "f2", text: "I studied computer science.", confirmed: true as const, source: "user" as const },
    ];
    expect([...hingeFactIds(DEMO_HINGE_INPUT, facts)]).toEqual(["f1"]);
    expect(hingeFactIds(null, DEMO_HINGE_FACTS).size).toBe(0);
    expect(hingeFactIds([{ prompt: "x", answer: "  " }], DEMO_HINGE_FACTS).size).toBe(0);
  });
});
