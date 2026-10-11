import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_PROFILE, DEMO_TINDER, DEMO_TINDER_FACTS, SAMPLE_TINDER_ADVERSARIAL_CONTENT } from "./demo-data";
import { checkRewrite } from "./fact-guard";
import { buildHingeVariations } from "./postprocess";
import { emptyLinkedInProfile } from "./profile";
import { evaluatePrompt, extractPrompt, rewritePrompt } from "./prompts";
import { PLATFORM_CONFIGS } from "./rubrics";
import {
  EvaluateRequestSchema,
  LIMITS,
  RewriteRequestSchema,
  TinderFieldsSchema,
  TinderProfileSchema,
  type TinderProfile,
} from "./schemas";
import {
  carryOverFromLinkedIn,
  checkTinderLength,
  emptyTinderFields,
  emptyTinderProfile,
  fieldFactsAsFacts,
  piecesOntoSegments,
  segmentTinder,
  TINDER_ABOUT_PROMPT,
  TINDER_AI_FIELDS,
  TINDER_FIELD_GROUPS,
  TINDER_PROMPTS,
  tinderFieldFacts,
  tinderFromLinkedIn,
} from "./tinder";

/** A fictitious profile with every field filled in, including the ones that must never be sent. */
const FULL: TinderProfile = {
  about: "Weekend baker.\n\nI will find the best food truck in any city.",
  prompts: [
    { prompt: "I go crazy for…", answer: "Food trucks." },
    { prompt: "My ideal weekend includes…", answer: "" },
  ],
  fields: {
    jobTitle: "Teaching Assistant",
    company: "Calder Valley University",
    school: "Calder Valley University",
    languages: ["English", "Hindi"],
    livingIn: "Brookhaven",
    openTo: "Short-term fun",
    relationshipType: ["Polyamory"],
    zodiac: "Scorpio",
    educationLevel: "PhD",
    children: "I have children and want more",
    communicationStyle: "Phone caller",
    loveStyle: "Thoughtful gestures",
    pets: ["Reptile"],
    drinking: "Sober curious",
    smoking: "Trying to quit",
    cannabis: "Occasionally",
    workout: "Every day",
    socialMedia: "Influencer status",
    goingOut: "Most weekends",
  },
};
/** Values of the fields that are never sent (location, relationship, basics, lifestyle). */
const NEVER_SENT = [
  "Brookhaven",
  "Short-term fun",
  "Polyamory",
  "Scorpio",
  "PhD",
  "I have children and want more",
  "Phone caller",
  "Thoughtful gestures",
  "Reptile",
  "Sober curious",
  "Trying to quit",
  "Occasionally",
  "Every day",
  "Influencer status",
  "Most weekends",
];
const expectNoneSent = (text: string) => {
  for (const value of NEVER_SENT) expect(text).not.toContain(value);
};

describe("Tinder schema", () => {
  it("accepts the empty, demo, and full profiles", () => {
    expect(TinderProfileSchema.safeParse(emptyTinderProfile()).success).toBe(true);
    expect(TinderProfileSchema.safeParse(DEMO_TINDER).success).toBe(true);
    expect(TinderProfileSchema.safeParse(FULL).success).toBe(true);
  });

  it("rejects an option Tinder's lists don't have, and an About over 500 characters", () => {
    expect(TinderFieldsSchema.safeParse({ ...emptyTinderFields(), zodiac: "Ophiuchus" }).success).toBe(false);
    expect(TinderProfileSchema.safeParse({ ...emptyTinderProfile(), about: "a".repeat(501) }).success).toBe(false);
    const prompts = Array.from({ length: LIMITS.maxTinderPrompts + 1 }, (_, i) => ({ prompt: TINDER_PROMPTS[i], answer: "x" }));
    expect(TinderProfileSchema.safeParse({ ...emptyTinderProfile(), prompts }).success).toBe(false);
  });

  it("lists every field in exactly one editor group", () => {
    const listed = TINDER_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(TinderFieldsSchema.shape).sort());
  });
});

