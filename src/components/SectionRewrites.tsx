"use client";

import { Check, LoaderCircle, PenLine, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { VariationResult } from "@/components/RewriteComparison";
import { Button } from "@/components/ui/button";
import type {
  IdentityFact,
  LengthStep,
  RewritableSection,
  RewriteResponse,
  RewriteSectionResponse,
  SectionStyle,
  Segment,
} from "@/lib/schemas";
import { LENGTH_STEPS, STYLE_ORDER, STYLES, targetChars } from "@/lib/styles";

// LinkedIn rewrites, one card per section in LinkedIn order. Each card picks a style (Direct,
// Narrative, Professional) and a length (slider), generates on demand, caches per style + length,
// and has its own FactCheck, edit-then-recheck, and Copy.
// All requests go through PersonaFlow (which runs "Rewrite all" at most 3 at a time).
// "Use this version" puts a rewrite into the profile (undoable); cards keep showing the original
// text as "Original", and FactCheck keeps checking against it.

export type SectionRewriteState = {
  style: SectionStyle;
  length: LengthStep;
  /** Cached results keyed by resultKey(style, length). */
  results: Partial<Record<string, RewriteSectionResponse>>;
  loading: { style: SectionStyle; length: LengthStep } | null;
  error: string | null;
};

export const resultKey = (style: SectionStyle, length: LengthStep) => `${style}|${length}`;
const lengthIndex = (length: LengthStep) => LENGTH_STEPS.findIndex((l) => l.id === length);
const lengthLabel = (length: LengthStep) => LENGTH_STEPS[lengthIndex(length)].label;

/** A 5-stop length slider. Dragging only moves it; letting go (or a key press) commits. */
function LengthSlider(props: {
  id: string;
  value: LengthStep;
  disabled?: boolean;
  hint?: string;
  label: string;
  onChange: (length: LengthStep) => void;
  onCommit: (length: LengthStep) => void;
}) {
  const { id, value, disabled, hint, label, onChange, onCommit } = props;
  const at = (event: { currentTarget: HTMLInputElement }) => LENGTH_STEPS[Number(event.currentTarget.value)].id;
  return (
    <div className="length-slider">
      <label htmlFor={id} className="length-label">
        <span className="sr-only">{label}: </span>
        {lengthLabel(value)}
        {hint && <span className="length-hint"> · {hint}</span>}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={LENGTH_STEPS.length - 1}
        step={1}
        value={lengthIndex(value)}
        disabled={disabled}
        aria-valuetext={lengthLabel(value)}
        onChange={(event) => onChange(at(event))}
        onPointerUp={(event) => onCommit(at(event))}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) onCommit(at(event));
        }}
      />
      <div className="length-ticks" aria-hidden="true">
        <span>Shorter</span>
        <span>Same</span>
        <span>Longer</span>
      </div>
    </div>
  );
}

