import { describe, expect, it } from "vitest";
import { factsFor, platformsOf, recordFoundOn, seedHinge, seedLinkedIn, togglePlatform } from "./fact-platforms";
import { emptyHingePairs, MAX_HINGE_ANSWER } from "./persona-ui";
import { emptyLinkedInProfile } from "./profile";
import type { IdentityFact } from "./schemas";

const work: IdentityFact = { id: "f1", text: "I was a teaching assistant for intro programming.", confirmed: true, source: "extracted" };
const hobby: IdentityFact = { id: "u1", text: "I make pancakes on Sundays.", confirmed: true, source: "user" };
const unconfirmed: IdentityFact = { id: "f2", text: "I like hiking.", confirmed: false, source: "extracted" };

describe("fact platforms", () => {
  it("defaults: facts you typed are everywhere; found facts stay where they were found", () => {
    const map = recordFoundOn({}, [work, hobby], "linkedin");
    expect(platformsOf(work, map)).toEqual(["linkedin"]);
    expect(platformsOf(hobby, map)).toEqual(["linkedin", "hinge"]);
    // Existing choices are kept; `all` records every fact (demo facts).
    expect(recordFoundOn({ f1: ["hinge"] }, [work], "linkedin")).toEqual({ f1: ["hinge"] });
    expect(recordFoundOn({}, [hobby], "hinge", true)).toEqual({ u1: ["hinge"] });
  });

  it("toggling shares or unshares a fact with one platform", () => {
    let map = recordFoundOn({}, [work], "linkedin");
    map = togglePlatform(map, work, "hinge");
    expect(platformsOf(work, map)).toEqual(["linkedin", "hinge"]);
    map = togglePlatform(map, work, "linkedin");
    expect(platformsOf(work, map)).toEqual(["hinge"]);
  });

  it("only confirmed facts shared with a platform can be used there", () => {
    const map = recordFoundOn({}, [work, hobby, unconfirmed], "linkedin");
    expect(factsFor("linkedin", [work, hobby, unconfirmed], map).map((f) => f.id)).toEqual(["f1", "u1"]);
    expect(factsFor("hinge", [work, hobby, unconfirmed], map).map((f) => f.id)).toEqual(["u1"]);
  });
});

describe("start from my facts", () => {
  it("fills only empty Hinge answers, one fact each, within the answer limit", () => {
    const pairs = emptyHingePairs();
    pairs[1] = { ...pairs[1], answer: "My own words." };
    const long: IdentityFact = { ...hobby, id: "u2", text: "x".repeat(MAX_HINGE_ANSWER + 50) };
    const seeded = seedHinge(pairs, [hobby, long, work]);
    expect(seeded.map((p) => p.answer)).toEqual([hobby.text, "My own words.", "x".repeat(MAX_HINGE_ANSWER)]);
    expect(seeded.map((p) => p.prompt)).toEqual(pairs.map((p) => p.prompt));
    expect(seedHinge(pairs, [])).toEqual(pairs);
    // Using it again doesn't repeat a fact that's already an answer.
    const again = seedHinge([{ ...pairs[0], answer: hobby.text }, pairs[1], { ...pairs[2], answer: "" }], [hobby, work]);
    expect(again.map((p) => p.answer)).toEqual([hobby.text, "My own words.", work.text]);
  });

  it("fills an empty LinkedIn About and leaves a written one alone", () => {
    expect(seedLinkedIn(emptyLinkedInProfile(), [work, hobby]).about).toBe(`${work.text} ${hobby.text}`);
    const written = { ...emptyLinkedInProfile(), about: "Mine." };
    expect(seedLinkedIn(written, [work])).toBe(written);
  });
});
