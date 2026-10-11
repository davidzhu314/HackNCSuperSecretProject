"use client";

import type { EvaluateResponse, PlatformConfig } from "@/lib/schemas";
import { averageTraitScores } from "@/lib/trait-scores";

export function TraitScorecard(props: {
  baseline: EvaluateResponse;
  improved: EvaluateResponse | null;
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  sampleMode: boolean;
}) {
  const { baseline, improved, config, audiences, traits, sampleMode } = props;
  const before = averageTraitScores(baseline, audiences, traits);
  const after = improved ? averageTraitScores(improved, audiences, traits) : null;
  const labelFor = (id: string) => config.traits.find((trait) => trait.id === id)?.label ?? id;

  return (
    <section className="trait-scorecard" aria-labelledby="trait-scorecard-title">
      <div className="trait-scorecard-head">
        <div>
          <h2 id="trait-scorecard-title">Trait scorecard</h2>
          <p>
            Scores use your selected audiences and traits. Each rating maps Not evident, Weak, Moderate, and Strong to
            0, 33, 67, and 100; when a rewrite is scored, it uses the same selections.
          </p>
        </div>
      </div>
      {sampleMode && <p className="trait-scorecard-note">Sample mode does not send text to the AI, so draft scoring is unavailable. Turn off sample mode to score your rewrite.</p>}
      {!sampleMode && !improved && <p className="trait-scorecard-note">Generate a rewrite to compare audience ratings.</p>}
      {improved && (
        <div className="trait-score-legend" aria-label="Score bar legend">
          <span><i className="trait-score-swatch" aria-hidden="true" /> Original</span>
          <span><i className="trait-score-swatch is-rewrite" aria-hidden="true" /> Rewrite</span>
          <span>0-100 display scale</span>
        </div>
      )}
      <div className="trait-score-list">
        {traits.map((trait) => {
          const oldScore = before[trait];
          const newScore = after?.[trait] ?? null;
          const delta = oldScore === null || newScore === null ? null : newScore - oldScore;
          return (
            <article className="trait-score-row" key={trait}>
              <div className="trait-score-title"><strong>{labelFor(trait)}</strong><span>{delta === null ? "Before" : `${delta > 0 ? "+" : ""}${delta} points`}</span></div>
              <div className="trait-score-track" role="img" aria-label={`${labelFor(trait)} original score ${oldScore ?? "not rated"} out of 100`}><span className="trait-score-fill" style={{ width: `${oldScore ?? 0}%` }} /><span className="trait-score-number">Original {oldScore ?? "—"}</span></div>
              {after && <div className="trait-score-track improved" role="img" aria-label={`${labelFor(trait)} rewrite score ${newScore ?? "not rated"} out of 100`}><span className="trait-score-fill" style={{ width: `${newScore ?? 0}%` }} /><span className="trait-score-number">Rewrite {newScore ?? "—"}</span></div>}
            </article>
          );
        })}
      </div>
      <p className="trait-scorecard-note">
        These are separate AI evaluations and may vary between runs. Use the comparison as a review aid, not a prediction of real outcomes.
      </p>
    </section>
  );
}
