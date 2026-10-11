"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { EvaluateResponse, PlatformConfig } from "@/lib/schemas";
import { averageTraitScores } from "@/lib/trait-scores";

export function TraitScorecard(props: {
  baseline: EvaluateResponse;
  improved: EvaluateResponse | null;
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  canScore: boolean;
  sampleMode: boolean;
  onScore: () => Promise<EvaluateResponse>;
}) {
  const { baseline, improved, config, audiences, traits, canScore, sampleMode, onScore } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const before = averageTraitScores(baseline, audiences, traits);
  const after = improved ? averageTraitScores(improved, audiences, traits) : null;
  const labelFor = (id: string) => config.traits.find((trait) => trait.id === id)?.label ?? id;

  async function score() {
    setLoading(true);
    setError(null);
    try { await onScore(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not score this draft. Try again."); }
    finally { setLoading(false); }
  }

  return (
    <section className="trait-scorecard" aria-labelledby="trait-scorecard-title">
      <div className="trait-scorecard-head">
        <div>
          <h2 id="trait-scorecard-title">Trait scorecard</h2>
          <p>Average of your selected audience ratings, shown on a 0–100 display scale.</p>
        </div>
        <Button variant="aero" disabled={!canScore || loading || sampleMode} onClick={() => void score()}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {loading ? "Scoring draft…" : improved ? "Score again" : "Score improved draft"}
        </Button>
      </div>
      {sampleMode && <p className="trait-scorecard-note">Sample mode does not send text to the AI, so draft scoring is unavailable. Turn off sample mode to score your rewrite.</p>}
      {!sampleMode && !canScore && <p className="trait-scorecard-note">Use a rewrite above to compare it with your original.</p>}
      {error && <p className="trait-scorecard-error" role="alert">{error}</p>}
      <div className="trait-score-list">
        {traits.map((trait) => {
          const oldScore = before[trait];
          const newScore = after?.[trait] ?? null;
          const delta = oldScore === null || newScore === null ? null : newScore - oldScore;
          return (
            <article className="trait-score-row" key={trait}>
              <div className="trait-score-title"><strong>{labelFor(trait)}</strong><span>{delta === null ? "Before" : `${delta > 0 ? "+" : ""}${delta} points`}</span></div>
              <div className="trait-score-track" role="img" aria-label={`${labelFor(trait)} original score ${oldScore ?? "not rated"} out of 100`}><span className="trait-score-fill" style={{ width: `${oldScore ?? 0}%` }} /><span className="trait-score-number">Original {oldScore ?? "—"}</span></div>
              {after && <div className="trait-score-track improved" role="img" aria-label={`${labelFor(trait)} improved draft score ${newScore ?? "not rated"} out of 100`}><span className="trait-score-fill" style={{ width: `${newScore ?? 0}%` }} /><span className="trait-score-number">Improved {newScore ?? "—"}</span></div>}
            </article>
          );
        })}
      </div>
      <p className="trait-scorecard-note">Scores summarize AI ratings for this text and these audience lenses. They are comparative guidance, not a measure of your worth or a prediction of real outcomes.</p>
    </section>
  );
}
