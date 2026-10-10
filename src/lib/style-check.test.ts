import { describe, expect, it } from "vitest";
import { checkStyle, STYLE_BAN_PROMPT } from "./style-check";

const texts = (s: string) => checkStyle(s).map((w) => w.text.toLowerCase());

describe("checkStyle", () => {
  it("passes plain, specific writing", () => {
    expect(checkStyle("Computer science senior.\n\nI built a course-planning web app with Python and React.")).toEqual([]);
  });

  it("flags banned words in any form", () => {
    expect(texts("I leveraged Python to elevate the team's synergy.")).toEqual(
      expect.arrayContaining(["leveraged", "elevate", "synergy"]),
    );
    expect(texts("Delving into a multifaceted, game-changing landscape.")).toEqual(
      expect.arrayContaining(["delving", "multifaceted", "game-changing", "landscape"]),
    );
  });

  it("does not flag longer words that merely start with a banned word", () => {
    expect(checkStyle("Fosterville and Embarkment are place names")).toEqual([]);
  });

  it("flags banned phrases and templated endings, including curly apostrophes", () => {
    expect(texts("In today’s fast-paced world, it’s not just about code. What are your thoughts?")).toEqual([
      "in today's fast-paced",
      "it's not just about",
      "what are your thoughts",
    ]);
  });

  it("flags emoji bullets and too many emojis", () => {
    const w = texts("🚀 Shipped an app\n💡 Learned React\n🔥 Taught a course");
    expect(w).toContain("emoji bullet");
    expect(w).toContain("3 emojis");
    expect(checkStyle("Taught an intro course. 🙂")).toEqual([]);
  });

  it("lists every banned word in the prompt text", () => {
    for (const word of ["delve", "leverage", "synergy", "landscape", "dynamic"]) {
      expect(STYLE_BAN_PROMPT).toContain(word);
    }
  });
});
