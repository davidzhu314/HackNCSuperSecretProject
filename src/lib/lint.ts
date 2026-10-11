import { contentWords, extractNumbers, stem } from "./fact-guard";
import type { PlatformGroup, Segment } from "./schemas";
import { splitSentences } from "./segments";

// Profile linter: instant, deterministic checks on the user's own text, run in the browser before
// anything is sent to the AI (so it needs no consent). Suggestions about wording only; it says
// nothing about whether a claim is true. Also counts "specifics" for the before/after scorecard.

export type LintKind = "buzzword" | "vague" | "no_role" | "duty" | "repeat" | "long_sentence";

export type LintIssue = {
  kind: LintKind;
  /** The words the issue is about, as written. */
  text: string;
  explanation: string;
  /** The segment it was found in, when the text came in segments. */
  segmentId?: string;
};

export const LINT_LABEL: Record<LintKind, string> = {
  buzzword: "Buzzword",
  vague: "No specifics",
  no_role: "No role",
  duty: "Duty, not result",
  repeat: "Repeated word",
  long_sentence: "Long sentence",
};

/** Phrases that say little because everyone uses them. Professional first, then social and dating. */
const BUZZWORDS: string[] = [
  "passionate", "hardworking", "hard-working", "hard working", "team player", "self-starter", "self starter",
  "go-getter", "go getter", "detail-oriented", "detail oriented", "results-driven", "results driven",
  "highly motivated", "motivated individual", "think outside the box", "proven track record", "dynamic",
  "synergy", "guru", "ninja", "rockstar", "thought leader", "wear many hats", "fast learner", "quick learner",
  "aspiring", "innovative", "innovation", "love to laugh", "fun-loving", "fun loving", "easygoing",
  "easy-going", "laid back", "laid-back", "adventurous", "foodie", "wanderlust", "partner in crime",
  "no drama", "work hard, play hard", "work hard play hard", "fluent in sarcasm", "down to earth",
  "down-to-earth", "just ask", "living my best life", "good vibes",
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[- ]/g, "[- ]?");
const BUZZWORD_RE = new RegExp(`\\b(${BUZZWORDS.map(escapeRe).join("|")})\\b`, "gi");

/** Role nouns a LinkedIn headline usually names. */
const ROLE_WORDS =
  /\b(engineer|developer|programmer|student|intern|designer|analyst|manager|scientist|researcher|founder|co-?founder|assistant|ta|consultant|writer|marketer|lead|director|teacher|tutor|architect|specialist|associate|officer|coordinator|candidate|graduate|major|senior|junior|sophomore|freshman|phd|professor|nurse|accountant|recruiter|entrepreneur)s?\b/i;

/** "Responsible for", "duties included", "tasked with": a job description, not what you did. */
const DUTY_RE = /\b(responsible for|duties included|tasked with|in charge of|worked on various|helped with various)\b/i;

const LONG_SENTENCE_WORDS = 32;
const REPEAT_MIN = 3;

/** Words that may repeat freely (common in profiles, and too generic to flag). */
const REPEAT_OK = new Set(["work", "team", "project", "student", "people", "time", "love", "like", "make"].map(stem));

/**
 * Concrete details in a piece of text: numbers, names (capitalized words after the first), and
 * tool-like tokens (inner capitals or digits, e.g. "PyTorch", "C++", "S3"). Unique, as written.
 */
