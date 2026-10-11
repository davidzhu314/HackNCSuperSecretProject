import type { AudienceCritique, EvaluateResponse, Rating } from "./schemas";

// Audience questions answered: the comparison between your text and a rewrite, in real counts.
// One "question" is one lens x one question (e.g. Technical recruiter x "Can they tell what you do?").
// It counts as answered when that lens rates it Moderate or Strong: the reader can tell from your text.
// No points or averages: ratings are words, and turning them into numbers would invent precision.
// Each rating is one AI read, so a single flip can be noise; the UI shows the reason behind each one.

const ANSWERED: Rating[] = ["moderate", "strong"];
const RANK: Record<Rating, number> = { not_evident: 0, weak: 1, moderate: 2, strong: 3 };

export const isAnswered = (rating: Rating) => ANSWERED.includes(rating);

const key = (audience: string, trait: string) => `${audience}|${trait}`;

function cells(response: EvaluateResponse, audiences: string[], traits: string[]): Map<string, AudienceCritique> {
  const out = new Map<string, AudienceCritique>();
  for (const c of response.critiques) {
    if (audiences.includes(c.audience) && traits.includes(c.trait)) out.set(key(c.audience, c.trait), c);
  }
  return out;
}

export type QuestionCount = { trait: string; answered: number; total: number; answeredBy: string[] };

export type Coverage = { answered: number; total: number; byTrait: QuestionCount[] };

/** How many audience questions this text answers, overall and per question. Unrated cells are left out. */
export function coverage(response: EvaluateResponse, audiences: string[], traits: string[]): Coverage {
  const rated = cells(response, audiences, traits);
  return summarize(rated, [...rated.keys()], audiences, traits);
}

function summarize(rated: Map<string, AudienceCritique>, keys: string[], audiences: string[], traits: string[]): Coverage {
  const inScope = new Set(keys);
  const byTrait = traits.map((trait) => {
    const lenses = audiences.filter((a) => inScope.has(key(a, trait)));
    const answeredBy = lenses.filter((a) => isAnswered(rated.get(key(a, trait))!.rating));
    return { trait, answered: answeredBy.length, total: lenses.length, answeredBy };
  });
  return {
    answered: byTrait.reduce((n, t) => n + t.answered, 0),
    total: byTrait.reduce((n, t) => n + t.total, 0),
    byTrait,
  };
}

export type CellChange = {
  audience: string;
  trait: string;
  before: AudienceCritique;
  after: AudienceCritique;
};

export type AnsweredComparison = {
  /** Both sides counted over the same cells (rated in both), so the totals match. */
  before: Coverage;
  after: Coverage;
  /** Not answered before, answered now. */
  gained: CellChange[];
  /** Answered before, not now: what this version would cost you. */
  lost: CellChange[];
  /** Still answered, but rated higher (Moderate to Strong) or lower. */
  clearer: CellChange[];
  weaker: CellChange[];
  /** Not answered by this version; each has the lens's suggestion for what would help. */
  open: AudienceCritique[];
  verdict: "better" | "worse" | "mixed" | "same";
};

/** Compare the original's ratings with a rewrite's, cell by cell, for the selected lenses and questions. */
export function compareAnswered(
  original: EvaluateResponse,
  rewrite: EvaluateResponse,
  audiences: string[],
  traits: string[],
): AnsweredComparison {
  const a = cells(original, audiences, traits);
  const b = cells(rewrite, audiences, traits);
  // Only cells both reads rated: a cell the model skipped on one side says nothing about the change.
  const both = [...a.keys()].filter((k) => b.has(k));
  const gained: CellChange[] = [];
  const lost: CellChange[] = [];
  const clearer: CellChange[] = [];
  const weaker: CellChange[] = [];
  for (const k of both) {
    const before = a.get(k)!;
    const after = b.get(k)!;
    const change = { audience: after.audience, trait: after.trait, before, after };
    const was = isAnswered(before.rating);
    const now = isAnswered(after.rating);
    if (!was && now) gained.push(change);
    else if (was && !now) lost.push(change);
    else if (RANK[after.rating] > RANK[before.rating]) clearer.push(change);
    else if (RANK[after.rating] < RANK[before.rating]) weaker.push(change);
  }
  const open = both.map((k) => b.get(k)!).filter((c) => !isAnswered(c.rating));
  const verdict = gained.length && lost.length ? "mixed" : gained.length ? "better" : lost.length ? "worse" : "same";
  return {
    before: summarize(a, both, audiences, traits),
    after: summarize(b, both, audiences, traits),
    gained,
    lost,
    clearer,
    weaker,
    open,
    verdict,
  };
}

/** One line for the rewrite card, e.g. "Answers 7 of 9 audience questions (was 5): +2". */
export function comparisonSummary(c: AnsweredComparison): string {
  if (!c.after.total) return "The audiences couldn't be compared for this version.";
  const base = `Answers ${c.after.answered} of ${c.after.total} audience questions (was ${c.before.answered})`;
  if (c.verdict === "better") return `${base}: ${c.gained.length} more answered.`;
  if (c.verdict === "worse") return `${base}: ${c.lost.length} no longer answered.`;
  if (c.verdict === "mixed") return `${base}: ${c.gained.length} gained, ${c.lost.length} lost.`;
  if (c.clearer.length && !c.weaker.length) return `${base}. Same questions answered, ${c.clearer.length} more clearly.`;
  return `${base}. Same questions answered.`;
}

/** The "use" button's label: says what this version changes, so the choice is informed. */
export function applyLabel(c: AnsweredComparison | null, hasWarnings: boolean): string {
  if (c?.verdict === "better") return `Use this version (+${c.gained.length} answered)`;
  if (c?.verdict === "worse" || c?.verdict === "mixed") return `Use anyway (${c.lost.length} lost)`;
  return hasWarnings ? "Use anyway" : "Use this version";
}
