import { describe, expect, it } from "vitest";
import { emptyLinkedInProfile, factCheckSegments, findSection } from "./profile";
import { sectionRewritePrompt } from "./prompts";
import { LIMITS, RewriteSectionResponseSchema, type LinkedInProfile } from "./schemas";
import { buildCandidateFacts, buildCritiques, buildHingeAnswers, buildHingeVariations, buildSectionRewrite, buildVariations } from "./postprocess";
import { DEMO_HINGE_FACTS, DEMO_HINGE_SEGMENTS, DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_SEGMENTS } from "./demo-data";

const requested = { audienceIds: ["startup_founder"], traitIds: ["clarity", "relevance"] };
const base = { rating: "weak" as const, rationale: "r", suggestion: "s" };

describe("buildCandidateFacts", () => {
  it("never confirms, dedupes, and drops empties", () => {
    const f = buildCandidateFacts(["I study CS.", " i study cs. ", "", "I like tea."]);
    expect(f.map((x) => x.id)).toEqual(["f1", "f2"]);
    expect(f.every((x) => x.confirmed === false && x.source === "extracted")).toBe(true);
  });
});

describe("buildCritiques", () => {
  it("removes unknown segment ids, warns, and sets missingEvidence", () => {
    const out = buildCritiques(
      {
        critiques: [
          { ...base, audience: "startup_founder", trait: "clarity", segmentIds: ["s99"], missingEvidence: false },
          { ...base, audience: "startup_founder", trait: "relevance", segmentIds: ["s1", "s2"], missingEvidence: true },
        ],
      },
      requested,
      DEMO_LINKEDIN_SEGMENTS,
    );
    expect(out.source).toBe("live");
    expect(out.critiques[0]).toMatchObject({ segmentIds: [], missingEvidence: true });
    expect(out.critiques[1]).toMatchObject({ segmentIds: ["s1", "s2"], missingEvidence: false });
    expect(out.warnings).toEqual([expect.objectContaining({ kind: "unverified_segment", text: "s99" })]);
  });

  it("drops unrequested audiences/traits and duplicates", () => {
    const c = { ...base, segmentIds: ["s1"], missingEvidence: false };
    const out = buildCritiques(
      {
        critiques: [
          { ...c, audience: "startup_founder", trait: "clarity" },
          { ...c, audience: "startup_founder", trait: "clarity" },
          { ...c, audience: "technical_recruiter", trait: "clarity" },
          { ...c, audience: "startup_founder", trait: "warmth" },
        ],
      },
      requested,
      DEMO_LINKEDIN_SEGMENTS,
    );
    expect(out.critiques).toHaveLength(1);
  });
});

describe("buildHingeAnswers", () => {
  it("returns one answer per segment in original order, with prompts", () => {
    const out = buildHingeAnswers(
      { answers: [{ segmentId: "s2", text: " Pancakes, then a walk. " }, { segmentId: "s1", text: "Food trucks." }] },
      DEMO_HINGE_SEGMENTS,
    );
    expect(out.answers.map((a) => [a.segmentId, a.text])).toEqual([
      ["s1", "Food trucks."],
      ["s2", "Pancakes, then a walk."],
    ]);
    expect(out.answers[0].prompt).toBe(DEMO_HINGE_SEGMENTS[0].prompt);
    expect(out.content).toBe("Food trucks.\n\nPancakes, then a walk.");
    expect(out.warnings).toEqual([]);
    expect(out.keptOriginal).toEqual([]);
  });

  it("keeps the original for a missing or empty answer and flags unknown ids", () => {
    const out = buildHingeAnswers(
      {
        answers: [
          { segmentId: "s1", text: "  " },
          { segmentId: "s9", text: "A made-up answer." },
          { segmentId: "s2", text: "First." },
          { segmentId: "s2", text: "Duplicate." },
        ],
      },
      DEMO_HINGE_SEGMENTS,
    );
    expect(out.answers.map((a) => a.text)).toEqual([DEMO_HINGE_SEGMENTS[0].text, "First."]);
    expect(out.keptOriginal.map((s) => s.id)).toEqual(["s1"]);
    expect(out.warnings).toEqual([expect.objectContaining({ kind: "unverified_segment", text: "s9" })]);
  });
});

