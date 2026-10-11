import { z } from "zod";
import { LIMITS, type GuardWarning, type Rating } from "./schemas";

// Client-side helpers for the UI (ported from the Lovable design). No AI, no network.

export const RATING_LABEL: Record<Rating, string> = {
  not_evident: "Not evident",
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};

export const WARNING_LABEL: Record<GuardWarning["kind"], string> = {
  unsupported_number: "Number not in your facts",
  unsupported_entity: "Name not in your facts",
  inflated_verb: "Stronger claim than your facts",
  invalid_fact_id: "Unknown or unconfirmed fact",
  unsupported_claim: "Needs your review",
  unverified_segment: "Unknown source",
  ai_cliche: "AI cliché",
  over_limit: "Over the character limit",
};

export const factTextSchema = z
  .string()
  .trim()
  .min(1, "Add a fact first.")
  .max(LIMITS.factText, "Keep each fact under 300 characters.");

export const HINGE_PROMPTS = [
  "I'm weirdly good at",
  "A perfect Sunday",
  "Together, we could",
  "The way to win me over is",
  "My simple pleasures",
  "I geek out on",
];
export const MAX_HINGE_PROMPTS = 3;
export const MAX_HINGE_ANSWER = 300;

export type HingePair = { prompt: string; answer: string };

/** Three empty prompts, so the Hinge form always has something to fill in. */
export function emptyHingePairs(): HingePair[] {
  return HINGE_PROMPTS.slice(0, MAX_HINGE_PROMPTS).map((prompt) => ({ prompt, answer: "" }));
}

export type DiffToken = { text: string; changed: boolean };

/** Word-level LCS diff. Each side keeps its own whitespace so text can be rendered as-is. */
export function wordDiff(original: string, revised: string): { original: DiffToken[]; revised: DiffToken[] } {
  const a = original.match(/\S+\s*/g) ?? [];
  const b = revised.match(/\S+\s*/g) ?? [];
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i].trim() === b[j].trim() ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const left: DiffToken[] = [];
  const right: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].trim() === b[j].trim()) {
      left.push({ text: a[i++], changed: false });
      right.push({ text: b[j++], changed: false });
    } else if (j < b.length && (i >= a.length || table[i][j + 1] >= table[i + 1][j])) {
      right.push({ text: b[j++], changed: true });
    } else {
      left.push({ text: a[i++], changed: true });
    }
  }
  return { original: left, revised: right };
}
