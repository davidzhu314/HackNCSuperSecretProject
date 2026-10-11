import type { AudienceCritique, Rating } from "./schemas";

// Pure helpers for the LinkedIn Audience Clash view. No model calls.

export const RATING_LEVEL: Record<Rating, number> = { not_evident: 0, weak: 1, moderate: 2, strong: 3 };

export type Disagreement = {
  segmentId: string;
  /** The audience that rated this sentence highest, and its critique. */
  high: AudienceCritique;
  /** The audience that rated it lowest. */
  low: AudienceCritique;
  /** Rating levels apart, at least 2. */
  gap: number;
};

/**
 * Sentences two different audiences rate at least two levels apart (e.g. strong vs weak).
 * One entry per sentence (its widest gap), widest gaps first, then in profile order.
 */
export function findDisagreements(critiques: AudienceCritique[], segmentOrder: string[] = []): Disagreement[] {
  const bySegment = new Map<string, AudienceCritique[]>();
  for (const c of critiques) {
    if (c.missingEvidence) continue;
    for (const id of new Set(c.segmentIds)) bySegment.set(id, [...(bySegment.get(id) ?? []), c]);
  }
  const out: Disagreement[] = [];
  for (const [segmentId, cs] of bySegment) {
    let best: Disagreement | null = null;
    for (const a of cs) {
      for (const b of cs) {
        if (a.audience === b.audience) continue;
        const gap = RATING_LEVEL[a.rating] - RATING_LEVEL[b.rating];
        if (gap >= 2 && (!best || gap > best.gap)) best = { segmentId, high: a, low: b, gap };
      }
    }
    if (best) out.push(best);
  }
  const pos = (id: string) => {
    const i = segmentOrder.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return out.sort((x, y) => y.gap - x.gap || pos(x.segmentId) - pos(y.segmentId));
}

/**
 * Critiques with evidence, grouped by the profile section of the first sentence they cite.
 * `sectionOf` maps a segment id to its section key (null = not a profile segment, dropped).
 */
export function critiquesBySection(
  critiques: AudienceCritique[],
  sectionOf: (segmentId: string) => string | null,
): Map<string, AudienceCritique[]> {
  const out = new Map<string, AudienceCritique[]>();
  for (const c of critiques) {
    if (c.missingEvidence || !c.segmentIds.length) continue;
    const key = sectionOf(c.segmentIds[0]);
    if (!key) continue;
    out.set(key, [...(out.get(key) ?? []), c]);
  }
  return out;
}

/** Critiques where the audience found no evidence at all ("Nobody could find: …"). */
export function missingEvidence(critiques: AudienceCritique[]): AudienceCritique[] {
  return critiques.filter((c) => c.missingEvidence || !c.segmentIds.length);
}
