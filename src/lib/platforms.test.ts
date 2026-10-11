import { describe, expect, it } from "vitest";
import { DEMO_BIO, SAMPLE_BIO_ADVERSARIAL_CONTENT, type BioPlatform } from "./demo-data";
import { checkRewrite } from "./fact-guard";
import { buildOneVariation, buildVariations } from "./postprocess";
import { textTarget, toneOptions } from "./styles";
import { evaluatePrompt, extractPrompt, rewritePrompt } from "./prompts";
import { PLATFORM_CONFIGS, PLATFORM_GROUPS } from "./rubrics";
import { PlatformSchema } from "./schemas";
import { segmentBio } from "./segments";
import { checkLength } from "./style-check";

const BIO_PLATFORMS = Object.keys(DEMO_BIO) as BioPlatform[];

describe("platform configs", () => {
  it("puts every platform in exactly one group, matching its config", () => {
    const listed = PLATFORM_GROUPS.flatMap((g) => g.platforms);
    expect([...listed].sort()).toEqual([...PlatformSchema.options].sort());
    for (const g of PLATFORM_GROUPS) {
      for (const id of g.platforms) expect(PLATFORM_CONFIGS[id].group).toBe(g.group);
    }
  });

  it("gives every platform audiences and traits with unique ids", () => {
    for (const config of Object.values(PLATFORM_CONFIGS)) {
      expect(config.audiences.length).toBeGreaterThan(0);
      expect(config.traits.length).toBeGreaterThan(0);
      expect(new Set(config.audiences.map((a) => a.id)).size).toBe(config.audiences.length);
      expect(new Set(config.traits.map((t) => t.id)).size).toBe(config.traits.length);
    }
  });

  it("gives every platform 8 lenses in 4 categories of 2, with 3 defaults from different categories", () => {
    for (const config of Object.values(PLATFORM_CONFIGS)) {
      expect(config.audiences, config.id).toHaveLength(8);
      expect(config.categories, config.id).toHaveLength(4);
      for (const cat of config.categories!) {
        expect(config.audiences.filter((a) => a.category === cat.id), `${config.id} ${cat.id}`).toHaveLength(2);
      }
      const defaults = config.defaultAudiences!.map((id) => config.audiences.find((a) => a.id === id));
      expect(defaults.every(Boolean), config.id).toBe(true);
      expect(new Set(defaults.map((a) => a!.category)).size, config.id).toBe(3);
      for (const a of config.audiences) expect(a.summary, `${config.id} ${a.id}`).toBeTruthy();
    }
  });

  it("gives every bio platform a character limit, and job targeting only to professional ones", () => {
    for (const config of Object.values(PLATFORM_CONFIGS)) {
      if (config.input === "bio") expect(config.maxChars).toBeGreaterThan(0);
      expect(config.jobDescription).toBe(config.group === "professional");
    }
  });
});

