"use client";

import { Check, CircleAlert, Clipboard, Download, FileCheck, LoaderCircle, PenLine, ShieldCheck, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExtraFacts } from "@/components/ExtraFacts";
import { LengthSlider } from "@/components/SectionRewrites";
import type { LieCheck } from "@/components/FactCheckDetail";
import { Button } from "@/components/ui/button";
import { checkRewrite } from "@/lib/fact-guard";
import { scoreRewrite, type RewriteScorecard } from "@/lib/lint";
import { WARNING_LABEL, wordDiff } from "@/lib/persona-ui";
import { buildProofText } from "@/lib/proof";
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
  type LengthStep,
  type RewriteTone,
} from "@/lib/schemas";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { checkLength, checkStyle } from "@/lib/style-check";
import { checkTinderLength, TINDER_ABOUT_PROMPT, tinderLimitFor } from "@/lib/tinder";
import { findRepeatedPhrases, type QualityField } from "@/lib/profile-quality";
import { comparisonSummary, applyLabel, type AnsweredComparison as ScoreComparison } from "@/lib/answered";
import { ProgressBar } from "@/components/ProgressBar";
import { EXPECTED_MS } from "@/lib/progress";

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
const literal = (w: GuardWarning) =>
  w.kind !== "invalid_fact_id" && w.kind !== "unverified_segment" && w.kind !== "over_limit" && w.text.trim();