describe("buildVariations", () => {
  it("returns both styles, each with its own FactCheck and style warnings", () => {
    const [direct, narrative] = buildVariations(
      {
        direct: { content: "I am a computer science senior.", usedFactIds: ["f1"], changeSummary: ["x"] },
        narrative: {
          content: "I leveraged my role at Google to teach.",
          usedFactIds: ["f1", "f42"],
          changeSummary: [],
        },
      },
      "linkedin",
      DEMO_LINKEDIN_SEGMENTS,
      DEMO_LINKEDIN_FACTS,
    );
    expect(direct).toMatchObject({ style: "direct", warnings: [], styleWarnings: [] });
    expect(narrative.style).toBe("narrative");
    expect(narrative.warnings.map((w) => `${w.kind}:${w.text}`)).toEqual(
      expect.arrayContaining(["unsupported_entity:Google", "invalid_fact_id:f42"]),
    );
    expect(narrative.styleWarnings.map((w) => w.text)).toEqual(["leveraged"]);
  });
});

describe("buildHingeVariations", () => {
  it("returns both styles with per-answer text, FactCheck, and kept-original notes", () => {
    const [direct, narrative] = buildHingeVariations(
      {
        direct: {
          answers: [
            { segmentId: "s1", text: "Finding the best food truck in any city." },
            { segmentId: "s2", text: "Pancakes, then a long walk with no plan." },
          ],
          usedFactIds: ["h1"],
          changeSummary: ["Tightened the second answer."],
        },
        narrative: {
          answers: [{ segmentId: "s1", text: "I have tried 40 food trucks in Paris." }],
          usedFactIds: [],
          changeSummary: [],
        },
      },
      DEMO_HINGE_SEGMENTS,
      DEMO_HINGE_FACTS,
    );
    expect(direct).toMatchObject({ style: "direct", warnings: [] });
    expect(direct.rewrite.answers?.map((a) => a.segmentId)).toEqual(["s1", "s2"]);
    expect(narrative.rewrite.answers?.[1].text).toBe(DEMO_HINGE_SEGMENTS[1].text);
    expect(narrative.rewrite.changeSummary[0]).toContain("Kept your answer");
    expect(narrative.warnings.map((w) => `${w.kind}:${w.text}`)).toEqual(
      expect.arrayContaining(["unsupported_number:40", "unsupported_entity:Paris"]),
    );
  });
});