export function SectionRewrites(props: {
  sections: RewritableSection[];
  states: Record<string, SectionRewriteState>;
  /** FactCheck's corpus per section: the whole profile for headline/About, the entry itself otherwise. */
  sourcesFor: (key: string) => Segment[];
  confirmedFacts: IdentityFact[];
  goal: string;
  allStyle: SectionStyle;
  allLength: LengthStep;
  /** Sample mode only has "same length" results, so the slider is disabled. */
  sampleMode: boolean;
  rewritingAll: boolean;
  focusKey: string | null;
  adversarial: RewriteResponse | null;
  adversarialOriginal: string;
  adversarialSegments: Segment[];
  /** Sections whose profile text is currently an accepted rewrite. */
  applied: string[];
  /** The section's text in the profile now (the accepted rewrite, if any). */
  currentText: (key: string) => string;
  onUse: (key: string, text: string) => void;
  onUndo: (key: string) => void;
  onGoal: (goal: string) => void;
  onStyle: (key: string, style: SectionStyle) => void;
  /** `commit` is false while dragging (just move the slider) and true on release (generate). */
  onLength: (key: string, length: LengthStep, commit: boolean) => void;
  onGenerate: (key: string) => void;
  onAllStyle: (style: SectionStyle) => void;
  onAllLength: (length: LengthStep) => void;
  onRewriteAll: () => void;
  onAdversarial: (enabled: boolean) => void;
  onError: (message: string) => void;
}) {
  const { sections, states, sourcesFor, confirmedFacts, goal, allStyle, allLength, sampleMode, rewritingAll, focusKey } = props;
  const { adversarial, adversarialOriginal, adversarialSegments } = props;
  const { applied, currentText, onUse, onUndo } = props;
  const { onGoal, onStyle, onLength, onGenerate, onAllStyle, onAllLength, onRewriteAll, onAdversarial, onError } = props;
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
        Each section is rewritten on its own, using only its text and the facts you confirmed. When you like a version,
        choose “Use this version” to put it in your profile; you can undo it.
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
            onChange={(event) => onAllStyle(event.target.value as SectionStyle)}
          >
            {STYLE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STYLES[s].label}
              </option>
            ))}
          </select>
          <p className="style-summary">{STYLES[allStyle].summary}</p>
        </div>
        <div>
          <span className="field-label">Length for all</span>
          <LengthSlider
            id="all-length"
            label="Length for all"
            value={allLength}
            disabled={rewritingAll || sampleMode}
            onChange={onAllLength}
            onCommit={onAllLength}
          />
        </div>
        <Button variant="aero" disabled={noFacts || rewritingAll || anyLoading} onClick={onRewriteAll}>
          {rewritingAll ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {rewritingAll ? "Rewriting sections…" : "Rewrite all sections"}
        </Button>
      </div>
      {noFacts && <p className="empty-note">Confirm at least one fact in Identity DNA before rewriting.</p>}
      {sampleMode && <p className="empty-note">Sample results exist at the same length only; turn off sample mode to change the length.</p>}

      <div className="section-cards" ref={listRef}>
        {sections.map((section) => {
          const st: SectionRewriteState = states[section.key] ?? { style: allStyle, length: allLength, results: {}, loading: null, error: null };
          const result = st.results[resultKey(st.style, st.length)];
          const target = targetChars(section.kind, section.text.length, st.length);
          const isApplied = applied.includes(section.key);
          return (
            <article
              key={section.key}
              className="section-card"
              data-section={section.key}
              data-focused={focusKey === section.key}
              data-applied={isApplied}
            >
              <div className="section-card-head">
                <h3 className="section-heading">
                  {section.label}
                  {isApplied && (
                    <span className="applied-badge">
                      <Check size={12} />
                      Using a rewrite
                    </span>
                  )}
                </h3>
                <div className="section-card-controls">
                  <label className="sr-only" htmlFor={`style-${section.key}`}>
                    Style for {section.label}
                  </label>
                  <select
                    id={`style-${section.key}`}
                    className="audience-select style-select"
                    value={st.style}
                    disabled={noFacts}
                    onChange={(event) => onStyle(section.key, event.target.value as SectionStyle)}
                  >
                    {STYLE_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STYLES[s].label}
                        {st.results[resultKey(s, st.length)] ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                  <Button variant="glass" size="sm" disabled={noFacts || Boolean(st.loading)} onClick={() => onGenerate(section.key)}>
                    {st.loading ? <LoaderCircle className="animate-spin" /> : <PenLine />}
                    {st.loading ? "Rewriting…" : result ? "Rewrite again" : "Rewrite"}
                  </Button>
                </div>
              </div>
              <LengthSlider
                id={`length-${section.key}`}
                label={`Length for ${section.label}`}
                value={st.length}
                disabled={noFacts || sampleMode}
                hint={`about ${target.toLocaleString("en-US")} characters`}
                onChange={(length) => onLength(section.key, length, false)}
                onCommit={(length) => onLength(section.key, length, true)}
              />
              {result?.source === "sample" && <span className="sample-badge">Sample result</span>}
              {result && !st.loading && result.chars.target !== result.chars.original && (
                <p className="length-result">
                  {result.chars.actual.toLocaleString("en-US")} characters (aimed for about {result.chars.target.toLocaleString("en-US")}, original{" "}
                  {result.chars.original.toLocaleString("en-US")})
                  {result.chars.actual < result.chars.target * 0.85 && result.chars.target > result.chars.original
                    ? ". Stopped short: there wasn't more in your sources to say."
                    : ""}
                </p>
              )}
              {st.loading && (
                <p className="loading-row" role="status">
                  <LoaderCircle className="animate-spin" size={14} />
                  Writing the {STYLES[st.loading.style].label.toLowerCase()} version ({lengthLabel(st.loading.length).toLowerCase()}) and running FactCheck…
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
              {!result && !st.loading && !st.error && !isApplied && <p className="section-original">{section.text}</p>}
              {!result && !st.loading && isApplied && (
                <div className="applied-text">
                  <p className="section-original">{currentText(section.key)}</p>
                  <Button variant="link" size="sm" onClick={() => onUndo(section.key)}>
                    <Undo2 />
                    Undo, back to your original
                  </Button>
                </div>
              )}
              {result && !st.loading && (
                <VariationResult
                  key={`${result.source}|${result.style}|${result.length}|${result.rewrite.content}`}
                  original={section.text}
                  segments={sourcesFor(section.key)}
                  confirmedFacts={confirmedFacts}
                  variation={{ rewrite: result.rewrite, warnings: result.warnings, styleWarnings: result.styleWarnings }}
                  source={result.source}
                  onError={onError}
                  use={{
                    current: currentText(section.key),
                    applied: isApplied,
                    onUse: (text) => onUse(section.key, text),
                    onUndo: () => onUndo(section.key),
                  }}
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
