"use client";

import { Check, CircleAlert, Clipboard, LoaderCircle, PenLine, ShieldCheck, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkRewrite } from "@/lib/fact-guard";
import { WARNING_LABEL, wordDiff } from "@/lib/persona-ui";
import { traceSentences, type ReceiptStatus } from "@/lib/provenance";
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
import { checkStyle } from "@/lib/style-check";

const RECEIPT_LABEL: Record<ReceiptStatus, string> = {
  traced: "Traced",
  weak: "Partly traced",
  untraced: "No source",
};

const STYLE_LABEL: Record<RewriteStyle, string> = {
  direct: "Option A: Direct",
  narrative: "Option B: Narrative",
};

/** Warnings whose text literally appears in the rewrite (fact and segment ids don't). */
const literal = (w: GuardWarning) => w.kind !== "invalid_fact_id" && w.kind !== "unverified_segment" && w.text.trim();

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

/**
 * Group the diff's tokens into the sentences they belong to (by character offset), so each
 * sentence can be clicked for its receipt. Tokens outside any sentence get sentence -1.
 */
function groupBySentence(count: number, offsets: number[], ranges: { start: number; end: number }[]) {
  const groups: { sentence: number; indices: number[] }[] = [];
  for (let i = 0; i < count; i++) {
    const at = offsets[i];
    const sentence = ranges.findIndex((r) => r.start >= 0 && at >= r.start && at < r.end);
    const last = groups[groups.length - 1];
    if (last && last.sentence === sentence) last.indices.push(i);
    else groups.push({ sentence, indices: [i] });
  }
  return groups;
}