describe("buildSectionRewrite", () => {
  const profile: LinkedInProfile = {
    ...emptyLinkedInProfile(),
    headline: "Robotics engineer",
    about: "I build rover controllers.",
    experience: [
      {
        id: "exp1",
        title: "Controls Engineer",
        organization: "Brightwater Robotics",
        location: "Somerville",
        description: "- Tuned 40 PID loops\n- Contributed to the simulation pipeline",
      },
      { id: "exp2", title: "Intern", organization: "Kestrel Labs", description: "- Tested 12 motor drivers" },
    ],
  };
  const build = (key: string, content: string, style: "direct" | "narrative" = "direct") =>
    buildSectionRewrite(
      { content, usedFactIds: [], changeSummary: ["Tightened wording."] },
      { section: findSection(profile, key)!, style, segments: factCheckSegments(profile, key)!, facts: [] },
    );

  it("returns a live, schema-valid response for the section and style", () => {
    const r = build("exp1", "- Tuned 40 PID loops\n- Contributed to the simulation pipeline", "narrative");
    expect(RewriteSectionResponseSchema.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({ source: "live", sectionKey: "exp1", style: "narrative", warnings: [], styleWarnings: [] });
  });

  it("keeps the headline on one line and normalizes bullet markers", () => {
    expect(build("headline", "Robotics engineer\nRover controllers").rewrite.content).toBe("Robotics engineer | Rover controllers");
    expect(build("exp1", "• Tuned 40 PID loops\n* Contributed to the simulation pipeline").rewrite.content).toBe(
      "- Tuned 40 PID loops\n- Contributed to the simulation pipeline",
    );
  });

  it("checks an entry only against its own text, so numbers can't hop between jobs", () => {
    const w = build("exp2", "- Tested 12 motor drivers and tuned 40 PID loops").warnings;
    expect(w.some((x) => x.kind === "unsupported_number" && x.text === "40")).toBe(true);
    // The About may summarize the whole profile.
    expect(build("about", "I build rover controllers and tuned 40 PID loops.").warnings).toEqual([]);
  });

  it("flags extra bullets for review", () => {
    const w = build("exp1", "- Tuned 40 PID loops\n- Contributed to the simulation pipeline\n- Contributed to the pipeline").warnings;
    expect(w[0]).toMatchObject({ kind: "unsupported_claim", text: "3 bullets (your original has 2)" });
  });

  it("cuts an over-long headline at a word boundary and says so", () => {
    const r = build("headline", `Robotics engineer ${"rover ".repeat(60)}`);
    expect(r.rewrite.content.length).toBeLessThanOrEqual(LIMITS.sectionRewriteChars.headline);
    expect(r.rewrite.content.endsWith("rover")).toBe(true);
    expect(r.rewrite.changeSummary[0]).toMatch(/220-character limit/);
  });

  it("rejects an empty rewrite", () => {
    expect(() => build("about", "   ")).toThrow(/empty rewrite/);
  });
});

describe("sectionRewritePrompt", () => {
  const profile: LinkedInProfile = {
    ...emptyLinkedInProfile(),
    headline: "Robotics engineer",
    experience: [
      { id: "exp1", title: "Controls Engineer", organization: "Brightwater", location: "Somerville", description: "- Tuned loops" },
      { id: "exp2", title: "Intern", organization: "Kestrel Labs", description: "- Tested drivers" },
    ],
  };
  const prompt = (key: string) =>
    sectionRewritePrompt({
      section: findSection(profile, key)!,
      sources: factCheckSegments(profile, key)!,
      facts: [],
      style: "direct",
      audiences: [],
    });

  it("shows an entry only its own text, never its location", () => {
    const { user, system } = prompt("exp1");
    expect(user).toContain("[exp1-s2] Tuned loops");
    expect(user).not.toContain("Kestrel");
    expect(user).not.toContain("Somerville");
    expect(system).toMatch(/same number of bullets or fewer/);
  });

  it("shows the headline the whole profile and asks for one line", () => {
    const { user, system } = prompt("headline");
    expect(user).toContain("Kestrel Labs");
    expect(system).toMatch(/one line, no line breaks/);
  });
});

describe("buildSectionRewrite bullet repair", () => {
  it("restores bullets when the original had them and the model dropped them", () => {
    const profile: LinkedInProfile = {
      ...emptyLinkedInProfile(),
      experience: [{ id: "exp1", title: "Tutor", organization: "Acme", description: "- Taught math\n- Held office hours" }],
    };
    const r = buildSectionRewrite(
      { content: "Taught math\nHeld office hours", usedFactIds: [], changeSummary: [] },
      { section: findSection(profile, "exp1")!, style: "direct", segments: factCheckSegments(profile, "exp1")!, facts: [] },
    );
    expect(r.rewrite.content).toBe("- Taught math\n- Held office hours");
  });
});

describe("buildSectionRewrite paragraph-to-bullets repair", () => {
  it("splits a one-paragraph answer back into bullets when the original had bullets", () => {
    const profile: LinkedInProfile = {
      ...emptyLinkedInProfile(),
      experience: [{ id: "exp1", title: "Tutor", organization: "Acme", description: "- Taught math\n- Held office hours" }],
    };
    const r = buildSectionRewrite(
      { content: "Taught math to students. Held office hours each week.", usedFactIds: [], changeSummary: [] },
      { section: findSection(profile, "exp1")!, style: "narrative", segments: factCheckSegments(profile, "exp1")!, facts: [] },
    );
    expect(r.rewrite.content).toBe("- Taught math to students.\n- Held office hours each week.");
    expect(r.rewrite.changeSummary).toContain("Restored your bullet format.");
  });
});

describe("sectionRewritePrompt original format", () => {
  it("tells the model how many bullets the entry had", () => {
    const profile: LinkedInProfile = {
      ...emptyLinkedInProfile(),
      experience: [
        { id: "exp1", title: "T", organization: "O", description: "- One\n- Two" },
        { id: "exp2", title: "T", organization: "O", description: "A paragraph." },
      ],
    };
    const user = (key: string) =>
      sectionRewritePrompt({ section: findSection(profile, key)!, sources: factCheckSegments(profile, key)!, facts: [], style: "narrative", audiences: [] }).user;
    expect(user("exp1")).toContain("Original format: 2 '-' bullets. Return '-' bullets, at most 2.");
    expect(user("exp2")).toContain("Original format: a paragraph.");
  });
});
