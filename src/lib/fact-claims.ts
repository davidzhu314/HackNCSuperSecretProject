import { contentStems, extractNumbers, stem, verbsIn, type NumberMention } from "./fact-guard";
import type { FactVerdict, Segment, VerifyFactResponse } from "./schemas";

// Lie Checker: is a fact the user typed consistent with their own profile and other facts?
// Two layers. This file is the deterministic one (no model calls, runs as they type): it catches
// status superlatives, numbers that differ from a related line in the profile, and a stronger role
// verb than the related line uses. The AI layer (/api/facts/verify) adds plausibility and wording
// the rules can't see. Neither can know what's true: a clean result means "nothing inconsistent
// found", never "verified true". A fact the profile doesn't mention is fine; it's simply unchecked.

export type FactIssueKind = "superlative" | "number_mismatch" | "stronger_role";

export type FactIssue = {
  kind: FactIssueKind;
  /** The words in the fact that raised the flag. */
  text: string;
  explanation: string;
  /** The profile line or other fact it was compared with, when there is one. */
  source?: { id: string; text: string };
};

/** A line the fact is compared against: a profile segment or another fact. */
export type ClaimSource = { id: string; text: string };

// Status claims that readers can't take at face value. Kept to unambiguous ones: "always", "every",
// and "the best tacos" are normal on a dating profile and aren't flagged.
const SUPERLATIVES: RegExp[] = [
  /\bworld[- ]class\b/i,
  /\bworld['’]?s (?:best|greatest|top|leading)\b/i,
  /\bbest in the (?:world|country|industry|state|company)\b/i,
  /\bworld[- ]renowned\b/i,
  /\binternationally (?:renowned|famous|recognized)\b/i,
  /#\s?1\b/,
  /\bnumber one\b/i,
  /\btop (?:1|one) ?(?:%|percent)\b/i,
  /\b(?:unmatched|unparalleled|unrivaled|unrivalled|legendary)\b/i,
  /\b(?:genius|rock ?star|ninja|guru)\b/i,
  /\bsingle[- ]?handedly\b/i,
  /\bnever (?:failed|lost|missed)\b/i,
  /\bexpert in (?:everything|all|every)\b/i,
  /\bfluent in (?:every|all)\b/i,
];

function checkSuperlatives(fact: string): FactIssue[] {
  const issues: FactIssue[] = [];
  for (const re of SUPERLATIVES) {
    const m = fact.match(re);
    if (m) {
      issues.push({
        kind: "superlative",
        text: m[0],
        explanation: `"${m[0]}" is hard for anyone to back up. If it's a joke, fine; readers may take it literally.`,
      });
    }
  }
  return issues;
}

/** Stems the fact shares with a source, ignoring numbers and role verbs (those are what we compare). */
function sharedStems(fact: string, source: string): number {
  const verbs = [...verbsIn(fact, true).values(), ...verbsIn(source, true).values()];
  const ignore = new Set(verbs.flatMap((v) => [v.lemma, ...v.forms].map(stem)));
  const theirs = new Set(contentStems(source).filter((s) => !ignore.has(s)));
  return new Set(contentStems(fact).filter((s) => !ignore.has(s) && theirs.has(s))).size;
}

/** Sources that talk about the same thing as the fact (two or more shared content words). */
export function relatedSources(fact: string, sources: ClaimSource[]): ClaimSource[] {
  return sources.filter((s) => sharedStems(fact, s.text) >= 2);
}

type NumberShape = "percent" | "year" | "count";

function shapeOf(n: NumberMention): NumberShape {
  if (n.key.endsWith("%")) return "percent";
  const v = Number(n.key);
  return Number.isInteger(v) && v >= 1900 && v <= 2100 && /^\d{4}$/.test(n.text) ? "year" : "count";
}

function checkNumbers(fact: string, related: ClaimSource[], all: ClaimSource[]): FactIssue[] {
  const supported = new Set(all.flatMap((s) => extractNumbers(s.text).map((n) => n.key)));
  const issues: FactIssue[] = [];
  for (const n of extractNumbers(fact)) {
    if (supported.has(n.key)) continue;
    const shape = shapeOf(n);
    // Only a related line with a number of the same kind can contradict this one.
    const clash = related.find((s) => extractNumbers(s.text).some((m) => shapeOf(m) === shape));
    if (!clash) continue;
    const theirs = extractNumbers(clash.text).find((m) => shapeOf(m) === shape)!;
    issues.push({
      kind: "number_mismatch",
      text: n.text,
      explanation: `Your own words say "${theirs.text}" about this; this fact says "${n.text}".`,
      source: clash,
    });
  }
  return issues;
}

function checkRole(fact: string, related: ClaimSource[]): FactIssue[] {
  const issues: FactIssue[] = [];
  for (const [lemma, verb] of verbsIn(fact)) {
    if (verb.rank < 2) continue;
    // Only past-tense claims count. "-ing" forms are usually titles or descriptions in a fact
    // ("teaching assistant", "founding member", "managing editor"), not a stronger verb.
    const pastForms = verb.forms.filter((f) => !f.endsWith("ing"));
    const pastRe = new RegExp(`\\b(${pastForms.join("|")})\\b`, "i");
    if (!pastRe.test(fact)) continue;
    for (const s of related) {
      const theirs = verbsIn(s.text, true);
      if (!theirs.size || theirs.has(lemma)) continue;
      const strongest = [...theirs.values()].reduce((a, b) => (b.rank > a.rank ? b : a));
      if (strongest.rank >= verb.rank) continue;
      const shown = fact.toLowerCase().match(pastRe)?.[1] ?? lemma;
      issues.push({
        kind: "stronger_role",
        text: shown,
        explanation: `Your own words describe this as "${strongest.forms[0]}"; "${shown}" claims a bigger role.`,
        source: s,
      });
      break;
    }
  }
  return issues;
}

/**
 * Deterministic checks for one fact against the profile segments and the user's other facts.
 * An empty result means nothing inconsistent was found, not that the fact is true.
 */
export function checkFactClaims(fact: string, ctx: { segments: Segment[]; otherFacts: ClaimSource[] }): FactIssue[] {
  const text = fact.trim();
  if (!text) return [];
  const all: ClaimSource[] = [
    ...ctx.segments.map((s) => ({ id: s.id, text: s.prompt ? `${s.prompt}: ${s.text}` : s.text })),
    ...ctx.otherFacts.filter((f) => f.text.trim()),
  ];
  const related = relatedSources(text, all);
  return [...checkSuperlatives(text), ...checkNumbers(text, related, all), ...checkRole(text, related)];
}

// ---------- combined status (deterministic + AI) ----------

export type FactCheckStatus = "verified" | "unverified" | "pending_check" | "flagged";

/** One AI check, remembered with the exact fact text and profile it was run against. */
export type AiFactCheck =
  | { text: string; basis: string; state: "pending" }
  | { text: string; basis: string; state: "done"; result: VerifyFactResponse }
  | { text: string; basis: string; state: "error"; message: string };

export type FactCheckView = {
  status: FactCheckStatus;
  /** Short label for the badge. */
  label: string;
  /** Why: one or two sentences shown under the fact. */
  detail: string;
  issues: FactIssue[];
  /** The AI result for the current text, if any. */
  ai?: VerifyFactResponse;
  error?: string;
  /** False until an AI check has run (or failed) for the current text. */
  checked: boolean;
};

const FLAG_VERDICTS: FactVerdict[] = ["exaggerated", "contradicts"];

/**
 * What to show for a fact. Deterministic issues always flag, even if the AI was fine with it:
 * the rules are the part we trust. An AI result only counts for the exact text and profile it saw.
 */
export function factCheckView(text: string, basis: string, issues: FactIssue[], ai?: AiFactCheck): FactCheckView {
  const current = ai && ai.text === text.trim() && ai.basis === basis ? ai : undefined;
  if (current?.state === "pending") {
    return { status: "pending_check", label: "Checking…", detail: "Comparing with your profile and other facts.", issues, checked: false };
  }
  const result = current?.state === "done" ? current.result : undefined;
  const error = current?.state === "error" ? current.message : undefined;
  const checked = !!current;
  if (issues.length || (result && FLAG_VERDICTS.includes(result.verdict))) {
    const aiFlag = result && FLAG_VERDICTS.includes(result.verdict);
    return {
      status: "flagged",
      label: result?.verdict === "contradicts" || issues.some((i) => i.kind === "number_mismatch") ? "Inconsistent" : "Possibly exaggerated",
      detail: aiFlag ? result.reason : issues[0].explanation,
      issues,
      ai: result,
      error,
      checked,
    };
  }
  if (result?.verdict === "consistent") {
    return {
      status: "verified",
      label: "Consistent",
      detail: "Nothing in your profile or other facts contradicts this. That doesn't prove it's true; only you know that.",
      issues,
      ai: result,
      checked,
    };
  }
  return {
    status: "unverified",
    label: error ? "Check failed" : result ? "Not in your profile" : "Not checked",
    detail: error
      ? error
      : result
        ? "Your profile doesn't mention this, so it couldn't be checked. That's fine if it's true."
        : "Not checked against your profile yet.",
    issues,
    ai: result,
    error,
    checked,
  };
}