export function VariationResult(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  /** The style isn't shown here, so any style works (Hinge's two, or a LinkedIn section's three). */
  variation: Omit<RewriteVariation, "style">;
  source: ResultSource;
  onError: (message: string) => void;
  /**
   * LinkedIn sections: put this version (as edited) into the profile. `current` is the section's
   * profile text now; `applied` says whether it is an accepted rewrite.
   */
  use?: { current: string; applied: boolean; onUse: (text: string) => void; onUndo: () => void };
}) {
  const { original, segments, confirmedFacts, variation, source, onError, use } = props;
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
  const styleWarnings = useMemo(() => (edited ? checkStyle(text) : variation.styleWarnings), [edited, text, variation]);

  const diff = useMemo(() => wordDiff(original, text), [original, text]);
  const receipts = useMemo(() => traceSentences(text, segments, confirmedFacts), [text, segments, confirmedFacts]);
  // Where each receipt's sentence sits in the text, so the rewritten text can be clicked by sentence.
  const sentenceRanges = useMemo(() => {
    let from = 0;
    return receipts.map((r) => {
      const start = text.indexOf(r.text, from);
      if (start < 0) return { start: -1, end: -1 };
      from = start + r.text.length;
      return { start, end: from };
    });
  }, [receipts, text]);
  const [openSentence, setOpenSentence] = useState<number | null>(null);
  const [showChecks, setShowChecks] = useState(false);
  // Concrete problems (a number, name, stronger verb, or bad fact id) vs. "review this sentence".
  const concrete = warnings.filter((w) => w.kind !== "unsupported_claim");
  const checkState = !warnings.length ? "clean" : concrete.length ? "problem" : "review";
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

  const inUse = !!use?.applied && use.current.trim() === text.trim();

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
            <span className="panel-tools">
              <button
                type="button"
                className="check-badge"
                data-state={checkState}
                aria-expanded={showChecks}
                aria-label={
                  checkState === "clean"
                    ? "FactCheck: no unsupported concrete claims detected"
                    : `FactCheck: ${warnings.length} to review`
                }
                title={checkState === "clean" ? "No unsupported concrete claims detected" : `${warnings.length} to review`}
                onClick={() => setShowChecks(!showChecks)}
              >
                {checkState === "clean" ? <Check /> : checkState === "review" ? <TriangleAlert /> : <CircleAlert />}
                {warnings.length > 0 && <span>{warnings.length}</span>}
                {source === "sample" && <span className="sr-only"> (sample result)</span>}
              </button>
              {styleWarnings.length > 0 && (
                <button
                  type="button"
                  className="check-badge"
                  data-state="style"
                  aria-expanded={showChecks}
                  aria-label={`${styleWarnings.length} style suggestion${styleWarnings.length === 1 ? "" : "s"}`}
                  title="Style suggestions"
                  onClick={() => setShowChecks(!showChecks)}
                >
                  <PenLine />
                  <span>{styleWarnings.length}</span>
                </button>
              )}
              <Button variant="link" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? "Done editing" : "Edit text"}
              </Button>
            </span>
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
              {groupBySentence(diff.revised.length, offsets, sentenceRanges).map((group) => {
                const tokens = group.indices.map((index) => (
                  <span key={index} className={classFor(index, diff.revised[index].changed)}>
                    {diff.revised[index].text}
                  </span>
                ));
                if (group.sentence < 0) return <span key={`t${group.indices[0]}`}>{tokens}</span>;
                const r = receipts[group.sentence];
                return (
                  <span
                    key={`s${group.indices[0]}`}
                    role="button"
                    tabIndex={0}
                    className="sentence"
                    data-status={r.status}
                    data-open={openSentence === group.sentence}
                    title="Where this sentence comes from"
                    onClick={() => setOpenSentence(openSentence === group.sentence ? null : group.sentence)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpenSentence(openSentence === group.sentence ? null : group.sentence);
                      }
                    }}
                  >
                    {tokens}
                  </span>
                );
              })}
            </div>
          )}
          {!editing && openSentence !== null && receipts[openSentence] && (
            <div className="receipt-pop" data-status={receipts[openSentence].status} role="status">
              <strong>{RECEIPT_LABEL[receipts[openSentence].status]}</strong>
              {receipts[openSentence].sources.length ? (
                receipts[openSentence].sources.map((source) => (
                  <p key={`${source.kind}|${source.id}`}>
                    <span className="receipt-src">{source.kind === "segment" ? "Your profile" : "Your fact"}</span>
                    {source.kind === "segment" && source.prompt && <strong className="source-prompt">{source.prompt}</strong>}
                    {source.text}
                  </p>
                ))
              ) : (
                <p>Nothing in your profile or facts supports this. Review it before using it.</p>
              )}
            </div>
          )}
        </section>
      </div>
      {showChecks && (warnings.length > 0 || styleWarnings.length > 0 || edited) && (
        <section className="checks-pop" aria-live="polite">
          {edited && <p className="empty-note">Re-checked against your edited text.</p>}
          {warnings.map((warning, index) => (
            <div className="guard-item" key={`f${index}`}>
              {warning.kind === "unsupported_claim" ? <TriangleAlert size={16} /> : <CircleAlert size={16} />}
              <div>
                <strong>{WARNING_LABEL[warning.kind]}</strong> <q>{warning.text}</q>
                <p>{warning.explanation}</p>
              </div>
            </div>
          ))}
          {styleWarnings.map((warning, index) => (
            <div className="style-item" key={`s${index}`}>
              <PenLine size={16} />
              <div>
                <strong>{WARNING_LABEL[warning.kind]}</strong> <q>{warning.text}</q>
                <p>{warning.explanation}</p>
              </div>
            </div>
          ))}
        </section>
      )}
      {showChecks && !warnings.length && !styleWarnings.length && !edited && (
        <p className="checks-pop status-note">
          <ShieldCheck size={15} />
          No unsupported concrete claims detected.
        </p>
      )}
      <details className="change-details">
        <summary>What changed</summary>
        <ul className="change-list">
          {rewrite.changeSummary.map((change, index) => (
            <li key={index}>{change}</li>
          ))}
        </ul>
        {usedFactIds.length > 0 && (
          <p className="empty-note">
            Facts the AI says it used (advisory): {usedFactIds.map((id) => factText.get(id) ?? `${id} (not a confirmed fact)`).join("; ")}
          </p>
        )}
      </details>
      <div className="action-band">
        <span className="empty-note">
          {use?.applied && inUse ? "This version is in your profile." : "Review your words before sharing them."}
        </span>
        <div className="action-buttons">
          {use?.applied && (
            <Button variant="ghost" onClick={use.onUndo}>
              <Undo2 />
              Undo
            </Button>
          )}
          <Button variant={use ? "glass" : "aero"} onClick={() => void copy()}>
            {copied ? <Check /> : <Clipboard />}
            {copied ? "Copied" : warnings.length ? "Copy anyway" : "Copy"}
          </Button>
          {use && (
            <Button variant="aero" disabled={inUse} onClick={() => use.onUse(text)}>
              <Check />
              {inUse ? "In your profile" : warnings.length ? "Use anyway" : "Use this version"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
