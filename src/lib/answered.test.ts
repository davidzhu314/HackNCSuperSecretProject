import { describe, expect, it } from "vitest";
import { compareAnswered, comparisonSummary, coverage, applyLabel, groupOpen, verdictLine } from "./answered";
import type { AudienceCritique, EvaluateResponse, Rating } from "./schemas";

const c = (audience: string, trait: string, rating: Rating, extra: Partial<AudienceCritique> = {}): AudienceCritique => ({
  audience,
  trait,
  rating,
  segmentIds: [],
  missingEvidence: false,
  rationale: `${audience} on ${trait}: ${rating}`,
  suggestion: `fix ${trait}`,
  ...extra,
});
const resp = (...critiques: AudienceCritique[]): EvaluateResponse => ({ source: "live", critiques, warnings: [] });

const audiences = ["recruiter", "manager"];
const traits = ["clarity", "evidence"];

describe("coverage", () => {
  it("counts lens x question cells rated Moderate or Strong", () => {
    const cov = coverage(
      resp(c("recruiter", "clarity", "strong"), c("manager", "clarity", "weak"), c("recruiter", "evidence", "moderate"), c("manager", "evidence", "not_evident")),
      audiences,
      traits,
    );
    expect(cov).toMatchObject({ answered: 2, total: 4 });
    expect(cov.byTrait[0]).toEqual({ trait: "clarity", answered: 1, total: 2, answeredBy: ["recruiter"] });
  });

  it("ignores unselected lenses and questions, and leaves unrated cells out of the total", () => {
    const cov = coverage(resp(c("recruiter", "clarity", "strong"), c("other", "clarity", "strong"), c("recruiter", "tone", "strong")), audiences, traits);
    expect(cov).toMatchObject({ answered: 1, total: 1 });
  });
});

describe("compareAnswered", () => {
  const before = resp(
    c("recruiter", "clarity", "weak"),
    c("manager", "clarity", "moderate"),
    c("recruiter", "evidence", "moderate"),
    c("manager", "evidence", "not_evident"),
  );

  it("lists gains with the lens's new reason", () => {
    const after = resp(
      c("recruiter", "clarity", "strong", { rationale: "Now says the role." }),
      c("manager", "clarity", "moderate"),
      c("recruiter", "evidence", "moderate"),
      c("manager", "evidence", "weak"),
    );
    const cmp = compareAnswered(before, after, audiences, traits);
    expect(cmp.verdict).toBe("better");
    expect(cmp.before.answered).toBe(2);
    expect(cmp.after.answered).toBe(3);
    expect(cmp.gained.map((g) => [g.audience, g.trait, g.after.rationale])).toEqual([["recruiter", "clarity", "Now says the role."]]);
    expect(cmp.lost).toEqual([]);
    // Not evident -> Weak is a better rating but still not answered: it stays open, not a gain.
    expect(cmp.open.map((o) => o.audience + "|" + o.trait)).toEqual(["manager|evidence"]);
  });

  it("reports losses, so a rewrite that trades one answer for another reads as mixed", () => {
    const after = resp(
      c("recruiter", "clarity", "moderate"),
      c("manager", "clarity", "weak"),
      c("recruiter", "evidence", "moderate"),
      c("manager", "evidence", "not_evident"),
    );
    const cmp = compareAnswered(before, after, audiences, traits);
    expect(cmp.verdict).toBe("mixed");
    expect(cmp.gained).toHaveLength(1);
    expect(cmp.lost.map((l) => l.audience)).toEqual(["manager"]);
    expect(comparisonSummary(cmp)).toBe("Answers 2 of 4 audience questions (was 2): 1 gained, 1 lost.");
    expect(applyLabel(cmp, false)).toBe("Use anyway (1 lost)");
  });

  it("separates clearer answers from new ones", () => {
    const after = resp(
      c("recruiter", "clarity", "weak"),
      c("manager", "clarity", "strong"),
      c("recruiter", "evidence", "moderate"),
      c("manager", "evidence", "not_evident"),
    );
    const cmp = compareAnswered(before, after, audiences, traits);
    expect(cmp.verdict).toBe("same");
    expect(cmp.clearer.map((x) => x.audience)).toEqual(["manager"]);
    expect(comparisonSummary(cmp)).toBe("Answers 2 of 4 audience questions (was 2). Same questions answered, 1 more clearly.");
  });

  it("only compares cells both reads rated", () => {
    const after = resp(c("recruiter", "clarity", "strong"));
    const cmp = compareAnswered(before, after, audiences, traits);
    expect(cmp.before.total).toBe(1);
    expect(cmp.after.total).toBe(1);
    expect(cmp.gained).toHaveLength(1);
  });

  it("says when nothing could be compared", () => {
    const cmp = compareAnswered(before, resp(), audiences, traits);
    expect(comparisonSummary(cmp)).toMatch(/couldn't be compared/);
  });
});

describe("applyLabel", () => {
  it("names the gain, the loss, or falls back to the FactCheck wording", () => {
    const better = compareAnswered(resp(c("recruiter", "clarity", "weak")), resp(c("recruiter", "clarity", "strong")), audiences, traits);
    expect(applyLabel(better, true)).toBe("Use this version (+1 answered)");
    expect(applyLabel(null, true)).toBe("Use anyway");
    expect(applyLabel(null, false)).toBe("Use this version");
  });
});

describe("groupOpen", () => {
  it("groups one question's lenses into one item and drops duplicate suggestions", () => {
    const original = resp(c("recruiter", "clarity", "weak", { suggestion: "Add who you share it with." }), c("manager", "clarity", "weak", { suggestion: "add who you share it with" }));
    const rewrite = resp(c("recruiter", "clarity", "weak", { suggestion: "Add who you share it with." }), c("manager", "clarity", "not_evident", { suggestion: "Add who you share it with!" }));
    const cmp = compareAnswered(original, rewrite, audiences, ["clarity"]);
    const [q, ...rest] = groupOpen(cmp.open, ["clarity"], cmp);
    expect(rest).toEqual([]);
    expect(q.audiences).toEqual(["recruiter", "manager"]);
    expect(q.suggestions).toEqual(["Add who you share it with."]);
    expect(q.needsDetail).toBe(true);
  });

  it("doesn't call a question lost by the rewrite one that needs a new detail", () => {
    const cmp = compareAnswered(resp(c("recruiter", "clarity", "strong")), resp(c("recruiter", "clarity", "weak")), ["recruiter"], ["clarity"]);
    expect(groupOpen(cmp.open, ["clarity"], cmp)[0].needsDetail).toBe(false);
  });

  it("without a rewrite read, nothing is marked as needing a detail", () => {
    const open = [c("recruiter", "evidence", "weak")];
    expect(groupOpen(open, traits, null)).toEqual([{ trait: "evidence", audiences: ["recruiter"], suggestions: ["fix evidence"], needsDetail: false }]);
  });
});

describe("verdictLine", () => {
  it("says what changed in one line", () => {
    const same = compareAnswered(resp(c("recruiter", "clarity", "moderate")), resp(c("recruiter", "clarity", "strong")), ["recruiter"], ["clarity"]);
    expect(verdictLine(same)).toBe("Same questions answered as your text · 1 clearer");
    const better = compareAnswered(resp(c("recruiter", "clarity", "weak")), resp(c("recruiter", "clarity", "moderate")), ["recruiter"], ["clarity"]);
    expect(verdictLine(better)).toBe("1 more answered");
  });
});
