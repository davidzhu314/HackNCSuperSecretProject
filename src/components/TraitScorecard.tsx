"use client";

import { ArrowRight, CircleCheck, CircleMinus, Lightbulb } from "lucide-react";
import { compareAnswered, coverage, isAnswered, type CellChange } from "@/lib/answered";
import { RATING_LABEL } from "@/lib/persona-ui";
import type { AudienceCritique, EvaluateResponse, PlatformConfig, Segment } from "@/lib/schemas";

// Audience questions answered, original vs. the rewrite the user asked the lenses about.
// Real counts only (see lib/answered.ts): each bar segment is one lens, filled when that lens can tell.

const OPEN_SHOWN = 4;

export function TraitScorecard(props: {
  baseline: EvaluateResponse;
  baselineSegments: Segment[];
  improved: { evaluation: EvaluateResponse; segments: Segment[] } | null;
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  sampleMode: boolean;
}) {
  const { baseline, baselineSegments, improved, config, audiences, traits, sampleMode } = props;
  const question = (id: string) => {
    const t = config.traits.find((x) => x.id === id);
    return t?.question ?? t?.label ?? id;
  };
  const lens = (id: string) => config.audiences.find((a) => a.id === id)?.label ?? id;

  const cmp = improved ? compareAnswered(baseline, improved.evaluation, audiences, traits) : null;
  const before = cmp?.before ?? coverage(baseline, audiences, traits);
  const after = cmp?.after ?? null;
  const ratingOf = (r: EvaluateResponse, audience: string, trait: string) =>
    r.critiques.find((c) => c.audience === audience && c.trait === trait)?.rating;
  // What's still open: in the rewrite if the lenses read one, otherwise in your text. Each has a next step.
  const open: AudienceCritique[] = cmp
    ? cmp.open
    : baseline.critiques.filter((c) => audiences.includes(c.audience) && traits.includes(c.trait) && !isAnswered(c.rating));

  return (
    <section className="trait-scorecard" aria-labelledby="trait-scorecard-title">
      <div className="trait-scorecard-head">
        <div>
          <h2 id="trait-scorecard-title">Audience questions answered</h2>
          <p>
            Each lens you picked asks each question. It counts as answered when that lens rates it Moderate or Strong:
            the reader can tell from your text.
          </p>
        </div>
        <p className="answered-total" aria-label={after ? `${before.answered} answered before, ${after.answered} with the rewrite, of ${after.total}` : `${before.answered} of ${before.total} answered`}>
          <strong>{before.answered}</strong>
          {after && (
            <>
              <ArrowRight size={16} aria-hidden />
              <strong data-verdict={cmp?.verdict}>{after.answered}</strong>
            </>
          )}
          <span>of {(after ?? before).total}</span>
        </p>
      </div>

      {sampleMode && <p className="trait-scorecard-note">Sample mode doesn&apos;t send text to the AI, so the lenses can&apos;t read a rewrite. Turn it off to compare.</p>}
      {!sampleMode && !improved && (
        <p className="trait-scorecard-note">On a rewrite, choose &ldquo;Ask the same lenses&rdquo; to see which of these it answers.</p>
      )}

      <p className="lens-key" aria-hidden>
        Each segment is one lens:
        <span><span className="lens-seg" data-rating="strong" /> Strong</span>
        <span><span className="lens-seg" data-rating="moderate" /> Moderate</span>
        <span><span className="lens-seg" data-rating="weak" /> Can&apos;t tell yet</span>
      </p>
      <div className="trait-score-list">
        {(after ?? before).byTrait.map((row, i) => {
          const was = before.byTrait[i];
          const lenses = audiences.filter((a) => ratingOf(baseline, a, row.trait) && (!improved || ratingOf(improved.evaluation, a, row.trait)));
          if (!lenses.length) return null;
          return (
            <article className="trait-score-row" key={row.trait}>
              <div className="trait-score-title">
                <strong>{question(row.trait)}</strong>
                <span>
                  {after ? `${was.answered} → ${row.answered} of ${row.total} lenses` : `${was.answered} of ${was.total} lenses`}
                </span>
              </div>
              <LensBar label="Your text" lenses={lenses} rating={(a) => ratingOf(baseline, a, row.trait)} lensName={lens} />
              {improved && (
                <LensBar label="Rewrite" improved lenses={lenses} rating={(a) => ratingOf(improved.evaluation, a, row.trait)} lensName={lens} />
              )}
            </article>
          );
        })}
      </div>

      {cmp && (cmp.gained.length > 0 || cmp.lost.length > 0) && (
        <div className="answered-changes">
          <h3>What changed</h3>
          <ul>
            {cmp.gained.map((c) => (
              <ChangeItem key={`g-${c.audience}-${c.trait}`} change={c} kind="gained" lens={lens} question={question} segments={improved!.segments} />
            ))}
            {cmp.lost.map((c) => (
              <ChangeItem key={`l-${c.audience}-${c.trait}`} change={c} kind="lost" lens={lens} question={question} segments={baselineSegments} />
            ))}
          </ul>
        </div>
      )}
      {cmp && cmp.verdict === "same" && (
        <p className="trait-scorecard-note">
          This version answers the same questions as your text
          {cmp.clearer.length ? `; ${cmp.clearer.length} ${cmp.clearer.length === 1 ? "is" : "are"} rated clearer` : ""}
          {cmp.weaker.length ? `; ${cmp.weaker.length} less clear` : ""}.
        </p>
      )}

      {open.length > 0 && (
        <div className="answered-open">
          <h3>
            <Lightbulb size={14} aria-hidden /> Still open{improved ? " in this version" : ""}: what would help
          </h3>
          <ul>
            {open.slice(0, OPEN_SHOWN).map((c) => (
              <OpenItem key={`${c.audience}-${c.trait}`} critique={c} lens={lens} question={question} />
            ))}
          </ul>
          {open.length > OPEN_SHOWN && (
            <details>
              <summary>{open.length - OPEN_SHOWN} more</summary>
              <ul>
                {open.slice(OPEN_SHOWN).map((c) => (
                  <OpenItem key={`${c.audience}-${c.trait}`} critique={c} lens={lens} question={question} />
                ))}
              </ul>
            </details>
          )}
          <p className="trait-scorecard-note">
            Only add what&apos;s true: if you have it, add it as a fact above or in your own words.
          </p>
        </div>
      )}

      <p className="trait-scorecard-note">
        Counted from the lenses&apos; ratings, never a score. Each rating is one AI read, so a single change can be noise:
        read the reason before relying on it. Simulated lenses, not real people or predictions.
      </p>
    </section>
  );
}