export function specificsIn(text: string): string[] {
  const found = new Set<string>();
  for (const n of extractNumbers(text)) found.add(n.text);
  for (const sentence of splitSentences(text)) {
    const words = sentence.match(/[A-Za-z][\w'’&+#.-]*/g) ?? [];
    words.forEach((w, i) => {
      const clean = w.replace(/[.,]+$/, "");
      if (/^I(['’]|$)/.test(clean)) return;
      if ((i > 0 && /^[A-Z]/.test(clean)) || /[a-z][A-Z]|[A-Z]{2,}|\d|\+\+|#$/.test(clean)) found.add(clean);
    });
  }
  return [...found];
}

/** Buzzwords as written, in order of appearance (repeats included). */
export function buzzwordsIn(text: string): string[] {
  return [...text.matchAll(BUZZWORD_RE)].map((m) => m[1]);
}

/**
 * Lint the user's text. `group` decides which checks apply: "No specifics" is for professional
 * profiles only (a dating answer can be concrete without names or numbers). `headlineId` marks
 * the LinkedIn headline segment, which should name a role.
 */
export function lintSegments(segments: Segment[], group: PlatformGroup, headlineId?: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const stemCounts = new Map<string, { count: number; word: string; segmentId: string }>();

  for (const seg of segments) {
    const text = seg.text;
    for (const word of new Set(buzzwordsIn(text).map((b) => b.toLowerCase()))) {
      issues.push({
        kind: "buzzword",
        text: word,
        explanation: "Almost everyone writes this. Show it with a detail instead of saying it.",
        segmentId: seg.id,
      });
    }
    if (seg.id === headlineId && text.trim() && !ROLE_WORDS.test(text)) {
      issues.push({
        kind: "no_role",
        text: text.trim(),
        explanation: "Your headline doesn't name a role or level, so readers can't tell what you do or are looking for.",
        segmentId: seg.id,
      });
    }
    for (const sentence of splitSentences(text)) {
      const wordCount = sentence.split(/\s+/).filter(Boolean).length;
      const duty = sentence.match(DUTY_RE);
      if (duty) {
        issues.push({
          kind: "duty",
          text: duty[1],
          explanation: "This describes a duty. Say what you did or what came of it instead.",
          segmentId: seg.id,
        });
      }
      if (wordCount > LONG_SENTENCE_WORDS) {
        issues.push({
          kind: "long_sentence",
          text: sentence.split(/\s+/).slice(0, 8).join(" ") + "…",
          explanation: `This sentence is ${wordCount} words. Split it so each idea gets its own sentence.`,
          segmentId: seg.id,
        });
      }
      if (
        group === "professional" &&
        seg.id !== headlineId &&
        contentWords(sentence).length >= 5 &&
        !specificsIn(sentence).length
      ) {
        issues.push({
          kind: "vague",
          text: sentence.length > 70 ? sentence.slice(0, 67) + "…" : sentence,
          explanation: "No tool, place, project, or number here. One concrete detail you can stand behind makes it believable.",
          segmentId: seg.id,
        });
      }
    }
    for (const w of contentWords(text)) {
      const key = stem(w);
      if (REPEAT_OK.has(key) || w.length < 4) continue;
      const prev = stemCounts.get(key);
      stemCounts.set(key, { count: (prev?.count ?? 0) + 1, word: prev?.word ?? w.toLowerCase(), segmentId: prev?.segmentId ?? seg.id });
    }
  }

  for (const { count, word, segmentId } of stemCounts.values()) {
    if (count >= REPEAT_MIN) {
      issues.push({
        kind: "repeat",
        text: word,
        explanation: `“${word}” appears ${count} times. Vary it or cut a repeat.`,
        segmentId,
      });
    }
  }
  return issues;
}

/** Real counts comparing your text with a rewrite. Never a score. */
export type RewriteScorecard = {
  buzzwordsBefore: number;
  buzzwordsAfter: number;
  specificsBefore: number;
  specificsAfter: number;
  /** Distinct confirmed facts a sentence of the rewrite traces back to. */
  factsUsed: number;
  charsBefore: number;
  charsAfter: number;
};

export function scoreRewrite(before: string, after: string, factsUsed: number): RewriteScorecard {
  return {
    buzzwordsBefore: buzzwordsIn(before).length,
    buzzwordsAfter: buzzwordsIn(after).length,
    specificsBefore: specificsIn(before).length,
    specificsAfter: specificsIn(after).length,
    factsUsed,
    charsBefore: [...before].length,
    charsAfter: [...after].length,
  };
}
