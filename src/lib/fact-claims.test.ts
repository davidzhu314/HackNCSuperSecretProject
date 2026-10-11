import { describe, expect, it } from "vitest";
import { checkFactClaims, factCheckView, relatedSources, type AiFactCheck } from "./fact-claims";
import { buildFactVerdict } from "./postprocess";
import type { Segment, VerifyFactResponse } from "./schemas";

const segments: Segment[] = [
  { id: "s1", text: "I helped organize the campus robotics club hackathon in 2023." },
  { id: "s2", text: "I taught a weekly Python workshop for 12 first-year students." },
  { id: "s3", text: "I improved page load time by 30% on the club website." },
];
const ctx = { segments, otherFacts: [{ id: "u1", text: "I play pickup soccer on weekends." }] };
const kinds = (text: string) => checkFactClaims(text, ctx).map((i) => i.kind);

describe("checkFactClaims", () => {
  it("passes facts that match the profile", () => {
    expect(checkFactClaims("I helped organize the robotics club hackathon in 2023.", ctx)).toEqual([]);
    expect(checkFactClaims("I taught a Python workshop for 12 students.", ctx)).toEqual([]);
  });

  it("passes new details the profile doesn't mention (not a lie, just unchecked)", () => {
    expect(checkFactClaims("I bake sourdough every Sunday.", ctx)).toEqual([]);
    expect(checkFactClaims("I ran a 10k in March.", ctx)).toEqual([]);
  });

  it("flags status superlatives", () => {
    expect(kinds("I am a world-class Python developer.")).toContain("superlative");
    expect(kinds("I'm the #1 hackathon organizer on campus.")).toContain("superlative");
    expect(kinds("I single-handedly built the club website.")).toContain("superlative");
  });

  it("doesn't flag playful everyday claims", () => {
    expect(checkFactClaims("I make the best tacos and always bring snacks.", ctx)).toEqual([]);
  });

  it("flags a count that differs from the related profile line", () => {
    const issues = checkFactClaims("I taught a weekly Python workshop for 40 first-year students.", ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "number_mismatch", text: "40", source: { id: "s2" } });
    expect(issues[0].explanation).toContain("12");
  });

  it("flags a percentage or year that differs, but not a different kind of number", () => {
    expect(kinds("I improved page load time by 80% on the club website.")).toEqual(["number_mismatch"]);
    expect(kinds("I helped organize the robotics club hackathon in 2021.")).toEqual(["number_mismatch"]);
    // A count next to a related line that only has a year can't contradict it.
    expect(kinds("I helped organize the robotics club hackathon with 3 friends.")).toEqual([]);
  });

  it("flags a stronger role than the related line describes", () => {
    const issues = checkFactClaims("I led the campus robotics club hackathon.", ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: "stronger_role", text: "led", source: { id: "s1" } });
    expect(issues[0].explanation).toContain("helped");
  });

  it("doesn't read titles like \"teaching assistant\" as a stronger verb", () => {
    const ta = { segments: [{ id: "s1", text: "Helped students in an intro programming course" }], otherFacts: [] };
    expect(checkFactClaims("I was a teaching assistant for an introductory programming course.", ta)).toEqual([]);
    expect(checkFactClaims("I was a founding member of the robotics club.", ctx)).toEqual([]);
    expect(checkFactClaims("I taught students in an intro programming course.", ta).map((i) => i.kind)).toEqual(["stronger_role"]);
  });

  it("allows the same role, or a weaker one", () => {
    expect(checkFactClaims("I contributed to the robotics club hackathon.", ctx)).toEqual([]);
    expect(checkFactClaims("I taught a Python workshop.", ctx)).toEqual([]);
  });

  it("checks against the user's other facts too", () => {
    expect(kinds("I play pickup soccer on weekends with 20 people.")).toEqual([]);
    const withCount = { segments: [], otherFacts: [{ id: "u1", text: "I play pickup soccer with 6 friends on weekends." }] };
    expect(checkFactClaims("I play pickup soccer with 15 friends on weekends.", withCount).map((i) => i.kind)).toEqual([
      "number_mismatch",
    ]);
  });

  it("ignores empty text", () => {
    expect(checkFactClaims("   ", ctx)).toEqual([]);
  });

  it("needs two shared words to call a line related", () => {
    expect(relatedSources("I led a soccer team.", segments)).toEqual([]);
    expect(relatedSources("I led the robotics club.", segments).map((s) => s.id)).toEqual(["s1"]);
  });
});

