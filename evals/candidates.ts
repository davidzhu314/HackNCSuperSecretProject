// Models the eval runner compares. OpenRouter ids, verified against
// https://openrouter.ai/api/v1/models on 2026-10-10 (all support structured outputs).
// Prices are USD per 1M tokens, input / output, for budgeting only. Re-check before a run.

export type Candidate = { id: string; tier: "small" | "mid"; inPerM: number; outPerM: number; why: string };

export const CANDIDATES: Candidate[] = [
  {
    id: "anthropic/claude-haiku-5.5",
    tier: "small",
    inPerM: 0.1,
    outPerM: 0.5,
    why: "Current production default. The baseline everything is compared to.",
  },
  {
    id: "openai/gpt-6-luna",
    tier: "small",
    inPerM: 0.1,
    outPerM: 0.5,
    why: "Same price as Haiku from a different vendor. Tells us whether the small tier is vendor-sensitive.",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    tier: "mid",
    inPerM: 2,
    outPerM: 10,
    why: "20x the price. Only worth it for rewrite if it clearly beats the small models on voice without more FactCheck flags.",
  },
];

/**
 * Judge for voice fit and critique usefulness. Must be stronger than every candidate.
 * It is the same family as two candidates, so use pairwise comparisons with randomized
 * order and check it against the human calibration before trusting it.
 */
export const JUDGE = { id: "anthropic/claude-opus-5.5", inPerM: 4, outPerM: 20 };