/** One question's lenses as segments: filled when that lens can tell. Hover or focus names the lens and rating. */
function LensBar(props: {
  label: string;
  lenses: string[];
  rating: (audience: string) => AudienceCritique["rating"] | undefined;
  lensName: (id: string) => string;
  improved?: boolean;
}) {
  const { label, lenses, rating, lensName, improved } = props;
  const answered = lenses.filter((a) => {
    const r = rating(a);
    return r && isAnswered(r);
  }).length;
  return (
    <div className="lens-bar" data-improved={improved || undefined} role="img" aria-label={`${label}: ${answered} of ${lenses.length} lenses can tell. ${lenses.map((a) => `${lensName(a)} ${RATING_LABEL[rating(a)!]}`).join(", ")}`}>
      <span className="lens-bar-label">{label}</span>
      <span className="lens-bar-segments">
        {lenses.map((a) => {
          const r = rating(a)!;
          return <span key={a} className="lens-seg" data-rating={r} data-answered={isAnswered(r)} title={`${lensName(a)}: ${RATING_LABEL[r]}`} />;
        })}
      </span>
    </div>
  );
}

function ChangeItem(props: {
  change: CellChange;
  kind: "gained" | "lost";
  lens: (id: string) => string;
  question: (id: string) => string;
  segments: Segment[];
}) {
  const { change, kind, lens, question, segments } = props;
  const read = kind === "gained" ? change.after : change.before;
  const quote = read.segmentIds.map((id) => segments.find((s) => s.id === id)?.text).find(Boolean);
  const Icon = kind === "gained" ? CircleCheck : CircleMinus;
  return (
    <li data-kind={kind}>
      <Icon size={14} aria-hidden />
      <div>
        <p>
          <strong>{lens(change.audience)}</strong> {kind === "gained" ? "can now tell" : "can no longer tell"}:{" "}
          {question(change.trait)}{" "}
          <span className="answered-rating">
            ({RATING_LABEL[change.before.rating]} → {RATING_LABEL[change.after.rating]})
          </span>
        </p>
        <p className="answered-reason">{change.after.rationale}</p>
        {quote && kind === "gained" && <q className="answered-quote">{quote}</q>}
        {quote && kind === "lost" && (
          <p className="answered-reason">
            Your text had: <q className="answered-quote">{quote}</q>
          </p>
        )}
      </div>
    </li>
  );
}

function OpenItem(props: { critique: AudienceCritique; lens: (id: string) => string; question: (id: string) => string }) {
  const { critique, lens, question } = props;
  return (
    <li>
      <p>
        <strong>{question(critique.trait)}</strong> · {lens(critique.audience)} ({RATING_LABEL[critique.rating]})
      </p>
      <p className="answered-reason">{critique.suggestion || critique.rationale}</p>
    </li>
  );
}
