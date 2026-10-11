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
