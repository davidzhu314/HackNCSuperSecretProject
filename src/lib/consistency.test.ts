import { describe, expect, it } from "vitest";
import { findContradictions, platformsWithText, type ProfileTexts } from "./consistency";
import { emptyLinkedInProfile } from "./profile";
import type { LinkedInProfile } from "./schemas";

// Synthetic people only.
function linkedin(): LinkedInProfile {
  return {
    ...emptyLinkedInProfile(),
    headline: "Computer science senior | Python and React",
    about: "Senior at Cedar Valley University. I like building tools people use.",
    experience: [
      { id: "exp1", title: "Software Engineering Intern", organization: "Tallowtree Analytics", dates: "June 2026 - Aug 2026", description: "" },
      { id: "exp2", title: "Teaching Assistant", organization: "Cedar Valley University", dates: "2025 - Present", description: "" },
    ],
    education: [{ id: "edu1", title: "B.S. Computer Science", organization: "Cedar Valley University", dates: "2023 - 2027", description: "" }],
  };
}

const topics = (p: ProfileTexts) => findContradictions(p).map((c) => c.topic).sort();

describe("findContradictions", () => {
  it("finds nothing when platforms agree", () => {
    const p: ProfileTexts = {
      linkedin: linkedin(),
      hinge: null,
      bios: { handshake: "CS senior at Cedar Valley University, class of 2027. Intern at Tallowtree Analytics." },
    };
    expect(findContradictions(p)).toEqual([]);
  });

  it("flags a different role, graduation year, year in school, and school", () => {
    const p: ProfileTexts = {
      linkedin: linkedin(),
      hinge: null,
      bios: {
        handshake: "Junior at Ridgeback State University, graduating in May 2026. Software engineer at Tallowtree Analytics.",
      },
    };
    expect(topics(p)).toEqual(["graduation", "role", "school", "year_in_school"]);
    const role = findContradictions(p).find((c) => c.topic === "role")!;
    expect(role.label).toBe("Your role at Tallowtree Analytics");
    expect(role.mentions.map((m) => m.platform).sort()).toEqual(["handshake", "linkedin"]);
  });

  it("flags different years of experience across bios", () => {
    const p: ProfileTexts = {
      linkedin: null,
      hinge: null,
      bios: { instagram: "3 years of experience shipping apps.", github: "5+ years experience in design." },
    };
    const c = findContradictions(p);
    expect(c.map((x) => x.topic)).toEqual(["experience"]);
    expect(c[0].mentions.map((m) => m.value).sort()).toEqual(["3", "5"]);
  });

  it("ignores disagreements within one platform", () => {
    const p: ProfileTexts = { linkedin: null, hinge: null, bios: { tinder: "Former junior, now a senior. Senior year!" } };
    expect(findContradictions(p)).toEqual([]);
  });

  it("treats titles that share a role word as compatible", () => {
    const p: ProfileTexts = {
      linkedin: linkedin(),
      hinge: [{ prompt: "I'm weirdly good at", answer: "Being a teaching assistant at Cedar Valley University." }],
      bios: {},
    };
    expect(findContradictions(p)).toEqual([]);
  });

  it("lists platforms with text", () => {
    expect(platformsWithText({ linkedin: linkedin(), hinge: null, bios: { tinder: "Hi there.", github: " " } })).toEqual([
      "linkedin",
      "tinder",
    ]);
  });
});
