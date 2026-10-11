import { describe, expect, it } from "vitest";
import { SYNTHETIC_LINKEDIN_LINES } from "./__fixtures__/linkedin-synthetic";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE } from "./demo-data";
import { parseLinkedInLines } from "./linkedin-pdf";
import {
  emptyLinkedInProfile,
  factCheckSegments,
  factCoverage,
  findSection,
  nextEntryId,
  profileCharCount,
  rewritableSections,
  sectionOfSegment,
  segmentProfile,
} from "./profile";
import { LIMITS, LinkedInProfileSchema, type LinkedInProfile } from "./schemas";

const profile: LinkedInProfile = {
  ...emptyLinkedInProfile(),
  headline: "ML intern",
  about: "I build models. I like data!",
  experience: [
    {
      id: "exp1",
      title: "Machine Learning Intern",
      organization: "Acme Labs",
      dates: "July 2026 - Present (4 months)",
      location: "Springfield",
      description: "- Trained a classifier\n· Wrote the docs",
    },
    { id: "exp2", title: "Barista", organization: "Bean Co", description: "" },
  ],
  education: [{ id: "edu1", title: "B.S. Math", organization: "State U", description: "" }],
  skills: ["Python", "SQL"],
};

describe("rewritableSections", () => {
  it("lists headline, About, then entries with descriptions, in order", () => {
    const s = rewritableSections(profile);
    expect(s.map((x) => x.key)).toEqual(["headline", "about", "exp1"]);
    expect(s[2]).toEqual({
      key: "exp1",
      kind: "experience",
      label: "Experience · Acme Labs · Machine Learning Intern",
      text: "- Trained a classifier\n· Wrote the docs",
    });
  });

  it("skips an empty headline and About", () => {
    expect(rewritableSections({ ...profile, headline: " ", about: "" }).map((x) => x.key)).toEqual(["exp1"]);
  });

  it("findSection uses the profile's own text", () => {
    expect(findSection(profile, "about")?.text).toBe("I build models. I like data!");
    expect(findSection(profile, "exp2")).toBeUndefined();
    expect(findSection(profile, "nope")).toBeUndefined();
  });
});

describe("segmentProfile", () => {
  const segs = segmentProfile(profile);

  it("numbers segments per section, entry header first, bullets stripped", () => {
    expect(segs.map((s) => [s.id, s.text])).toEqual([
      ["headline-s1", "ML intern"],
      ["about-s1", "I build models."],
      ["about-s2", "I like data!"],
      ["exp1-s1", "Machine Learning Intern · Acme Labs · July 2026 - Present (4 months)"],
      ["exp1-s2", "Trained a classifier"],
      ["exp1-s3", "Wrote the docs"],
      ["exp2-s1", "Barista · Bean Co"],
      ["edu1-s1", "B.S. Math · State U"],
      ["skills-s1", "Python, SQL"],
    ]);
  });

  it("never includes locations", () => {
    expect(segs.some((s) => s.text.includes("Springfield"))).toBe(false);
  });

  it("keeps ids within the segment id limit", () => {
    const big: LinkedInProfile = {
      ...emptyLinkedInProfile(),
      experience: [{ id: "exp999", title: "T", organization: "O", description: Array(40).fill("A line.").join("\n") }],
    };
    for (const s of segmentProfile(big)) expect(s.id.length).toBeLessThanOrEqual(16);
  });

  it("chunks an overlong sentence instead of truncating it", () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const s = segmentProfile({ ...emptyLinkedInProfile(), about: words });
    expect(s.length).toBeGreaterThan(1);
    expect(s.map((x) => x.text).join(" ")).toBe(words);
  });
});

describe("sectionOfSegment", () => {
  it("maps segment ids to section keys", () => {
    expect(sectionOfSegment("exp2-s1")).toBe("exp2");
    expect(sectionOfSegment("about-s12")).toBe("about");
    expect(sectionOfSegment("skills-s1")).toBe("skills");
    expect(sectionOfSegment("proj10-s3")).toBe("proj10");
  });

  it("returns null for legacy or malformed ids", () => {
    expect(sectionOfSegment("s1")).toBeNull();
    expect(sectionOfSegment("exp2")).toBeNull();
    expect(sectionOfSegment("foo-s1")).toBeNull();
  });

  it("round-trips every segment of the demo profile", () => {
    const keys = new Set(rewritableSections(DEMO_LINKEDIN_PROFILE).map((s) => s.key));
    for (const s of segmentProfile(DEMO_LINKEDIN_PROFILE)) {
      const key = sectionOfSegment(s.id);
      expect(key).not.toBeNull();
      if (key !== "skills" && key !== "honors" && key !== "edu1") expect(keys.has(key!)).toBe(true);
    }
  });
});

describe("factCheckSegments", () => {
  it("gives headline and About the whole profile", () => {
    expect(factCheckSegments(profile, "about")).toEqual(segmentProfile(profile));
  });

  it("gives an entry only its own text", () => {
    expect(factCheckSegments(profile, "exp1")?.map((s) => s.id)).toEqual(["exp1-s1", "exp1-s2", "exp1-s3"]);
    expect(factCheckSegments(profile, "nope")).toBeUndefined();
  });
});

describe("nextEntryId", () => {
  it("picks the next free number for that kind", () => {
    expect(nextEntryId(profile, "experience")).toBe("exp3");
    expect(nextEntryId(profile, "projects")).toBe("proj1");
  });
});

