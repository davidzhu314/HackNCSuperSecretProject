import { LIMITS, type LengthStep, type LinkedInSectionKind, type SectionStyle } from "./schemas";

// Rewrite styles and lengths, defined by output FORMAT (one line, paragraphs, bullets, a paragraph)
// rather than by LinkedIn field, so other professional platforms can reuse them by mapping their
// fields to a format. Each style is written to contrast with the other two; `styleIssues` checks
// the parts of that contrast that can be checked deterministically.

export type TextFormat = "line" | "paragraphs" | "bullets" | "paragraph";

/** LinkedIn section -> format. Entries keep bullets if the original has them. */
export function formatOf(kind: LinkedInSectionKind, originalText: string): TextFormat {
  if (kind === "headline") return "line";
  if (kind === "about") return "paragraphs";
  return countBullets(originalText) > 0 ? "bullets" : "paragraph";
}

const BULLET_LINE = /^\s*[-•·*–]\s+/;
export const countBullets = (text: string) => text.split("\n").filter((l) => BULLET_LINE.test(l)).length;

type StyleSpec = {
  label: string;
  /** One line for the UI. */
  summary: string;
  /** Rules for every format. */
  rules: string;
  /** Extra rules per format. */
  format: Record<TextFormat, string>;
};

export const STYLES: Record<SectionStyle, StyleSpec> = {
  direct: {
    label: "Direct",
    summary: "Bare facts, fewest words.",
    rules:
      "Plain and simple: everyday words (use, help, make, run; never leverage, facilitate, spearhead) in short simple sentences of one clause each. Split a long sentence into two short ones instead of joining clauses with commas, semicolons, or '-ing' add-ons. No adjectives or adverbs unless they carry a fact. No framing, transitions, reasons, or motivations.",
    format: {
      line: "Role or field first, then the most concrete specifics (tools, focus), separated by ' | '.",
      paragraphs:
        "2-4 very short paragraphs of short declarative sentences. 'I' is allowed only as a plain subject ('I build…'); no reflection or feelings.",
      bullets: "Each bullet: one or two short plain sentences, verb first, no 'I'. No add-ons like ', enabling…' or ', resulting in…'.",
      paragraph: "Short declarative sentences, no 'I', no connecting clauses.",
    },
  },
  narrative: {
    label: "Narrative",
    summary: "First person, conversational, connects the dots.",
    rules:
      "Personal and conversational: first person, contractions welcome, varied sentence length. Connect the facts with how and why, but only with reasons and links the sources actually state. It should read like the person talking about their work.",
    format: {
      line: "A short, natural phrase in the person's own voice. No ' | ' separators.",
      paragraphs:
        "A short arc in first person: where the person is now, what they've done, what they care about. Use 'I' and 'my'.",
      bullets:
        "Bullets read as natural sentences: what was done plus the context or purpose the sources give, joined with words like 'to', 'so', 'while', 'which'. 'I' is allowed but don't start every bullet with it.",
      paragraph: "Natural first-person sentences that connect what was done to its context.",
    },
  },
  professional: {
    label: "Professional",
    summary: "Polished résumé register, no first person.",
    rules:
      "Polished, formal résumé register. No first person at all (no I, me, my, we, our), no contractions, no exclamation marks, no casual words. Each bullet or sentence is one well-connected sentence: join related facts with participial or prepositional phrases and semicolons rather than separate short sentences. Formal vocabulary where it stays accurate (conducted, developed, coordinated), never a stronger claim than the sources. Parallel structure; past tense for completed work.",
    format: {
      line: "Title-style noun phrases (role, focus areas, credentials) separated by ' | '. No verbs, no first person.",
      paragraphs:
        "A compact profile summary in implied-subject sentences (e.g. 'Data analyst focused on…'), never 'I'. 2-3 paragraphs: profile, experience highlights, areas of interest.",
      bullets:
        "Each bullet: an accurate action verb (never stronger than the sources), then scope, then the result if the source states one. Same grammatical pattern in every bullet.",
      paragraph: "Formal implied-subject sentences, no first person, consistent tense.",
    },
  },
};

export const STYLE_ORDER: SectionStyle[] = ["direct", "narrative", "professional"];

/** How the prompt keeps the three apart: each call is told what the other two are. */
export function styleContrast(style: SectionStyle): string {
  const others = STYLE_ORDER.filter((s) => s !== style)
    .map((s) => `${STYLES[s].label} (${STYLES[s].summary.replace(/\.$/, "")})`)
    .join(" and ");
  return `There are three styles, and each must read clearly differently from the others. You are writing the ${STYLES[style].label} version; it must not read like ${others}.`;
}

// ---------- length ----------

export const LENGTH_STEPS: { id: LengthStep; label: string }[] = [
  { id: "much_shorter", label: "Much shorter" },
  { id: "shorter", label: "Shorter" },
  { id: "same", label: "Same length" },
  { id: "longer", label: "Longer" },
  { id: "much_longer", label: "Much longer" },
];

// Headline and About may draw on the whole profile, so they can grow more than an entry,
// which may only explain its own text.
const RATIOS: Record<"wide" | "entry", Record<LengthStep, number>> = {
  wide: { much_shorter: 0.5, shorter: 0.75, same: 1, longer: 1.5, much_longer: 2 },
  entry: { much_shorter: 0.5, shorter: 0.75, same: 1, longer: 1.25, much_longer: 1.5 },
};

