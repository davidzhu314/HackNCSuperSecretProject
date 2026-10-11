import { describe, expect, it } from "vitest";
import { findRepeatedPhrases } from "./profile-quality";

describe("findRepeatedPhrases", () => {
  it("flags exact repeated phrases across fields", () => {
    expect(findRepeatedPhrases([
      { key: "about", label: "About", text: "I build useful tools for local community groups." },
      { key: "entry", label: "Project", text: "I build useful tools for local community groups every month." },
    ]).some((item) => item.phrase === "i build useful tools for local community groups")).toBe(true);
  });
  it("does not flag short common overlaps", () => {
    expect(findRepeatedPhrases([
      { key: "one", label: "One", text: "I like building things." },
      { key: "two", label: "Two", text: "I like meeting people." },
    ])).toEqual([]);
  });
});