describe("segmentBio", () => {
  it("splits a bio into lines and sentences", () => {
    const s = segmentBio("cs student 💻 always hungry\npancakes on sundays. Teaching too.");
    expect(s.map((x) => x.text)).toEqual(["cs student 💻 always hungry", "pancakes on sundays.", "Teaching too."]);
    expect(s.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
  });
});

describe("checkLength", () => {
  it("flags text over the limit and passes text at or under it", () => {
    expect(checkLength(["a".repeat(150)], 150, "Instagram")).toEqual([]);
    const w = checkLength(["a".repeat(151)], 150, "Instagram");
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe("over_limit");
    expect(w[0].text).toBe("151 / 150 characters");
  });

  it("counts an emoji as one character and ignores a missing limit", () => {
    expect(checkLength(["💻".repeat(10)], 10, "X")).toEqual([]);
    expect(checkLength(["a".repeat(5000)], undefined, "LinkedIn")).toEqual([]);
  });

  it("checks each piece separately", () => {
    expect(checkLength(["short", "x".repeat(151)], 150, "Hinge")).toHaveLength(1);
  });
});

describe("prompts", () => {
  it("states the platform limit in bio rewrite prompts", () => {
    const config = PLATFORM_CONFIGS.instagram;
    const { system } = rewritePrompt({ config, segments: segmentBio("cs student"), facts: [], audiences: [], tone: "balanced" });
    expect(system).toContain("at most 150 characters");
    expect(system).toContain("hashtags");
  });

  it("forbids follower and engagement predictions for social platforms", () => {
    const config = PLATFORM_CONFIGS.github;
    const { system } = evaluatePrompt({
      config,
      audiences: config.audiences,
      traits: config.traits,
      segments: segmentBio("cs student"),
    });
    expect(system).toContain("never predict followers");
  });

  it("gives the prompt note to the prompt platforms (Hinge, Tinder) and not to bio platforms", () => {
    const seg = segmentBio("Pancakes on weekends.");
    expect(extractPrompt("tinder", seg).system).toContain("dating-profile");
    expect(extractPrompt("tinder", seg).system).toContain("prompt question");
    expect(extractPrompt("tinder", seg).system).toContain("About me");
    expect(extractPrompt("hinge", seg).system).toContain("prompt question");
    expect(extractPrompt("hinge", seg).system).not.toContain("About me");
    expect(extractPrompt("instagram", seg).system).not.toContain("prompt question");
  });
});

describe("buildVariations on a bio platform", () => {
  it("adds an over_limit style warning to a version that runs over", () => {
    const segments = segmentBio("cs student");
    const variant = { content: "cs student ".repeat(20).trim(), usedFactIds: [], changeSummary: [] };
    const [direct, narrative] = buildVariations(
      { direct: variant, narrative: { ...variant, content: "cs student" } },
      "instagram",
      segments,
      [],
    );
    expect(direct.styleWarnings.some((w) => w.kind === "over_limit")).toBe(true);
    expect(narrative.styleWarnings.some((w) => w.kind === "over_limit")).toBe(false);
  });
});

describe("bio demo personas", () => {
  it.each(BIO_PLATFORMS)("%s demo bio fits the platform limit and its facts are confirmed", (p) => {
    const { bio, facts } = DEMO_BIO[p];
    expect([...bio].length).toBeLessThanOrEqual(PLATFORM_CONFIGS[p].maxChars!);
    expect(facts.every((f) => f.confirmed)).toBe(true);
    expect(new Set(facts.map((f) => f.id)).size).toBe(facts.length);
  });

  it.each(BIO_PLATFORMS)("%s FactCheck demo is flagged against its own demo persona", (p) => {
    const w = checkRewrite({
      rewrite: { content: SAMPLE_BIO_ADVERSARIAL_CONTENT[p], usedFactIds: [] },
      segments: segmentBio(DEMO_BIO[p].bio),
      facts: DEMO_BIO[p].facts,
    });
    const kinds = new Set(w.map((x) => x.kind));
    expect(kinds.has("unsupported_number") || kinds.has("unsupported_entity")).toBe(true);
  });
});

describe("tone and length (one version)", () => {
  const seg = segmentBio("cs student who likes pancakes and long walks");

  it("asks for one version with the chosen tone and a length target capped at the limit", () => {
    const config = PLATFORM_CONFIGS.instagram;
    const { system } = rewritePrompt({ config, segments: seg, facts: [], audiences: [], tone: "more_playful", single: true, length: "much_longer" });
    expect(system).toContain("Write one version");
    expect(system).not.toContain("Write two versions");
    expect(system).toContain("Selected length: Much longer");
    expect(system).toMatch(/Aim for about 79 characters/);
    expect(system).toContain("lighter, more playful phrasing");
  });

  it("keeps two versions when single isn't asked for", () => {
    const { system } = rewritePrompt({ config: PLATFORM_CONFIGS.github, segments: seg, facts: [], audiences: [], tone: "balanced" });
    expect(system).toContain("Write two versions");
  });

  it("gives prompt platforms a target per answer, each under its own limit", () => {
    const answers = [{ id: "s1", text: "a".repeat(200), prompt: "About me" }, { id: "s2", text: "b".repeat(250), prompt: "I go crazy for…" }];
    const { system } = rewritePrompt({ config: PLATFORM_CONFIGS.tinder, segments: answers, facts: [], audiences: [], tone: "balanced", single: true, length: "much_longer" });
    expect(system).toContain("[s1] about 360 characters (now 200)");
    expect(system).toContain("[s2] about 300 characters (now 250)");
  });

  it("targets relative to the original and within the cap", () => {
    expect(textTarget(100, "same", 150)).toBe(100);
    expect(textTarget(100, "shorter", 150)).toBe(75);
    expect(textTarget(100, "much_longer", 150)).toBe(150);
    expect(textTarget(10, "much_shorter", 150)).toBe(10);
  });

  it("names the tones by group", () => {
    expect(toneOptions("professional").map((t) => t.label)).toEqual(["Close to my words", "Balanced", "Warmer"]);
    expect(toneOptions("dating").map((t) => t.id)).toEqual(["closer_to_my_words", "balanced", "more_playful"]);
  });

  it("builds one checked version", () => {
    const [only, ...rest] = buildOneVariation({ content: "cs student. Pancakes at Google.", usedFactIds: [], changeSummary: [] }, "instagram", seg, []);
    expect(rest).toEqual([]);
    expect(only.warnings.some((w) => w.kind === "unsupported_entity")).toBe(true);
  });
});