describe("profile schema and limits", () => {
  it("accepts the demo profile", () => {
    expect(LinkedInProfileSchema.safeParse(DEMO_LINKEDIN_PROFILE).success).toBe(true);
  });

  it("counts everything except locations", () => {
    expect(profileCharCount(profile)).toBe(profileCharCount({ ...profile, experience: profile.experience.map((e) => ({ ...e, location: undefined })) }));
  });

  it("rejects a profile over the character limit", () => {
    const entry = (i: number) => ({ id: `exp${i}`, title: "T", organization: "O", description: "x".repeat(2000) });
    const tooBig = { ...emptyLinkedInProfile(), experience: [1, 2, 3, 4, 5, 6].map(entry) };
    expect(profileCharCount(tooBig)).toBeGreaterThan(LIMITS.profileText);
    expect(LinkedInProfileSchema.safeParse(tooBig).success).toBe(false);
  });

  it("rejects duplicate entry ids and bad id formats", () => {
    const e = { id: "exp1", title: "T", organization: "O", description: "" };
    expect(LinkedInProfileSchema.safeParse({ ...emptyLinkedInProfile(), experience: [e, e] }).success).toBe(false);
    expect(LinkedInProfileSchema.safeParse({ ...emptyLinkedInProfile(), experience: [{ ...e, id: "x1" }] }).success).toBe(false);
  });
});

describe("factCoverage", () => {
  const facts = [
    { id: "f1", text: "I trained a classifier at Acme Labs.", confirmed: true, source: "user" as const },
    { id: "f2", text: "I speak fluent Portuguese.", confirmed: true, source: "user" as const },
    { id: "f3", text: "I trained a classifier.", confirmed: false, source: "extracted" as const },
    { id: "f4", text: "I trained 3 classifiers at Acme Labs.", confirmed: true, source: "user" as const },
  ];
  const cov = factCoverage(profile, facts);

  it("finds where confirmed facts appear and ignores unconfirmed ones", () => {
    expect(cov.perFact).toEqual([
      { factId: "f1", sectionKeys: ["exp1"] },
      { factId: "f2", sectionKeys: [] },
      { factId: "f4", sectionKeys: [] }, // the number 3 isn't on the profile
    ]);
    expect(cov.summary).toEqual({ confirmed: 3, covered: 1 });
  });

  it("gives real counts for the demo persona", () => {
    const demo = factCoverage(DEMO_LINKEDIN_PROFILE, DEMO_LINKEDIN_FACTS);
    expect(demo.summary.confirmed).toBe(DEMO_LINKEDIN_FACTS.length);
    expect(demo.summary.covered).toBeGreaterThan(0);
    expect(demo.summary.covered).toBeLessThanOrEqual(demo.summary.confirmed);
  });
});

describe("factCoverage on a realistic (synthetic) import", () => {
  const { profile: rowan } = parseLinkedInLines(SYNTHETIC_LINKEDIN_LINES);
  const fact = (id: string, text: string) => ({ id, text, confirmed: true, source: "user" as const });
  const facts = [
    fact("f1", "I tuned PID loops for rover platforms."), // paraphrase of exp1
    fact("f2", "I wrote an EKF state estimator for field trials."), // exp1
    fact("f3", "I worked on motor control firmware at Kestrel Labs."), // exp3 (and its title line)
    fact("f4", "I have a master's in mechanical engineering."), // edu1
    fact("f5", "I mentor a high school robotics team."), // About
    fact("f6", "I speak fluent Portuguese."), // not on the profile
    fact("f7", "I tuned 60 PID loops."), // number not on the profile
    fact("f8", "I like robots."), // one common word must not be enough
  ];
  const cov = factCoverage(rowan, facts);
  const where = Object.fromEntries(cov.perFact.map((f) => [f.factId, f.sectionKeys]));

  it("finds paraphrased facts in the right section", () => {
    expect(where.f1).toEqual(["exp1"]);
    expect(where.f2).toEqual(["exp1"]);
    expect(where.f3).toContain("exp3");
    expect(where.f4).toEqual(["edu1"]);
    expect(where.f5).toEqual(["about"]);
  });

  it("doesn't count facts that aren't there, changed numbers, or one shared word", () => {
    expect(where.f6).toEqual([]);
    expect(where.f7).toEqual([]);
    expect(where.f8).toEqual([]);
    expect(cov.summary).toEqual({ confirmed: 8, covered: 5 });
  });

  it("lists every section in profile order with its facts, including empty ones", () => {
    expect(cov.bySection.map((s) => s.sectionKey)).toEqual([
      "headline", "about", "exp1", "exp2", "exp3", "edu1", "edu2", "skills", "honors",
    ]);
    expect(cov.bySection.find((s) => s.sectionKey === "exp1")).toEqual({
      sectionKey: "exp1",
      label: "Experience · Brightwater Robotics · Controls Engineer",
      factIds: ["f1", "f2"],
    });
    expect(cov.bySection.find((s) => s.sectionKey === "honors")?.factIds).toEqual([]);
    // Counts agree with perFact.
    const total = cov.bySection.reduce((n, s) => n + s.factIds.length, 0);
    expect(total).toBe(cov.perFact.reduce((n, f) => n + f.sectionKeys.length, 0));
  });
});
