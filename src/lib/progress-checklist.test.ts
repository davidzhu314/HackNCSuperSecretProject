import { describe, expect, it } from "vitest";
import { DEMO_LINKEDIN_PROFILE, DEMO_TINDER } from "./demo-data";
import { identityProgress, missingSummary } from "./progress-checklist";
import { emptyTinderProfile } from "./tinder";

const NONE = { linkedin: null, hinge: null, tinder: null, bios: {} };
const row = (r: ReturnType<typeof identityProgress>, p: string) => r.platforms.find((x) => x.platform === p)!;

describe("identityProgress", () => {
  it("lists all six platforms with nothing done for an empty session", () => {
    const r = identityProgress(NONE);
    expect(r.platforms.map((p) => p.platform)).toEqual(["linkedin", "handshake", "instagram", "github", "hinge", "tinder"]);
    expect(r.done).toBe(0);
    expect(r.total).toBe(r.platforms.reduce((n, p) => n + p.items.length, 0));
  });

  it("counts LinkedIn parts the demo has and the ones it lacks", () => {
    const li = row(identityProgress({ ...NONE, linkedin: DEMO_LINKEDIN_PROFILE }), "linkedin");
    expect(li.items.filter((i) => i.done).map((i) => i.label)).toEqual(["Headline", "About", "Experience", "Education", ...(DEMO_LINKEDIN_PROFILE.skills.length ? ["Skills"] : [])]);
  });

  it("counts a bio as done only within the platform's limit, and says so when it's over", () => {
    const ok = row(identityProgress({ ...NONE, bios: { instagram: "cs student" } }), "instagram");
    expect(ok.items).toEqual([{ label: "Bio", done: true }]);
    const long = row(identityProgress({ ...NONE, bios: { instagram: "a".repeat(151) } }), "instagram");
    expect(long.items).toEqual([{ label: "Bio under 150 characters", done: false }]);
  });

  it("summarizes what's missing, grouping prompt answers", () => {
    const tinder = row(identityProgress({ ...NONE, tinder: emptyTinderProfile() }), "tinder");
    expect(missingSummary(tinder.items)).toBe("3 prompt answers, About me, Job or school, Profile fields");
    expect(missingSummary([{ label: "Bio", done: true }])).toBe("");
  });

  it("counts Hinge answers and Tinder parts", () => {
    const hinge = row(identityProgress({ ...NONE, hinge: [{ prompt: "A perfect Sunday", answer: "Pancakes." }, { prompt: "x", answer: " " }] }), "hinge");
    expect(hinge.done).toBe(1);
    const tinder = row(identityProgress({ ...NONE, tinder: DEMO_TINDER }), "tinder");
    expect(tinder.items.filter((i) => !i.done).map((i) => i.label)).toEqual(["Prompt answer 3"]);
    const empty = row(identityProgress({ ...NONE, tinder: emptyTinderProfile() }), "tinder");
    expect(empty.done).toBe(0);
  });
});
