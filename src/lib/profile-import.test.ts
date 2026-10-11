import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_PROFILE } from "./demo-data";
import { cleanProfile, profileFromText } from "./profile-import";

describe("profileFromText", () => {
  it("splits plain text into headline and About, with a warning", () => {
    const r = profileFromText("me.txt", "CS senior | Python\nI build tools.\nI like teaching.");
    expect(r.profile.headline).toBe("CS senior | Python");
    expect(r.profile.about).toBe("I build tools.\nI like teaching.");
    expect(r.profile.experience).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });

  it("accepts a full profile as JSON", () => {
    const r = profileFromText("p.json", JSON.stringify(DEMO_LINKEDIN_PROFILE));
    expect(r.profile).toEqual(DEMO_LINKEDIN_PROFILE);
    expect(r.warnings).toEqual([]);
  });

  it("accepts {headline, about} JSON and rejects unreadable JSON", () => {
    expect(profileFromText("p.json", '{"headline":"H","about":"A"}').profile).toMatchObject({ headline: "H", about: "A" });
    expect(() => profileFromText("p.json", "{nope")).toThrow();
    expect(() => profileFromText("p.json", '{"other":1}')).toThrow();
  });

  it("cuts an overlong headline to LinkedIn's limit and says so", () => {
    const r = profileFromText("p.json", JSON.stringify({ headline: "x".repeat(300), about: "A" }));
    expect(r.profile.headline).toHaveLength(220);
    expect(r.warnings.some((w) => w.includes("headline"))).toBe(true);
  });
});

describe("cleanProfile", () => {
  it("drops blank skill lines left by editing", () => {
    expect(cleanProfile({ ...DEMO_LINKEDIN_PROFILE, skills: ["Python", "", " React ", "  "] }).skills).toEqual(["Python", "React"]);
  });
});