describe("Tinder prompts", () => {
  it("has the user's 42 prompts, no duplicates, with the confirmed fixes and none of the dictation slips", () => {
    expect(TINDER_PROMPTS).toHaveLength(42);
    expect(new Set(TINDER_PROMPTS).size).toBe(TINDER_PROMPTS.length);
    const all = TINDER_PROMPTS.join("\n");
    for (const slip of ["hang myself", "badge flag", "Hell, I'll", "It's not a vacation", "Best friend, best", "One first time"]) {
      expect(all).not.toContain(slip);
    }
    for (const fix of ["My biggest red flag is…", "A hill I'll die on is…", "I hype myself up by…", "On vacation I'm…", "Best first date in the city…"]) {
      expect(TINDER_PROMPTS).toContain(fix);
    }
  });
});

describe("carry-over from LinkedIn", () => {
  it("takes the latest role, the latest school, and languages", () => {
    expect(tinderFromLinkedIn(DEMO_LINKEDIN_PROFILE)).toEqual({
      jobTitle: "Software Engineering Intern",
      company: "Tallowtree Analytics",
      school: "Calder Valley University",
      languages: ["English", "Hindi"],
    });
  });

  it("gives blanks for an empty profile, including one without languages", () => {
    expect(tinderFromLinkedIn(emptyLinkedInProfile())).toEqual({ jobTitle: "", company: "", school: "", languages: [] });
  });

  it("fills only blank fields and never overwrites what the user typed", () => {
    const typed = { ...emptyTinderFields(), jobTitle: "Barista", languages: ["French"] };
    const { fields, filled } = carryOverFromLinkedIn(typed, DEMO_LINKEDIN_PROFILE);
    expect(fields.jobTitle).toBe("Barista");
    expect(fields.languages).toEqual(["French"]);
    expect(fields.company).toBe("Tallowtree Analytics");
    expect(filled).toEqual(["company", "school"]);
  });
});

describe("segmentTinder", () => {
  it("is About me then each answered prompt, with blank lines in the About folded", () => {
    const s = segmentTinder(FULL);
    expect(s.map((x) => x.prompt)).toEqual([TINDER_ABOUT_PROMPT, "I go crazy for…"]);
    expect(s[0].text).toBe("Weekend baker.\nI will find the best food truck in any city.");
    expect(segmentTinder(emptyTinderProfile())).toEqual([]);
  });

  it("never carries a profile field", () => {
    const json = JSON.stringify(segmentTinder(FULL));
    expectNoneSent(json);
    expect(json).not.toContain("Teaching Assistant");
  });
});

describe("tinderFieldFacts", () => {
  it("holds only the work fields, labeled, and nothing else", () => {
    const facts = tinderFieldFacts(FULL.fields);
    expect(facts.map((f) => f.field)).toEqual([...TINDER_AI_FIELDS]);
    expect(facts.map((f) => f.text)).toEqual([
      "Job title: Teaching Assistant",
      "Company: Calder Valley University",
      "School: Calder Valley University",
      "Languages I know: English, Hindi",
    ]);
    expectNoneSent(JSON.stringify(facts));
    expect(tinderFieldFacts(emptyTinderFields())).toEqual([]);
  });

  it("fits the rewrite request schema", () => {
    const req = {
      consent: true,
      platform: "tinder",
      segments: segmentTinder(FULL),
      facts: [],
      fieldFacts: tinderFieldFacts(FULL.fields),
      audiences: [],
    };
    expect(RewriteRequestSchema.safeParse(req).success).toBe(true);
  });
});

