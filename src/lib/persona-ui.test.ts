import { describe, expect, it } from "vitest";
import { emptyHingePairs, factTextSchema, wordDiff } from "./persona-ui";
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
