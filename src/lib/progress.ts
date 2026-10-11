// Pacing for the AI progress bar. We can't know how long the model will take, so the bar is an
// estimate: it moves quickly at first, slows as it nears PROGRESS_CAP, and holds there until the
// response arrives. Only then does it jump to 100%. It never shows a number, since the number isn't real.

/** The bar never passes this while waiting. */
export const PROGRESS_CAP = 95;

/** Steepness: at the expected time the bar is at ~85% (95 * (1 - e^-2.25)), ~64% at half of it. */
const STEEPNESS = 2.25;

/**
 * Rough live durations, used as each bar's expected time. Rewrite (~11-12s) is from HANDOFF.md;
 * the others are estimates. Tune them after timing real runs.
 */
export const EXPECTED_MS = {
  /** Audience feedback, all lenses. */
  evaluate: 10_000,
  /** Hinge or bio: two versions in one call. */
  rewrite: 12_000,
  /** LinkedIn: one section, one style. */
  section: 6_000,
} as const;

/** Rewriting every section runs `parallel` at a time, so it takes about one section per batch. */
export function expectedBatchMs(count: number, parallel: number, perItemMs: number = EXPECTED_MS.section): number {
  return Math.max(1, Math.ceil(count / Math.max(1, parallel))) * perItemMs;
}

/** Asymptotic progress (0..PROGRESS_CAP) after `elapsedMs` of a wait expected to take `expectedMs`. */
export function pacedProgress(elapsedMs: number, expectedMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  const t = elapsedMs / Math.max(expectedMs, 1);
  return PROGRESS_CAP * (1 - Math.exp(-STEEPNESS * t));
}