describe("data minimization: what the AI receives", () => {
  const config = PLATFORM_CONFIGS.tinder;
  const segments = segmentTinder(FULL);

  it("the rewrite prompt has the work fields and none of the others", () => {
    const { system, user } = rewritePrompt({
      config,
      segments,
      facts: DEMO_TINDER_FACTS,
      fieldFacts: tinderFieldFacts(FULL.fields),
      audiences: config.audiences,
      tone: "balanced",
    });
    expect(user).toContain("Job title: Teaching Assistant");
    expect(user).toContain("Languages I know: English, Hindi");
    expectNoneSent(system + user);
  });

  it("the evaluate prompt has no profile field at all, and the request can't carry one", () => {
    const { system, user } = evaluatePrompt({ config, audiences: config.audiences, traits: config.traits, segments });
    expectNoneSent(system + user);
    expect(user).not.toContain("Teaching Assistant");
    const parsed = EvaluateRequestSchema.parse({
      consent: true,
      platform: "tinder",
      segments,
      audiences: [config.audiences[0].id],
      traits: [config.traits[0].id],
      fieldFacts: tinderFieldFacts(FULL.fields),
      fields: FULL.fields,
    });
    expect(JSON.stringify(parsed)).not.toContain("Teaching Assistant");
    expectNoneSent(JSON.stringify(parsed));
  });

  it("the extract prompt has no profile field", () => {
    const { system, user } = extractPrompt("tinder", segments);
    expectNoneSent(system + user);
  });

  it("tells dating lenses to judge the writing, never life choices", () => {
    for (const platform of ["tinder", "hinge"] as const) {
      const c = PLATFORM_CONFIGS[platform];
      const { system } = evaluatePrompt({ config: c, audiences: c.audiences, traits: c.traits, segments });
      expect(system).toContain("Judge only the writing");
      expect(system).toContain("never stereotype");
    }
  });

  it("states both limits in the rewrite prompt", () => {
    const { system } = rewritePrompt({ config, segments, facts: [], audiences: [], tone: "balanced" });
    expect(system).toContain(`at most ${LIMITS.tinderAbout} characters`);
    expect(system).toContain(`under ${LIMITS.tinderAnswer} characters`);
  });
});

describe("FactCheck with Tinder profile fields", () => {
  const segments = segmentTinder(DEMO_TINDER);
  const fieldFacts = fieldFactsAsFacts(tinderFieldFacts(DEMO_TINDER.fields));
  const rewrite = (content: string) => ({ content, usedFactIds: [] });

  it("accepts a job, school, or language the user entered as a field", () => {
    const content = "Teaching Assistant at Calder Valley University. I speak Hindi and will find the best food truck in any city.";
    const flagged = checkRewrite({ rewrite: rewrite(content), segments, facts: [...DEMO_TINDER_FACTS, ...fieldFacts] });
    expect(flagged.filter((w) => w.kind === "unsupported_entity")).toEqual([]);
  });

  it("flags the same claim when the field isn't there", () => {
    const content = "Teaching Assistant at Calder Valley University.";
    const flagged = checkRewrite({ rewrite: rewrite(content), segments, facts: DEMO_TINDER_FACTS });
    expect(flagged.some((w) => w.kind === "unsupported_entity")).toBe(true);
  });

  it("still flags invented employers and numbers", () => {
    const flagged = checkRewrite({
      rewrite: rewrite(SAMPLE_TINDER_ADVERSARIAL_CONTENT),
      segments,
      facts: [...DEMO_TINDER_FACTS, ...fieldFacts],
    });
    const kinds = new Set(flagged.map((w) => w.kind));
    expect(kinds.has("unsupported_entity")).toBe(true);
    expect(kinds.has("unsupported_number")).toBe(true);
  });
});

describe("Tinder lengths", () => {
  const segments = segmentTinder(FULL);

  it("holds About me to 500 and each answer to the answer limit", () => {
    expect(checkTinderLength(["a".repeat(500), "b".repeat(300)], segments)).toEqual([]);
    expect(checkTinderLength(["a".repeat(501), "b".repeat(300)], segments)).toHaveLength(1);
    expect(checkTinderLength(["a".repeat(400), "b".repeat(301)], segments)).toHaveLength(1);
  });

  it("builds rewrites per piece, folding blank lines and checking each piece's own limit", () => {
    const answers = [
      { segmentId: "s1", text: "Weekend baker.\n\nFood truck finder." },
      { segmentId: "s2", text: "x".repeat(LIMITS.tinderAnswer + 1) },
    ];
    const variant = { answers, usedFactIds: [], changeSummary: [] };
    const [direct] = buildHingeVariations({ direct: variant, narrative: variant }, segments, [], "tinder");
    expect(direct.rewrite.answers?.[0].text).toBe("Weekend baker.\nFood truck finder.");
    expect(direct.rewrite.content.split(/\n\s*\n/)).toHaveLength(2);
    expect(direct.styleWarnings.filter((w) => w.kind === "over_limit")).toHaveLength(1);
  });

  it("maps an edited rewrite back onto its segments", () => {
    const mapped = piecesOntoSegments("New about.\n\nNew answer.", segments);
    expect(mapped.map((s) => s.text)).toEqual(["New about.", "New answer."]);
    expect(mapped.map((s) => s.prompt)).toEqual(segments.map((s) => s.prompt));
  });
});
