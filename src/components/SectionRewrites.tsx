"use client";

import { LoaderCircle, PenLine, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { VariationResult } from "@/components/RewriteComparison";
import { Button } from "@/components/ui/button";
import type { IdentityFact, RewritableSection, RewriteResponse, RewriteSectionResponse, RewriteStyle, Segment } from "@/lib/schemas";

// LinkedIn rewrites, one card per section in LinkedIn order. Each card picks Direct or Narrative,
// generates on demand, caches per style, and has its own FactCheck, edit-then-recheck, and Copy.
// All requests go through PersonaFlow (which runs "Rewrite all" at most 3 at a time).

export type SectionRewriteState = {
  style: RewriteStyle;
  results: Partial<Record<RewriteStyle, RewriteSectionResponse>>;
  loading: RewriteStyle | null;
  error: string | null;
};

export const STYLE_NAME: Record<RewriteStyle, string> = { direct: "Direct", narrative: "Narrative" };

export function SectionRewrites(props: {
  sections: RewritableSection[];
  states: Record<string, SectionRewriteState>;
  /** FactCheck's corpus per section: the whole profile for headline/About, the entry itself otherwise. */
  sourcesFor: (key: string) => Segment[];
  confirmedFacts: IdentityFact[];
  goal: string;
  allStyle: RewriteStyle;
  rewritingAll: boolean;
  focusKey: string | null;
  adversarial: RewriteResponse | null;
  adversarialOriginal: string;
  adversarialSegments: Segment[];
  onGoal: (goal: string) => void;
  onStyle: (key: string, style: RewriteStyle) => void;
  onGenerate: (key: string) => void;
  onAllStyle: (style: RewriteStyle) => void;
  onRewriteAll: () => void;
  onAdversarial: (enabled: boolean) => void;
  onError: (message: string) => void;
}) {
  const { sections, states, sourcesFor, confirmedFacts, goal, allStyle, rewritingAll, focusKey } = props;
  const { adversarial, adversarialOriginal, adversarialSegments } = props;
  const { onGoal, onStyle, onGenerate, onAllStyle, onRewriteAll, onAdversarial, onError } = props;
  const listRef = useRef<HTMLDivElement>(null);

  // "Rewrite this section" from Audience Clash lands on that card.
  useEffect(() => {
    if (!focusKey) return;
    listRef.current?.querySelector(`[data-section="${focusKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusKey]);

  const anyLoading = Object.values(states).some((s) => s.loading);
  const noFacts = !confirmedFacts.length;

  return (
    <section className="flow-section fade-in">
      <div className="results-heading">
        <h2 className="flow-title">
          <Sparkles />
          Rewrite by section
        </h2>
      </div>
      <p className="flow-description">
        Each section is rewritten on its own, using only its text and the facts you confirmed. Paste each one back into
        LinkedIn when you’re happy with it.
      </p>

      <div className="rewrite-options rewrite-all-row">
        <div>
          <label className="field-label" htmlFor="rewrite-goal">
            Goal <span className="optional">(optional)</span>
          </label>
          <input
            id="rewrite-goal"
            className="goal-input"
            maxLength={300}
            value={goal}
            onChange={(event) => onGoal(event.target.value)}
            placeholder="e.g. Make it clearer for technical recruiters"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="all-style">
            Style for all
          </label>
          <select
            id="all-style"
            className="audience-select"
            value={allStyle}
            disabled={rewritingAll}
            onChange={(event) => onAllStyle(event.target.value as RewriteStyle)}
          >
            <option value="direct">Direct</option>
            <option value="narrative">Narrative</option>
          </select>
        </div>
        <Button variant="aero" disabled={noFacts || rewritingAll || anyLoading} onClick={onRewriteAll}>
          {rewritingAll ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {rewritingAll ? "Rewriting sections…" : "Rewrite all sections"}
        </Button>
      </div>
      {noFacts && <p className="empty-note">Confirm at least one fact in Identity DNA before rewriting.</p>}

      <div className="section-cards" ref={listRef}>
        {sections.map((section) => {
          const st = states[section.key] ?? { style: allStyle, results: {}, loading: null, error: null };
          const result = st.results[st.style];
          return (
            <article key={section.key} className="section-card" data-section={section.key} data-focused={focusKey === section.key}>
              <div className="section-card-head">
                <h3 className="section-heading">{section.label}</h3>
                <div className="section-card-controls">
                  <label className="sr-only" htmlFor={`style-${section.key}`}>
                    Style for {section.label}
                  </label>
                  <select
                    id={`style-${section.key}`}
                    className="audience-select style-select"
                    value={st.style}
                    disabled={Boolean(st.loading)}
                    onChange={(event) => onStyle(section.key, event.target.value as RewriteStyle)}
                  >
                    <option value="direct">Direct{st.results.direct ? " ✓" : ""}</option>
                    <option value="narrative">Narrative{st.results.narrative ? " ✓" : ""}</option>
                  </select>
                  <Button variant="glass" size="sm" disabled={noFacts || Boolean(st.loading)} onClick={() => onGenerate(section.key)}>
                    {st.loading ? <LoaderCircle className="animate-spin" /> : <PenLine />}
                    {st.loading ? "Rewriting…" : result ? "Rewrite again" : "Rewrite"}
                  </Button>
                </div>
              </div>
              {result?.source === "sample" && <span className="sample-badge">Sample result</span>}
              {st.loading && (
                <p className="loading-row" role="status">
                  <LoaderCircle className="animate-spin" size={14} />
                  Writing the {STYLE_NAME[st.loading].toLowerCase()} version and running FactCheck…
                </p>
              )}
              {st.error && !st.loading && (
                <div className="flow-error section-error" role="alert">
                  <TriangleAlert />
                  <p>{st.error}</p>
                  <Button variant="glass" size="sm" onClick={() => onGenerate(section.key)}>
                    Try again
                  </Button>
                </div>
              )}
              {!result && !st.loading && !st.error && <p className="section-original">{section.text}</p>}
              {result && !st.loading && (
                <VariationResult
                  key={`${result.source}|${result.style}|${result.rewrite.content}`}
                  original={section.text}
                  segments={sourcesFor(section.key)}
                  confirmedFacts={confirmedFacts}
                  variation={{ style: result.style, rewrite: result.rewrite, warnings: result.warnings, styleWarnings: result.styleWarnings }}
                  source={result.source}
                  onError={onError}
                />
              )}
            </article>
          );
        })}
      </div>

      <div className="factcheck-demo">
        <label className="demo-toggle">
          <input type="checkbox" checked={adversarial !== null} onChange={(event) => onAdversarial(event.target.checked)} />
          Show FactCheck demo {adversarial && <span className="test-badge">Intentional test case</span>}
        </label>
        {adversarial && (
          <VariationResult
            original={adversarialOriginal}
            segments={adversarialSegments}
            confirmedFacts={confirmedFacts}
            variation={adversarial.variations[0]}
            source={adversarial.source}
            onError={onError}
          />
        )}
      </div>
    </section>
  );
}
