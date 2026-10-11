import { describe, expect, it } from "vitest";
import { bigramOverlap, formatOf, lengthInstruction, lengthIssue, styleIssues, targetChars, STYLE_ORDER, STYLES, styleContrast } from "./styles";

describe("formats", () => {
  it("maps LinkedIn sections to formats", () => {
    expect(formatOf("headline", "x")).toBe("line");
    expect(formatOf("about", "x")).toBe("paragraphs");
    expect(formatOf("experience", "- a\n- b")).toBe("bullets");
    expect(formatOf("volunteering", "A paragraph.")).toBe("paragraph");
  });
});

describe("length targets", () => {
  it("scale with the original and stay within LinkedIn's limits", () => {
    expect(targetChars("experience", 400, "much_shorter")).toBe(200);
    expect(targetChars("experience", 400, "same")).toBe(400);
    expect(targetChars("experience", 400, "much_longer")).toBe(600);
    expect(targetChars("about", 1000, "much_longer")).toBe(2000);
    expect(targetChars("about", 2000, "much_longer")).toBe(2600); // capped
    expect(targetChars("headline", 150, "much_longer")).toBe(220); // capped
  });

  it("let headline and About grow more than an entry (they may draw on the whole profile)", () => {
    expect(targetChars("about", 400, "longer")).toBeGreaterThan(targetChars("experience", 400, "longer"));
  });

  it("don't shrink a very short original below itself", () => {
    expect(targetChars("headline", 18, "much_shorter")).toBe(18);
  });

  it("tell the model to grow without new facts and to keep the bullet count", () => {
    const longer = lengthInstruction({ original: 400, target: 600, step: "much_longer", format: "bullets", bullets: 3 });
    expect(longer).toMatch(/Never add facts/);
    expect(longer).toMatch(/Keep 3 bullets or fewer/);
    expect(lengthInstruction({ original: 400, target: 200, step: "much_shorter", format: "paragraph", bullets: 0 })).toMatch(/shorter/);
  });
});

describe("style definitions", () => {
  it("has three styles, each told what the other two are", () => {
    expect(STYLE_ORDER).toEqual(["direct", "narrative", "professional"]);
    for (const s of STYLE_ORDER) {
      const others = STYLE_ORDER.filter((o) => o !== s).map((o) => STYLES[o].label);
      for (const o of others) expect(styleContrast(s)).toContain(o);
    }
  });
});

describe("styleIssues", () => {
  it("flags first person, contractions, and '!' in Professional, but not possessives", () => {
    expect(styleIssues("professional", "- Led my team's launch", "bullets")).toEqual(["uses first person (I, my, we…)"]);
    expect(styleIssues("professional", "Doesn't stop!", "paragraph")).toEqual(["uses contractions", "uses an exclamation mark"]);
    expect(styleIssues("professional", "- Wrote the team's report", "bullets")).toEqual([]);
  });

  it("flags 'I' in Direct bullets but allows it in Direct paragraphs", () => {
    expect(styleIssues("direct", "- I wrote scripts", "bullets")).toHaveLength(1);
    expect(styleIssues("direct", "I build controllers.", "paragraphs")).toEqual([]);
  });

  it("requires first person in a Narrative About", () => {
    expect(styleIssues("narrative", "Engineer who builds rovers.", "paragraphs")).toHaveLength(1);
    expect(styleIssues("narrative", "I build rovers.", "paragraphs")).toEqual([]);
  });
});

describe("bigramOverlap", () => {
  it("is 1 for identical text and 0 for unrelated text", () => {
    expect(bigramOverlap("built a web app", "built a web app")).toBe(1);
    expect(bigramOverlap("built a web app", "tuned rover loops")).toBe(0);
  });
});

describe("lengthIssue", () => {
  it("is null for 'same' and for results close enough", () => {
    expect(lengthIssue({ step: "same", original: 400, target: 400, actual: 900 })).toBeNull();
    expect(lengthIssue({ step: "shorter", original: 400, target: 300, actual: 340 })).toBeNull();
    expect(lengthIssue({ step: "longer", original: 400, target: 500, actual: 450 })).toBeNull();
  });

  it("asks a 'shorter' result that didn't shrink to cut down", () => {
    expect(lengthIssue({ step: "shorter", original: 460, target: 345, actual: 458 })).toMatch(/458 characters but the target is about 345/);
  });

  it("asks a 'longer' result that didn't grow to lengthen without new facts", () => {
    expect(lengthIssue({ step: "much_longer", original: 460, target: 690, actual: 461 })).toMatch(/no new facts/);
  });
});
