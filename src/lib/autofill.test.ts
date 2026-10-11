import { describe, expect, it } from "vitest";
import {
  applyDrafts,
  canFill,
  draftSlots,
  draftSources,
  fillBio,
  fillHinge,
  fillLinkedIn,
  fillTarget,
  fillTinder,
  hasProfile,
  rankFor,
  sourceSentences,
  type ProfileSources,
} from "./autofill";
import { DEMO_HINGE_INPUT, DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE, DEMO_TINDER } from "./demo-data";
import { emptyHingePairs } from "./persona-ui";
import { buildDrafts } from "./postprocess";
import { emptyLinkedInProfile } from "./profile";
import { draftPrompt } from "./prompts";
import { PLATFORM_CONFIGS } from "./rubrics";
import { DraftRequestSchema, LIMITS, type IdentityFact } from "./schemas";
import { emptyTinderFields, emptyTinderProfile } from "./tinder";

const FACTS: IdentityFact[] = DEMO_LINKEDIN_FACTS.filter((f) => f.confirmed);

/** Every platform filled in for the fictitious persona, with location and sensitive Tinder picks set. */
const ALL: ProfileSources = {
  linkedin: { ...DEMO_LINKEDIN_PROFILE, experience: DEMO_LINKEDIN_PROFILE.experience.map((e) => ({ ...e, location: "Brookhaven" })) },
  hinge: DEMO_HINGE_INPUT.map((p) => ({ ...p })),
  tinder: { ...DEMO_TINDER, fields: { ...DEMO_TINDER.fields, livingIn: "Brookhaven", zodiac: "Scorpio", drinking: "Sober curious" } },
  bios: { instagram: "cs student 💻 always hungry 🌮\npancakes on sundays" },
};
const NONE: ProfileSources = { linkedin: null, hinge: null, tinder: null, bios: {} };

describe("sourceSentences and rankFor", () => {
  it("never uses the target's own text, and adds confirmed facts", () => {
    const s = sourceSentences(ALL, "instagram", FACTS);
    expect(s.some((x) => x.from === "instagram")).toBe(false);
    expect(s.filter((x) => x.from === "facts")).toHaveLength(FACTS.length);
  });

  it("gives a professional profile only professional text and facts", () => {
    const ranked = rankFor("linkedin", sourceSentences(ALL, "linkedin", FACTS));
    expect(ranked.every((x) => x.kind === "identity" || x.from === "facts" || PLATFORM_CONFIGS[x.from].group === "professional")).toBe(true);
    expect(ranked.map((x) => x.text).join(" ")).not.toMatch(/pancake|food truck/i);
  });

  it("keeps prompt answers off bio platforms, and only role and school lines from LinkedIn on casual ones", () => {
    const ranked = rankFor("instagram", sourceSentences(ALL, "instagram", []));
    expect(ranked.some((x) => x.kind === "answer")).toBe(false);
    expect(ranked.filter((x) => x.from === "linkedin").map((x) => x.text)).toEqual([
      "Software Engineering Intern at Tallowtree Analytics.",
      "B.S. Computer Science, Calder Valley University.",
    ]);
    expect(rankFor("hinge", sourceSentences(ALL, "hinge", [])).some((x) => x.kind === "answer")).toBe(true);
  });

  it("drops duplicates and sentences already in the target", () => {
    const sentences = [
      { text: "I like pancakes.", from: "instagram" as const, group: "social" as const, kind: "text" as const },
      { text: "i like pancakes.", from: "github" as const, group: "social" as const, kind: "text" as const },
      { text: "I walk a lot.", from: "github" as const, group: "social" as const, kind: "text" as const },
    ];
    expect(rankFor("tinder", sentences, "I walk a lot.").map((x) => x.text)).toEqual(["I like pancakes."]);
  });

  it("skips a sentence already contained in one it picked, and one-word fragments", () => {
    const bios: ProfileSources = { ...NONE, linkedin: DEMO_LINKEDIN_PROFILE, bios: { instagram: "B.S. Computer Science, Calder Valley University." } };
    const texts = rankFor("tinder", sourceSentences(bios, "tinder", [])).map((x) => x.text);
    expect(texts.filter((t) => t.includes("Calder Valley University"))).toEqual(["B.S. Computer Science, Calder Valley University."]);
    expect(texts).not.toContain("B.S.");
  });
});