const live = (verdict: VerifyFactResponse["verdict"], extra: Partial<VerifyFactResponse> = {}): VerifyFactResponse => ({
  source: "live",
  verdict,
  reason: `reason for ${verdict}`,
  suggestion: "",
  evidence: [],
  warnings: [],
  ...extra,
});
const done = (text: string, result: VerifyFactResponse, basis = "b"): AiFactCheck => ({ text, basis, state: "done", result });

describe("factCheckView", () => {
  const text = "I bake sourdough.";

  it("is unverified and unchecked with no issues and no AI result", () => {
    expect(factCheckView(text, "b", [])).toMatchObject({ status: "unverified", label: "Not checked", checked: false });
  });

  it("is pending while the AI check runs", () => {
    expect(factCheckView(text, "b", [], { text, basis: "b", state: "pending" }).status).toBe("pending_check");
  });

  it("maps AI verdicts to states", () => {
    expect(factCheckView(text, "b", [], done(text, live("consistent"))).status).toBe("verified");
    expect(factCheckView(text, "b", [], done(text, live("not_mentioned")))).toMatchObject({
      status: "unverified",
      label: "Not in your profile",
      checked: true,
    });
    expect(factCheckView(text, "b", [], done(text, live("exaggerated")))).toMatchObject({
      status: "flagged",
      detail: "reason for exaggerated",
    });
    expect(factCheckView(text, "b", [], done(text, live("contradicts"))).label).toBe("Inconsistent");
  });

  it("never claims a fact is true", () => {
    const view = factCheckView(text, "b", [], done(text, live("consistent")));
    expect(view.detail).toMatch(/doesn't prove it's true/);
    expect(view.label.toLowerCase()).not.toContain("verified");
  });

  it("keeps rule-based flags even when the AI found nothing", () => {
    const issue = { kind: "superlative" as const, text: "world-class", explanation: "hard to back up" };
    expect(factCheckView(text, "b", [issue], done(text, live("consistent"))).status).toBe("flagged");
  });

  it("ignores an AI result for different text or a changed profile", () => {
    expect(factCheckView("I bake bread.", "b", [], done(text, live("exaggerated"))).status).toBe("unverified");
    expect(factCheckView(text, "new profile", [], done(text, live("exaggerated"))).status).toBe("unverified");
  });

  it("shows a failed check as unverified with the error", () => {
    const view = factCheckView(text, "b", [], { text, basis: "b", state: "error", message: "Couldn't reach the server." });
    expect(view).toMatchObject({ status: "unverified", label: "Check failed", error: "Couldn't reach the server.", checked: true });
  });
});

describe("buildFactVerdict", () => {
  const base = { factId: "u9", segments, otherFacts: [{ id: "u1", text: "I play pickup soccer on weekends." }] };

  it("resolves cited ids to the user's own text and flags unknown ones", () => {
    const out = buildFactVerdict(
      { verdict: "exaggerated", sourceIds: ["s1", "s1", "s99", "u9"], reason: " Your profile says helped. ", suggestion: "Say helped." },
      base,
    );
    expect(out.evidence).toEqual([{ id: "s1", text: segments[0].text }]);
    expect(out.warnings.map((w) => w.text)).toEqual(["s99"]);
    expect(out.reason).toBe("Your profile says helped.");
    expect(out.suggestion).toBe("Say helped.");
  });

  it("downgrades a contradiction or a vouch with no real evidence to not_mentioned", () => {
    for (const verdict of ["contradicts", "consistent"] as const) {
      const out = buildFactVerdict({ verdict, sourceIds: ["s99"], reason: "x", suggestion: "y" }, base);
      expect(out.verdict).toBe("not_mentioned");
      expect(out.suggestion).toBe("");
      expect(out.evidence).toEqual([]);
    }
  });

  it("allows an exaggeration flag without evidence (a superlative needs none)", () => {
    const out = buildFactVerdict({ verdict: "exaggerated", sourceIds: [], reason: "No one is #1 at everything.", suggestion: "" }, base);
    expect(out.verdict).toBe("exaggerated");
  });

  it("drops suggestions when nothing is flagged", () => {
    const out = buildFactVerdict({ verdict: "consistent", sourceIds: ["u1"], reason: "ok", suggestion: "change it" }, base);
    expect(out).toMatchObject({ verdict: "consistent", suggestion: "", evidence: [{ id: "u1" }] });
  });
});
