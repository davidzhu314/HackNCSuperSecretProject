import type { EvaluateResponse } from "./schemas";

const VALUE: Record<string, number> = { not_evident: 0, weak: 33, moderate: 67, strong: 100 };

export function averageTraitScores(response: EvaluateResponse, audiences: string[], traits: string[]) {
  return Object.fromEntries(traits.map((trait) => {
    const ratings = response.critiques
      .filter((critique) => critique.trait === trait && audiences.includes(critique.audience))
      .map((critique) => VALUE[critique.rating]);
    return [trait, ratings.length ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length) : null];
  }));
}

export function compareOverallTraitScores(before: EvaluateResponse, after: EvaluateResponse, audiences: string[], traits: string[]) {
  const average = (scores: ReturnType<typeof averageTraitScores>) => {
    const values = Object.values(scores).filter((value): value is number => value !== null);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  };
  const beforeScore = average(averageTraitScores(before, audiences, traits));
  const afterScore = average(averageTraitScores(after, audiences, traits));
  const delta = beforeScore === null || afterScore === null ? null : afterScore - beforeScore;
  return { before: beforeScore, after: afterScore, delta, improved: delta !== null && delta > 0 };
}