describe("Fill (no AI)", () => {
  it("fills an empty bio with whole sentences that fit the limit, and leaves a written one alone", () => {
    const sentences = sourceSentences(ALL, "github", FACTS);
    const { value, notes } = fillBio("github", "", sentences);
    expect(value.length).toBeGreaterThan(0);
    expect([...value].length).toBeLessThanOrEqual(PLATFORM_CONFIGS.github.maxChars!);
    expect(notes[0]).toMatch(/^Bio: from /);
    expect(fillBio("github", "Mine.", sentences)).toEqual({ value: "Mine.", notes: [] });
  });

  it("fills only empty Hinge answers, each under the limit", () => {
    const pairs = [{ prompt: "A perfect Sunday", answer: "Already mine." }, ...emptyHingePairs().slice(1)];
    const { value } = fillHinge(pairs, sourceSentences(ALL, "hinge", FACTS));
    expect(value[0].answer).toBe("Already mine.");
    expect(value.slice(1).every((p) => p.answer.trim() && p.answer.length <= 300)).toBe(true);
    expect(value.map((p) => p.prompt)).toEqual(pairs.map((p) => p.prompt));
  });

  it("fills Tinder's work fields from LinkedIn, then About and empty answers, never what's typed", () => {
    const start = { ...emptyTinderProfile(), fields: { ...emptyTinderFields(), jobTitle: "Barista" } };
    const r = fillTinder(start, sourceSentences(ALL, "tinder", FACTS), ALL.linkedin);
    expect(r.value.fields.jobTitle).toBe("Barista");
    expect(r.value.fields.company).toBe("Tallowtree Analytics");
    expect(r.fromLinkedIn).not.toContain("jobTitle");
    expect([...r.value.about].length).toBeLessThanOrEqual(LIMITS.tinderAbout);
    expect(r.value.about).not.toBe("");
    expect(r.value.prompts[0].answer).not.toBe("");
    // Lifestyle and relationship picks are the user's to make; fill never sets them.
    expect(r.value.fields.zodiac).toBeNull();
    expect(r.value.fields.drinking).toBeNull();
  });

  it("builds LinkedIn's role, school, languages, and headline from Tinder's work fields", () => {
    const sources: ProfileSources = { ...NONE, tinder: DEMO_TINDER };
    const { value, notes } = fillLinkedIn(emptyLinkedInProfile(), sourceSentences(sources, "linkedin", FACTS), DEMO_TINDER);
    expect(value.experience[0]).toMatchObject({ title: "Teaching Assistant", organization: "Calder Valley University", description: "" });
    expect(value.education[0].organization).toBe("Calder Valley University");
    expect(value.languages).toEqual(["English", "Hindi"]);
    expect(value.headline).toBe("Teaching Assistant at Calder Valley University");
    expect(value.about).not.toMatch(/pancake|food truck/i);
    expect(notes.length).toBeGreaterThan(3);
  });

  it("never touches a LinkedIn profile that's already filled in", () => {
    const { value, notes } = fillLinkedIn(DEMO_LINKEDIN_PROFILE, sourceSentences(ALL, "linkedin", FACTS), ALL.tinder);
    expect(value).toEqual(DEMO_LINKEDIN_PROFILE);
    expect(notes).toEqual([]);
  });

  it("fills a social bio from LinkedIn alone with the role and school lines", () => {
    const { value } = fillBio("instagram", "", sourceSentences({ ...NONE, linkedin: DEMO_LINKEDIN_PROFILE }, "instagram", []));
    expect(value).toBe("Software Engineering Intern at Tallowtree Analytics. B.S. Computer Science, Calder Valley University.");
  });

  it("knows when there's nothing to fill from", () => {
    expect(canFill("instagram", NONE, [])).toBe(false);
    expect(canFill("instagram", NONE, FACTS)).toBe(true);
    expect(fillTarget({ kind: "bio", platform: "instagram", value: "" }, NONE, []).notes).toEqual([]);
    expect(hasProfile("tinder", { ...NONE, tinder: emptyTinderProfile() })).toBe(false);
    expect(hasProfile("tinder", ALL)).toBe(true);
  });
});

