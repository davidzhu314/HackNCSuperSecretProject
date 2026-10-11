import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_PROFILE } from "./demo-data";
import { emptyHingePairs, factTextSchema, mergeFacts, profileSectionList, wordDiff } from "./persona-ui";
import { rewritableSections } from "./profile";
import type { IdentityFact } from "./schemas";
import { PLATFORM_CONFIGS } from "./rubrics";

// Ported from the Lovable prototype's tests.

describe("persona UI helpers", () => {
  it("requires nonempty, bounded fact text", () => {
    expect(factTextSchema.safeParse(" ").success).toBe(false);
    expect(factTextSchema.safeParse("x".repeat(301)).success).toBe(false);
    expect(factTextSchema.safeParse(" I built a tool. ").data).toBe("I built a tool.");
  });

  it("highlights only added and removed words", () => {
    const result = wordDiff("I build apps.", "I design apps.");
    expect(result.original.find((t) => t.text.trim() === "build")?.changed).toBe(true);
    expect(result.revised.find((t) => t.text.trim() === "design")?.changed).toBe(true);
    expect(result.revised.find((t) => t.text.trim() === "I")?.changed).toBe(false);
    expect(result.revised.map((t) => t.text).join("")).toBe("I design apps.");
  });

  it("provides three distinct empty Hinge prompts", () => {
    const pairs = emptyHingePairs();
    expect(pairs).toHaveLength(3);
    expect(new Set(pairs.map((p) => p.prompt)).size).toBe(3);
    expect(pairs.every((p) => p.answer === "")).toBe(true);
  });

  it("keeps dating and professional audience ids distinct", () => {
    const linkedin = PLATFORM_CONFIGS.linkedin.audiences.map((a) => a.id);
    expect(PLATFORM_CONFIGS.hinge.audiences.every((a) => !linkedin.includes(a.id))).toBe(true);
  });
});

describe("mergeFacts", () => {
  const fact = (id: string, text: string, confirmed: boolean, source: IdentityFact["source"] = "extracted"): IdentityFact => ({
    id,
    text,
    confirmed,
    source,
  });

  it("keeps confirmed and user facts, replaces unconfirmed suggestions", () => {
    const prev = [fact("f1", "I study CS.", true), fact("f2", "I like tea.", false), fact("u1", "I run.", false, "user")];
    const out = mergeFacts(prev, [fact("f1", "I make pancakes.", false)]);
    expect(out.map((f) => f.text)).toEqual(["I study CS.", "I run.", "I make pancakes."]);
  });

  it("renumbers colliding ids so every id stays unique", () => {
    const out = mergeFacts([fact("f1", "I study CS.", true)], [fact("f1", "I make pancakes.", false), fact("f2", "I hike.", false)]);
    expect(out.map((f) => f.id)).toEqual(["f1", "f2", "f3"]);
    expect(new Set(out.map((f) => f.id)).size).toBe(out.length);
  });

  it("drops incoming facts that repeat a kept one", () => {
    const out = mergeFacts([fact("f1", "I study CS.", true)], [fact("f1", " i study cs. ", false)]);
    expect(out).toHaveLength(1);
    expect(out[0].confirmed).toBe(true);
  });
});

describe("profileSectionList", () => {
  it("lists sections in LinkedIn order and marks the rewritable ones like rewritableSections does", () => {
    const list = profileSectionList(DEMO_LINKEDIN_PROFILE);
    expect(list[0]).toMatchObject({ key: "headline", label: "Headline" });
    expect(list.map((s) => s.key)).toContain("skills");
    const rewritable = rewritableSections(DEMO_LINKEDIN_PROFILE);
    expect(list.filter((s) => s.rewritable).map((s) => [s.key, s.label])).toEqual(rewritable.map((s) => [s.key, s.label]));
  });
});
