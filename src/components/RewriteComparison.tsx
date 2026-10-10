"use client";

import { Check, Clipboard, LoaderCircle, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkRewrite } from "@/lib/fact-guard";
import { WARNING_LABEL, wordDiff } from "@/lib/persona-ui";
import { LIMITS, type IdentityFact, type RewriteResponse, type RewriteTone, type Segment } from "@/lib/schemas";

export function RewriteComparison(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  result: RewriteResponse | null;
  tone: RewriteTone;
  goal: string;
  loading: boolean;
  adversarial: boolean;
  onTone: (tone: RewriteTone) => void;
  onGoal: (goal: string) => void;
  onGenerate: () => void;
  onAdversarial: (enabled: boolean) => void;
  onError: (message: string) => void;
}) {
  const { result, tone, goal, loading, adversarial, confirmedFacts, onTone, onGoal, onGenerate, onAdversarial } = props;
  return (
    <section className="flow-section fade-in">
      <div className="results-heading">
        <h2 className="flow-title">
          <Sparkles />
          Your rewrite + FactCheck
        </h2>
        {result?.source === "sample" && <span className="sample-badge">Sample result</span>}
      </div>
      <div className="rewrite-options">
        <div>
          <label className="field-label" htmlFor="tone">
            Your voice
          </label>
          <select
            id="tone"
            className="audience-select"
            value={tone}
            disabled={loading}
            onChange={(event) => onTone(event.target.value as RewriteTone)}
          >
            <option value="closer_to_my_words">Closer to my words</option>
            <option value="balanced">Balanced</option>
            <option value="more_playful">More playful</option>
          </select>
        </div>
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
          {loading ? "Rewriting..." : result ? "Rewrite again" : "Generate rewrite"}
        </Button>
      </div>
      <p className="empty-note">
        {confirmedFacts.length
          ? "The rewrite may only use your original text and the facts you confirmed."
          : "Confirm at least one fact in Identity DNA before rewriting."}
      </p>
      {result && (
        <>
          <label className="demo-toggle">
            <input type="checkbox" checked={adversarial} onChange={(event) => onAdversarial(event.target.checked)} />
            Show FactCheck demo {adversarial && <span className="test-badge">Intentional test case</span>}
          </label>
          {/* Keyed by the result, so edits reset whenever a new rewrite arrives. */}
          <RewriteResult key={`${result.source}|${result.rewrite.content}`} {...props} result={result} />
        </>
      )}
    </section>
  );
}

function RewriteResult(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  result: RewriteResponse;
  onError: (message: string) => void;
}) {
  const { original, segments, confirmedFacts, result, onError } = props;
  const [text, setText] = useState(result.rewrite.content);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Unedited: the server's FactCheck. Edited: the same deterministic check, re-run locally.
  const edited = text !== result.rewrite.content;
  const warnings = useMemo(
    () =>
      edited
        ? checkRewrite({ rewrite: { content: text, usedFactIds: result.rewrite.usedFactIds }, segments, facts: confirmedFacts })
        : result.warnings,
    [edited, text, result, segments, confirmedFacts],
  );

  const diff = useMemo(() => wordDiff(original, text), [original, text]);
  const warningRanges = useMemo(() => {
    const content = text.toLowerCase();
    return warnings.flatMap((warning) => {
      const query = warning.text.toLowerCase();
      if (!query) return [];
      const ranges: { start: number; end: number }[] = [];
      for (let start = content.indexOf(query); start >= 0; start = content.indexOf(query, start + query.length)) {
        ranges.push({ start, end: start + query.length });
      }
      return ranges;
    });
  }, [warnings, text]);
  const revisedOffsets = useMemo(() => {
    const starts: number[] = [];
    for (let i = 0, offset = 0; i < diff.revised.length; offset += diff.revised[i].text.length, i++) starts.push(offset);
    return starts;
  }, [diff]);
  const flagged = (index: number) => {
    const start = revisedOffsets[index];
    const end = start + diff.revised[index].text.trimEnd().length;
    return warningRanges.some((range) => start < range.end && end > range.start);
  };

  const factText = new Map(confirmedFacts.map((fact) => [fact.id, fact.text]));
  const usedFacts = [...new Set(result.rewrite.usedFactIds)].filter((id) => factText.has(id));

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
            <h3 className="section-heading">Rewritten</h3>
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
                <span key={index} className={flagged(index) ? "diff-flagged" : token.changed ? "diff-added" : undefined}>
                  {token.text}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="summary-grid">
        <section>
          <h3 className="section-heading">What changed</h3>
          <ul className="change-list">
            {result.rewrite.changeSummary.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="section-heading">
            Facts used <span className="empty-note">(advisory, as reported by the AI)</span>
          </h3>
          <div className="fact-chips">
            {usedFacts.map((id) => (
              <span className="fact-chip" key={id}>
                {factText.get(id)}
              </span>
            ))}
            {!usedFacts.length && <span className="empty-note">None reported.</span>}
          </div>
        </section>
      </div>
      <section className="factcheck-panel" data-warnings={warnings.length > 0}>
        <h3 className="section-heading">
          <ShieldCheck />
          FactCheck
          {result.source === "sample" && <span className="sample-badge">Sample result</span>}
        </h3>
        {edited && <p className="empty-note">Re-checked against your edited text.</p>}
        {warnings.length === 0 ? (
          <>
            <p className="status-note">
              <Check />
              No unsupported concrete claims detected
            </p>
            <p className="empty-note">
              FactCheck catches concrete claims like numbers, names, and inflated verbs. It can miss subtle
              exaggeration.
            </p>
          </>
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
      </section>
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