describe("Draft with AI: what is sent", () => {
  const sources = draftSources(ALL);

  it("labels every source by platform with unique, short ids", () => {
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
    expect(sources.every((s) => s.id.length <= 16)).toBe(true);
    expect(sources.find((s) => s.id.startsWith("hi-"))?.prompt).toMatch(/^Hinge: /);
    expect(sources.find((s) => s.id.startsWith("ig-"))?.prompt).toBe("Instagram");
  });

  it("never carries a location or a Tinder profile pick", () => {
    const json = JSON.stringify(sources);
    for (const value of ["Brookhaven", "Scorpio", "Sober curious", "Long-term partner"]) expect(json).not.toContain(value);
  });

  it("builds a valid request and a prompt with the slots and nothing private", () => {
    const slots = draftSlots({ kind: "bio", platform: "github", value: "" });
    const req = { consent: true, platform: "github", sources, facts: FACTS, slots };
    expect(DraftRequestSchema.safeParse(req).success).toBe(true);
    const { system, user } = draftPrompt({ config: PLATFORM_CONFIGS.github, slots, sources, facts: FACTS });
    expect(user).toContain("id=bio: Bio");
    expect(system).toContain("Use ONLY information in the sources");
    for (const value of ["Brookhaven", "Scorpio", "Sober curious"]) expect(system + user).not.toContain(value);
  });
});

describe("draftSlots and applyDrafts", () => {
  it("asks only for empty spots", () => {
    const tinder = { ...emptyTinderProfile(), about: "Mine.", prompts: [{ prompt: "I go crazy for…", answer: "" }] };
    expect(draftSlots({ kind: "tinder", value: tinder }).map((s) => [s.id, s.prompt])).toEqual([["a0", "I go crazy for…"]]);
    expect(draftSlots({ kind: "linkedin", value: DEMO_LINKEDIN_PROFILE })).toEqual([]);
  });

  it("never overwrites text typed while the draft ran", () => {
    const draft = [{ slotId: "about", text: "Drafted.", dropped: [], warnings: [], styleWarnings: [] }];
    const typed = applyDrafts({ kind: "tinder", value: { ...emptyTinderProfile(), about: "Typed meanwhile." } }, draft);
    expect(typed.kind === "tinder" && typed.value.about).toBe("Typed meanwhile.");
    const empty = applyDrafts({ kind: "tinder", value: emptyTinderProfile() }, draft);
    expect(empty.kind === "tinder" && empty.value.about).toBe("Drafted.");
  });
});

describe("buildDrafts: FactCheck on every drafted sentence", () => {
  const sources = draftSources(ALL);
  const slots = [
    { id: "bio", label: "Bio", maxChars: 101 },
    { id: "a0", label: "Answer 1", prompt: "I go crazy for…", maxChars: 300 },
  ];

  it("removes sentences with invented names or numbers and keeps traced ones", () => {
    const [bio] = buildDrafts(
      { drafts: [{ slotId: "bio", text: "Computer science student at Calder Valley University. Interned at Google for 3 summers." }] },
      slots,
      sources,
      FACTS,
    );
    expect(bio.text).toBe("Computer science student at Calder Valley University.");
    expect(bio.dropped).toEqual(["Interned at Google for 3 summers."]);
    expect(bio.warnings).toEqual([]);
  });

  it("cuts to the slot's limit at a sentence, keeps answers on one line, and returns every slot", () => {
    const long = "Pancakes on weekends. ".repeat(8).trim();
    const out = buildDrafts(
      { drafts: [{ slotId: "bio", text: long }, { slotId: "a0", text: "Food trucks\nin any city." }, { slotId: "zz", text: "ignored" }] },
      slots,
      sources,
      [],
    );
    expect(out.map((d) => d.slotId)).toEqual(["bio", "a0"]);
    expect([...out[0].text].length).toBeLessThanOrEqual(101);
    expect(out[0].text.endsWith(".")).toBe(true);
    expect(out[1].text).not.toContain("\n");
  });

  it("returns an empty draft when the model has nothing", () => {
    const [bio] = buildDrafts({ drafts: [] }, slots.slice(0, 1), sources, []);
    expect(bio.text).toBe("");
  });
});