export function sectionCap(kind: LinkedInSectionKind): number {
  if (kind === "headline" || kind === "about") return LIMITS.sectionRewriteChars[kind];
  return LIMITS.sectionRewriteChars.entry;
}

/**
 * Headline and About measure from at least a usual length: a 21-character headline at "same"
 * would otherwise just echo itself, though the headline may draw on the whole profile.
 */
const USUAL_CHARS: Partial<Record<LinkedInSectionKind, number>> = { headline: 100, about: 300 };

/** Target character count for a length step, within LinkedIn's limit. */
export function targetChars(kind: LinkedInSectionKind, originalChars: number, step: LengthStep): number {
  const ratio = RATIOS[kind === "headline" || kind === "about" ? "wide" : "entry"][step];
  const base = Math.max(originalChars, USUAL_CHARS[kind] ?? 0);
  const floor = Math.min(originalChars, 20); // a very short entry can't usefully shrink
  return Math.min(sectionCap(kind), Math.max(floor, Math.round(base * ratio)));
}

export function lengthInstruction(args: { original: number; target: number; step: LengthStep; format: TextFormat; bullets: number }): string {
  const { original, target, step, format, bullets } = args;
  const how =
    step === "same"
      ? "Keep about the same length."
      : target < original
        ? "Get shorter by cutting filler and merging; keep every concrete fact you can."
        : "Get longer only with detail the sources actually contain (how, with what, for what, as stated). Never add facts, numbers, names, or claims to reach the length. Never add purposes, motivations, or outcomes the sources don't state (no 'with the aim of', 'to ensure', 'helping the team'), and never restate the same point in more words: that is padding. If the sources don't support that much, stop shorter.";
  const bulletRule =
    format === "bullets" ? ` Keep ${bullets} bullet${bullets === 1 ? "" : "s"} or fewer at any length: change their length, not their number.` : "";
  return `Length: aim for about ${target} characters (the original is ${original}), within about 15%. ${how}${bulletRule}`;
}

/**
 * How far a result missed its length step, as feedback for one retry; null when it's close enough.
 * Shorter must actually shrink; longer must at least grow past the original (the model may stop
 * short of the target when the sources don't support more, which is correct).
 */
export function lengthIssue(args: { step: LengthStep; original: number; target: number; actual: number }): string | null {
  const { step, original, target, actual } = args;
  if (step === "same") return null;
  if (target < original && actual > target * 1.25) {
    return `it is ${actual} characters but the target is about ${target}: cut it down by dropping the least important details and merging`;
  }
  if (target > original && actual < original * 1.08) {
    return `it is ${actual} characters, barely longer than the original (${original}); lengthen it toward ${target} only with detail the sources actually contain, with no new facts, purposes, or restatements. If the sources have nothing more to say, staying shorter is correct`;
  }
  return null;
}

/** Rewrites that barely change the original (word-bigram overlap above this) get one retry. */
export const MIN_CHANGE_OVERLAP = 0.8;

/** Feedback for one retry when a rewrite is nearly the original; null when it changed enough. */
export function changeIssue(original: string, rewrite: string): string | null {
  const overlap = bigramOverlap(original, rewrite);
  return overlap > MIN_CHANGE_OVERLAP
    ? "it is nearly identical to the original; restructure it (strongest point first, cut filler, tighten) instead of changing a few words"
    : null;
}

// ---------- deterministic style checks ----------

const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|me|my|mine|we|our|us)\b/;
// Contractions only; possessives ("team's") are fine.
const CONTRACTION = /\b\w+(?:n't|'re|'ve|'ll|'m|'d)\b|\b(?:it|that|there|what|he|she)'s\b/i;

/** Rule breaks that can be checked without a model. Empty means none found. */
export function styleIssues(style: SectionStyle, content: string, format: TextFormat): string[] {
  const text = content.replace(/[’]/g, "'");
  const issues: string[] = [];
  if (style === "professional") {
    if (FIRST_PERSON.test(text)) issues.push("uses first person (I, my, we…)");
    if (CONTRACTION.test(text)) issues.push("uses contractions");
    if (text.includes("!")) issues.push("uses an exclamation mark");
  }
  if (style === "direct" && (format === "bullets" || format === "line" || format === "paragraph") && /\bI\b/.test(text)) {
    issues.push("uses 'I' where Direct has no first person");
  }
  if (style === "narrative" && format === "paragraphs" && !/\b(I|I'm|I've|my)\b/.test(text)) {
    issues.push("has no first person, which Narrative requires");
  }
  return issues;
}

/** Word-bigram overlap between two texts, 0 (nothing shared) to 1 (identical). For measuring how different styles are. */
export function bigramOverlap(a: string, b: string): number {
  const grams = (t: string) => {
    const w = t.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    return new Set(w.slice(1).map((x, i) => `${w[i]} ${x}`));
  };
  const A = grams(a);
  const B = grams(b);
  if (!A.size && !B.size) return 1;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared++;
  return shared / (A.size + B.size - shared);
}
