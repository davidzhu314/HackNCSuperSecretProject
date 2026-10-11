"use client";

import { Check, Clipboard, LoaderCircle, PenLine, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkRewrite } from "@/lib/fact-guard";
import { WARNING_LABEL, wordDiff } from "@/lib/persona-ui";
import {
  LIMITS,
  type GuardWarning,
  type IdentityFact,
  type ResultSource,
  type RewriteResponse,
  type RewriteStyle,
  type RewriteVariation,
  type Segment,
} from "@/lib/schemas";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { checkLength, checkStyle } from "@/lib/style-check";

const STYLE_LABEL: Record<RewriteStyle, string> = {
  direct: "Option A: Direct",
  narrative: "Option B: Narrative",
};

/** Warnings whose text literally appears in the rewrite (fact and segment ids don't). */
const literal = (w: GuardWarning) =>
  w.kind !== "invalid_fact_id" && w.kind !== "unverified_segment" && w.kind !== "over_limit" && w.text.trim();

export function RewriteComparison(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  result: RewriteResponse | null;
  goal: string;
  loading: boolean;
  adversarial: boolean;
  onGoal: (goal: string) => void;
  onGenerate: () => void;
  onAdversarial: (enabled: boolean) => void;
  onError: (message: string) => void;
}) {
  const { result, goal, loading, adversarial, confirmedFacts, onGoal, onGenerate, onAdversarial } = props;
  const [style, setStyle] = useState<RewriteStyle>("direct");
  const variations = result?.variations ?? [];
  const shown = variations.find((v) => v.style === style) ?? variations[0];

  return (
    <section className="flow-section fade-in">
      <div className="results-heading">
        <h2 className="flow-title">
          <Sparkles />
          Your rewrite + FactCheck
        </h2>
        {result?.source === "sample" && <span className="sample-badge">Sample result</span>}
      </div>
      <div className="rewrite-options rewrite-options-goal">
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
            placeholder="What would you like to express more clearly?"
          />
        </div>
        <Button variant="aero" disabled={loading || !confirmedFacts.length} onClick={onGenerate}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {loading ? "Writing two versions..." : result ? "Rewrite again" : "Generate rewrites"}
        </Button>
      </div>
      <p className="empty-note">
        {confirmedFacts.length
          ? "You’ll get two versions from the same confirmed facts: a direct one and a narrative one. Neither may add anything you haven’t confirmed."
          : "Confirm at least one fact in Identity DNA before rewriting."}
      </p>
      {result && shown && (
        <>
          <label className="demo-toggle">
            <input type="checkbox" checked={adversarial} onChange={(event) => onAdversarial(event.target.checked)} />
            Show FactCheck demo {adversarial && <span className="test-badge">Intentional test case</span>}
          </label>
          {variations.length > 1 && (
            <div className="input-mode variation-tabs" role="tablist" aria-label="Rewrite versions">
              {variations.map((v) => (
                <Button
                  key={v.style}
                  variant="mode"
                  role="tab"
                  aria-selected={v.style === shown.style}
                  data-active={v.style === shown.style}
                  onClick={() => setStyle(v.style)}
                >
                  {STYLE_LABEL[v.style]}
                  {v.warnings.length > 0 && <span className="tab-count">{v.warnings.length}</span>}
                </Button>
              ))}
            </div>
          )}
          {/* Every version stays mounted so edits survive tab switches; keyed so a new result resets them. */}
          {variations.map((v) => (
            <div key={`${result.source}|${v.style}|${v.rewrite.content}`} hidden={v.style !== shown.style}>
              <VariationResult {...props} variation={v} source={result.source} />
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function VariationResult(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  variation: RewriteVariation;
  source: ResultSource;
  onError: (message: string) => void;
}) {
  const { original, segments, confirmedFacts, variation, source, onError } = props;
  const { rewrite } = variation;
  const [text, setText] = useState(rewrite.content);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Unedited: the server's checks. Edited: the same deterministic checks, re-run locally.
  const edited = text !== rewrite.content;
  const warnings = useMemo(
    () =>
      edited
        ? checkRewrite({ rewrite: { content: text, usedFactIds: rewrite.usedFactIds }, segments, facts: confirmedFacts })
        : variation.warnings,
    [edited, text, rewrite, variation, segments, confirmedFacts],
  );
  const styleWarnings = useMemo(() => {
    if (!edited) return variation.styleWarnings;
    const config = PLATFORM_CONFIGS[rewrite.platform];
    // Prompt answers are edited as one text, one answer per blank-line block; the limit is per answer.
    const pieces = config.input === "prompts" ? text.split(/\n\s*\n/) : [text];
    return [...checkStyle(text), ...checkLength(pieces, config.maxChars, config.label)];
  }, [edited, text, variation, rewrite.platform]);

  const diff = useMemo(() => wordDiff(original, text), [original, text]);
  const rangesFor = (list: GuardWarning[]) => {
    const content = text.toLowerCase();
    return list.filter(literal).flatMap((warning) => {
      const query = warning.text.toLowerCase();
      const ranges: { start: number; end: number }[] = [];
      for (let start = content.indexOf(query); start >= 0; start = content.indexOf(query, start + query.length)) {
        ranges.push({ start, end: start + query.length });
      }
      return ranges;
    });
  };
  const factRanges = rangesFor(warnings);
  const styleRanges = rangesFor(styleWarnings);
  const offsets = useMemo(() => {
    const starts: number[] = [];
    for (let i = 0, offset = 0; i < diff.revised.length; offset += diff.revised[i].text.length, i++) starts.push(offset);
    return starts;
  }, [diff]);
  const classFor = (index: number, changed: boolean) => {
    const start = offsets[index];
    const end = start + diff.revised[index].text.trimEnd().length;
    const hits = (ranges: { start: number; end: number }[]) => ranges.some((r) => start < r.end && end > r.start);
    if (hits(factRanges)) return "diff-flagged";
    if (hits(styleRanges)) return "diff-style";
    return changed ? "diff-added" : undefined;
  };

  const factText = new Map(confirmedFacts.map((fact) => [fact.id, fact.text]));
  const usedFactIds = [...new Set(rewrite.usedFactIds)];

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      onError("Clipboard access is unavailable. Select the rewrite text to copy it.");
    }
  }

  return (
    <>
      <div className="comparison-grid">
        <section className="profile-panel">
          <div className="panel-header">
            <h3 className="section-heading">Original</h3>
            <span className="empty-note">Removed words</span>
          </div>
          <div className="diff-body">
            {diff.original.map((token, index) => (
              <span key={index} className={token.changed ? "diff-removed" : undefined}>
                {token.text}
              </span>
            ))}
          </div>
        </section>
        <section className="profile-panel">
          <div className="panel-header">
            <h3 className="section-heading">Rewritten{edited ? " (edited)" : ""}</h3>
            <Button variant="link" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "Done editing" : "Edit text"}
            </Button>
          </div>
          {editing ? (
            <div className="profile-content">
              <textarea
                aria-label="Edit rewritten profile"
                className="profile-textarea"
                maxLength={LIMITS.maxRewriteChars}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setCopied(false);
                }}
              />
            </div>
          ) : (
            <div className="diff-body">
              {diff.revised.map((token, index) => (
                <span key={index} className={classFor(index, token.changed)}>
                  {token.text}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="factcheck-panel" data-warnings={warnings.length > 0} aria-live="polite">
        <h3 className="section-heading">
          <ShieldCheck />
          FactCheck
          {source === "sample" && <span className="sample-badge">Sample result</span>}
        </h3>
        {edited && <p className="empty-note">Re-checked against your edited text.</p>}
        {warnings.length === 0 ? (
          <p className="status-note">
            <Check />
            No unsupported concrete claims detected
          </p>
        ) : (
          <div className="guard-list">
            {warnings.map((warning, index) => (
              <div className="guard-item" key={index}>
                <TriangleAlert size={16} />
                <div>
                  <strong>{WARNING_LABEL[warning.kind]}</strong>
                  <q>{warning.text}</q>
                  <p>{warning.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="empty-note">
          FactCheck catches concrete claims like numbers, names, and inflated verbs. It can miss subtle exaggeration.
        </p>
      </section>
      {styleWarnings.length > 0 && (
        <section className="style-panel">
          <h3 className="section-heading">
            <PenLine />
            Style suggestions <span className="empty-note">(wording, not truth)</span>
          </h3>
          <div className="guard-list">
            {styleWarnings.map((warning, index) => (
              <div className="style-item" key={index}>
                <div>
                  <strong>{WARNING_LABEL[warning.kind]}</strong>
                  <q>{warning.text}</q>
                  <p>{warning.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="summary-grid">
        <section>
          <h3 className="section-heading">What changed</h3>
          <ul className="change-list">
            {rewrite.changeSummary.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="section-heading">
            Facts the AI says it used <span className="empty-note">(advisory)</span>
          </h3>
          <div className="fact-chips">
            {usedFactIds.map((id) => (
              <span className="fact-chip" key={id}>
                {factText.get(id) ?? `${id} (not one of your confirmed facts)`}
              </span>
            ))}
            {!usedFactIds.length && <span className="empty-note">None reported.</span>}
          </div>
        </section>
      </div>
      <div className="action-band">
        <span className="empty-note">Review your words before sharing them.</span>
        <Button variant="aero" onClick={() => void copy()}>
          {copied ? <Check /> : <Clipboard />}
          {copied ? "Copied" : warnings.length ? "Copy anyway" : "Copy"}
        </Button>
      </div>
    </>
  );
}
