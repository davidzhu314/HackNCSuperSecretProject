import { contentWords, SENTENCE_SPLIT, stem } from "./fact-guard";
import type { IdentityFact, Segment } from "./schemas";

// Sentence provenance ("receipts"): for each sentence of a rewrite, which original segments
// or confirmed facts it draws its words from. Deterministic, no model calls. Same word
// matching as FactCheck's loose-claim check, so the two never disagree about a sentence.

export type SentenceSource =
  | { kind: "segment"; id: string; text: string; prompt?: string }
  | { kind: "fact"; id: string; text: string };

export type ReceiptStatus = "traced" | "weak" | "untraced";

export type SentenceReceipt = {
  text: string;
  /** Sources that together cover the most of this sentence's words, best first. */
  sources: SentenceSource[];
  /** Share of the sentence's content words found in those sources, 0 to 1. */
  coverage: number;
  status: ReceiptStatus;
};

/** At least this share of a sentence's content words must trace back for it to count as traced. */
export const TRACED_THRESHOLD = 0.5;
const MAX_SOURCES = 3;

type Candidate = { source: SentenceSource; stems: Set<string> };

const stemsOf = (text: string) => new Set(contentWords(text).map(stem));

/** Only confirmed facts are sources: unconfirmed facts can never support a claim. */
function candidates(segments: Segment[], facts: IdentityFact[]): Candidate[] {
  return [
    ...segments.map((s) => ({
      source: { kind: "segment" as const, id: s.id, text: s.text, ...(s.prompt ? { prompt: s.prompt } : {}) },
      // Hinge prompt questions count, as in FactCheck.
      stems: stemsOf(s.prompt ? `${s.prompt} ${s.text}` : s.text),
    })),
    ...facts
      .filter((f) => f.confirmed && f.text.trim())
      .map((f) => ({ source: { kind: "fact" as const, id: f.id, text: f.text }, stems: stemsOf(f.text) })),
  ];
}

/**
 * Split a rewrite into sentences and trace each one. Sentences with fewer than two content
 * words (e.g. "Hi!") are skipped: there is nothing meaningful to trace.
 */
export function traceSentences(content: string, segments: Segment[], facts: IdentityFact[]): SentenceReceipt[] {
  const pool = candidates(segments, facts);
  const receipts: SentenceReceipt[] = [];

  for (const raw of content.split(SENTENCE_SPLIT)) {
    const text = raw.trim().replace(/^[-*]\s+/, "");
    const sentence = stemsOf(text);
    if (sentence.size < 2) continue;

    // Greedy cover: repeatedly take the source that explains the most still-unexplained words.
    const covered = new Set<string>();
    const sources: SentenceSource[] = [];
    while (sources.length < MAX_SOURCES) {
      let best: Candidate | null = null;
      let bestGain = 0;
      for (const c of pool) {
        if (sources.includes(c.source)) continue;
        let gain = 0;
        for (const w of sentence) if (!covered.has(w) && c.stems.has(w)) gain++;
        if (gain > bestGain) {
          best = c;
          bestGain = gain;
        }
      }
      if (!best) break;
      sources.push(best.source);
      for (const w of sentence) if (best.stems.has(w)) covered.add(w);
    }

    const coverage = covered.size / sentence.size;
    const status: ReceiptStatus = !sources.length ? "untraced" : coverage >= TRACED_THRESHOLD ? "traced" : "weak";
    receipts.push({ text, sources, coverage, status });
  }
  return receipts;
}