export function RewriteComparison(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  /** Tinder: the profile fields sent with the rewrite. Sources for FactCheck and receipts, not removable facts. */
  fieldFacts?: IdentityFact[];
  result: RewriteResponse | null;
  goal: string;
  loading: boolean;
  adversarial: boolean;
  onGoal: (goal: string) => void;
  onGenerate: () => void;
  onAdversarial: (enabled: boolean) => void;
  onError: (message: string) => void;
  /** What the user's own text is called here ("answers", "bio", ...), for the add-a-fact box. */
  textName: string;
  onAddFact: (text: string) => void;
  onRemoveFact: (id: string) => void;
  lieCheck?: LieCheck;
  qualityFields?: QualityField[];
  qualityTargetKey?: string;
  use?: { current: string; applied: boolean; onUse: (text: string) => void; onUndo: () => void };
  /** `fresh`: ask the lenses again even if this text was read before (otherwise a remembered read is reused). */
  onScore?: (text: string, key?: string, fresh?: boolean) => Promise<ScoreComparison>;
  /** Tone and length controls: one version per setting, like LinkedIn's style and length. */
  tones: { id: RewriteTone; label: string; summary: string }[];
  tone: RewriteTone;
  length: LengthStep;
  onTone: (tone: RewriteTone) => void;
  /** `commit`: the slider was released (generate); otherwise it's only moving. */
  onLength: (length: LengthStep, commit: boolean) => void;
}) {
  const { result, goal, loading, adversarial, confirmedFacts, onGoal, onGenerate, onAdversarial, tones, tone, length, onTone, onLength } = props;
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
        <details className="rewrite-goal">
          <summary>{goal.trim() ? "Rewrite focus added" : "Add an optional focus"}</summary>
          <label className="field-label" htmlFor="rewrite-goal">What should this version emphasize?</label>
          <input id="rewrite-goal" className="goal-input" maxLength={300} value={goal} onChange={(event) => onGoal(event.target.value)} placeholder="e.g. make my interests clearer" />
        </details>
        <div>
          <label className="field-label" htmlFor="rewrite-tone">
            Tone
          </label>
          <select id="rewrite-tone" className="audience-select" value={tone} disabled={loading} onChange={(event) => onTone(event.target.value as RewriteTone)}>
            {tones.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="style-summary">{tones.find((t) => t.id === tone)?.summary}</p>
        </div>
        <div>
          <span className="field-label">Length</span>
          <LengthSlider
            id="rewrite-length"
            label="Length"
            value={length}
            disabled={loading}
            onChange={(next) => onLength(next, false)}
            onCommit={(next) => onLength(next, true)}
          />
        </div>
        <Button variant="aero" disabled={loading} onClick={onGenerate}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {loading ? "Rewriting…" : result ? "Rewrite again" : "Generate rewrite"}
        </Button>
      </div>
      <ProgressBar active={loading} label="Writing your rewrite and running FactCheck…" expectedMs={EXPECTED_MS.rewrite} />
      <ExtraFacts facts={confirmedFacts} what={props.textName} onAdd={props.onAddFact} onRemove={props.onRemoveFact} lieCheck={props.lieCheck} />
      <p className="empty-note">
        Pick a tone and a length. The rewrite uses only your own words and any facts you add; each setting you try is kept,
        so you can switch back.
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
              <VariationResult
                {...props}
                autoScore={v.style === shown.style}
                confirmedFacts={[...confirmedFacts, ...(props.fieldFacts ?? [])]}
                variation={v}
                source={result.source}
              />
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
  autoScore?: boolean;
  /**
   * LinkedIn sections: put this version (as edited) into the profile. `current` is the section's
   * profile text now; `applied` says whether it is an accepted rewrite.
   */
  use?: { current: string; applied: boolean; onUse: (text: string) => void; onUndo: () => void };
  /** `fresh`: ask the lenses again even if this text was read before (otherwise a remembered read is reused). */
  onScore?: (text: string, key?: string, fresh?: boolean) => Promise<ScoreComparison>;
  /** What this text is (a LinkedIn section's label); defaults to the platform's field. For the export. */
  section?: string;
  qualityFields?: QualityField[];
  qualityTargetKey?: string;
}) {
  const { original, segments, confirmedFacts, variation, source, onError, use } = props;
  const { rewrite } = variation;
  const [text, setText] = useState(rewrite.content);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [scoring, setScoring] = useState(false);
  const [scoreComparison, setScoreComparison] = useState<ScoreComparison | null>(null);
  const autoScored = useRef<typeof rewrite | null>(null);
  const autoScoreRef = useRef(props.autoScore);
  const scoreRef = useRef(props.onScore);
  const errorRef = useRef(props.onError);
  scoreRef.current = props.onScore;
  errorRef.current = props.onError;
  autoScoreRef.current = props.autoScore;

  useEffect(() => {
    if (!autoScoreRef.current || source === "sample" || !scoreRef.current) return;
    if (autoScored.current === rewrite) return;
    autoScored.current = rewrite;
    setScoring(true);
    setScoreComparison(null);
    void scoreRef.current(rewrite.content, props.qualityTargetKey)
      .then(setScoreComparison)
      .catch((error) => errorRef.current(error instanceof Error ? error.message : "Could not compare rewrite scores."))
      .finally(() => setScoring(false));
  }, [props.autoScore, props.qualityTargetKey, rewrite, source]);

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
    if (config.input === "tinder") return [...checkStyle(text), ...checkTinderLength(text.split(/\n\s*\n/), segments)];
    const pieces = config.input === "prompts" ? text.split(/\n\s*\n/) : [text];
    return [...checkStyle(text), ...checkLength(pieces, config.maxChars, config.label)];
  }, [edited, text, variation, rewrite.platform, segments]);
  const qualityFields = useMemo(() => {
    if (props.qualityFields) return props.qualityFields.map((field) => (field.key === props.qualityTargetKey ? { ...field, text } : field));
    const config = PLATFORM_CONFIGS[rewrite.platform];
    if (config.input === "tinder") {
      // Tinder: About me (if any), then one answer per prompt, each against its own limit.
      let answer = 0;
      return text.split(/\n\s*\n/).map((value, i) => {
        const prompt = segments[i]?.prompt;
        const label = prompt === TINDER_ABOUT_PROMPT ? config.fieldLabel : `Answer ${++answer}`;
        return { key: `piece-${i}`, label, text: value, limit: tinderLimitFor(prompt) };
      });
    }
    return config.input === "prompts"
      ? text.split(/\n\s*\n/).map((value, i) => ({ key: `answer-${i}`, label: `Answer ${i + 1}`, text: value, limit: config.maxChars }))
      : [{ key: "profile", label: config.fieldLabel, text, limit: config.maxChars }];
  }, [props.qualityFields, props.qualityTargetKey, rewrite.platform, text, segments]);
  const repeated = useMemo(() => findRepeatedPhrases(qualityFields), [qualityFields]);

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

  // Real counts, never a score: what changed between your text and this version.
  const scorecard = useMemo(() => {
    const factIds = new Set(receipts.flatMap((r) => r.sources.filter((src) => src.kind === "fact").map((src) => src.id)));
    return scoreRewrite(original, text, factIds.size);
  }, [original, text, receipts]);

  // "Prove it": the text with a source for every sentence and the FactCheck result.
  const proof = () =>
    buildProofText({
      platformLabel: PLATFORM_CONFIGS[rewrite.platform].label,
      section: props.section ?? PLATFORM_CONFIGS[rewrite.platform].fieldLabel,
      text,
      segments,
      facts: confirmedFacts,
      warnings,
    });
  const [proofCopied, setProofCopied] = useState(false);
  async function copyProof() {
    try {
      await navigator.clipboard.writeText(proof());
      setProofCopied(true);
    } catch {
      onError("Clipboard access is unavailable. Use Download instead.");
    }
  }
  function downloadProof() {
    const url = URL.createObjectURL(new Blob([proof()], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    const name = `${PLATFORM_CONFIGS[rewrite.platform].label}-${props.section ?? PLATFORM_CONFIGS[rewrite.platform].fieldLabel}`;
    a.href = url;
    a.download = `personify-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-with-sources.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
              <Button variant="link" size="sm" onClick={() => { if (editing && text !== rewrite.content) setHistory((items) => [...items, rewrite.content].slice(-8)); setEditing(!editing); }}>
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
                  setScoreComparison(null);
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
                    <span className="receipt-src">
                      {source.kind === "segment" ? "Your profile" : /^p\d$/.test(source.id) ? "Your profile field" : "Your fact"}
                    </span>
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
      <section className="readiness-panel" aria-label="Profile readiness checks">
        <div className="readiness-head"><strong>Ready to use?</strong><span>{qualityFields.every((f) => !f.limit || f.text.length <= f.limit) ? "Fits platform limits" : "Check flagged limits"}</span></div>
        {qualityFields.some((field) => field.limit && field.text.length > field.limit) && <p className="readiness-warning">Over limit: {qualityFields.filter((field) => field.limit && field.text.length > field.limit).map((field) => field.label).join(", ")}</p>}
        {repeated.length > 0 && <p className="readiness-warning">Repeated wording: {repeated.slice(0, 2).map((item) => `“${item.phrase}”`).join("; ")}</p>}
      </section>
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
      <Scorecard card={scorecard} />
      <details className="change-details"><summary>Key improvements</summary><ul className="change-list">{rewrite.changeSummary.slice(0, 3).map((change, index) => <li key={index}>{change}</li>)}</ul></details>
      {usedFactIds.length > 0 && <details className="change-details"><summary>Confirmed facts used</summary><p className="empty-note">{usedFactIds.map((id) => factText.get(id) ?? `${id} (not a confirmed fact)`).join("; ")}</p></details>}
      <div className="action-band">
        <span className="empty-note">
          {use?.applied && inUse ? "Selected as your current draft." : "Review your words before sharing them."}
        </span>
        {scoreComparison && (
          <span className="score-comparison-note" data-verdict={scoreComparison.verdict} role="status">
            In this AI check: {comparisonSummary(scoreComparison)} See what changed below.
          </span>
        )}
        <div className="action-buttons">
          {props.onScore && <Button variant="glass" disabled={scoring || source === "sample"} title={source === "sample" ? "Sample mode doesn't send text to the AI" : "Have the lenses you picked read this version, and count which of their questions it answers"} onClick={async () => { setScoring(true); setScoreComparison(null); try { setScoreComparison(await props.onScore?.(text, props.qualityTargetKey, scoreComparison !== null) ?? null); } catch (error) { onError(error instanceof Error ? error.message : "Couldn't get the lenses' read on this version. Try again."); } finally { setScoring(false); } }}>
            {scoring ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {scoring ? "Asking the lenses…" : scoreComparison ? "Ask the lenses again" : "Ask the same lenses"}
          </Button>}
          {history.length > 0 && <details className="version-history"><summary>Version history ({history.length})</summary>{history.map((version, index) => <button type="button" key={`${index}-${version}`} onClick={() => { setHistory((items) => [...items, text].slice(-8)); setText(version); setEditing(false); }}>{`Restore version ${index + 1}`}</button>)}</details>}
          {use?.applied && (
            <Button variant="ghost" onClick={use.onUndo}>
              <Undo2 />
              Undo
            </Button>
          )}
          <Button variant="ghost" onClick={() => void copyProof()} title="The text with a source for every sentence and the FactCheck result">
            {proofCopied ? <Check /> : <FileCheck />}
            {proofCopied ? "Copied with sources" : "Copy with sources"}
          </Button>
          <Button variant="ghost" size="icon" onClick={downloadProof} aria-label="Download with sources" title="Download with sources">
            <Download />
          </Button>
          <Button variant={use ? "glass" : "aero"} onClick={() => void copy()}>
            {copied ? <Check /> : <Clipboard />}
            {copied ? "Copied" : warnings.length ? "Copy anyway" : "Copy"}
          </Button>
          {use && (
            <Button variant="aero" disabled={inUse} onClick={() => use.onUse(text)}>
              <Check />
              {inUse ? "In your profile" : applyLabel(scoreComparison, warnings.length > 0)}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/** Before → after counts for one rewrite. Counted by code from the two texts; never a score. */
function Scorecard({ card }: { card: RewriteScorecard }) {
  const items = [
    { label: "Buzzwords", before: card.buzzwordsBefore, after: card.buzzwordsAfter, better: card.buzzwordsAfter < card.buzzwordsBefore },
    { label: "Specifics", before: card.specificsBefore, after: card.specificsAfter, better: card.specificsAfter > card.specificsBefore },
  ];
  return (
    <div className="scorecard" aria-label="Before and after, counted by code">
      {items.map((item) => (
        <span key={item.label} className="scorecard-item" data-better={item.better}>
          <span className="scorecard-label">{item.label}</span>
          <span className="scorecard-value">
            {item.before.toLocaleString()} → {item.after.toLocaleString()}
          </span>
        </span>
      ))}
      <span className="scorecard-item">
        <span className="scorecard-label">Your facts used</span>
        <span className="scorecard-value">{card.factsUsed}</span>
      </span>
      <span className="scorecard-note">Counted by code, not AI</span>
    </div>
  );
}
