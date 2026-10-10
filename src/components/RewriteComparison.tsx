"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNotice, SourceBadge, WARNING_LABEL } from "@/components/labels";
import { checkRewrite } from "@/lib/fact-guard";
import type {
  GuardWarning,
  IdentityFact,
  ResultSource,
  RewriteResponse,
  RewriteStyle,
  RewriteVariation,
  Segment,
} from "@/lib/schemas";
import { checkStyle } from "@/lib/style-check";
import { diffWordsWithSpace } from "diff";
import { useState, type ReactNode } from "react";

const STYLE_LABEL: Record<RewriteStyle, string> = {
  direct: "Option A: Direct",
  narrative: "Option B: Narrative",
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap flagged words in <mark>. Fact/segment-id warnings and emoji summaries aren't literal text, so they're skipped. */
function withFlags(text: string, facts: GuardWarning[], style: GuardWarning[]): ReactNode {
  const literal = (w: GuardWarning) =>
    w.kind !== "invalid_fact_id" && w.kind !== "unverified_segment" && !/emoji/.test(w.text) && w.text.trim();
  const factTerms = facts.filter(literal).map((w) => w.text.toLowerCase());
  const terms = [...facts, ...style]
    .filter(literal)
    .map((w) => escapeRegex(w.text))
    .sort((a, b) => b.length - a.length);
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className={`rounded px-0.5 ${
          factTerms.includes(part.toLowerCase())
            ? "bg-red-200 dark:bg-red-800/70"
            : "bg-amber-200 dark:bg-amber-800/70"
        }`}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function RewriteComparison(props: {
  original: string;
  segments: Segment[];
  confirmedFacts: IdentityFact[];
  goal: string;
  onGoalChange: (goal: string) => void;
  onGenerate: () => void;
  onShowAdversarial: () => void;
  result: RewriteResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const { goal, onGoalChange, onGenerate, onShowAdversarial, result, loading, error } = props;

  return (
    <section className="space-y-5">
      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-sm text-muted-foreground">
          You&apos;ll get two versions from the same confirmed facts: a direct one and a narrative one.
        </p>
        <div className="space-y-1">
          <Label htmlFor="goal">Goal (optional)</Label>
          <input
            id="goal"
            value={goal}
            maxLength={300}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="e.g. Make it clearer for technical recruiters"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onGenerate} disabled={loading}>
            {result ? "Rewrite again" : "Generate rewrites"}
          </Button>
          <Button type="button" variant="ghost" onClick={onShowAdversarial} disabled={loading}>
            Show FactCheck demo (intentional test case)
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Writing two grounded versions and running FactCheck...
        </p>
      )}
      {error && <ErrorNotice message={error} onRetry={onGenerate} />}

      {result && !loading && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Rewrite</h2>
            <span className="text-xs text-muted-foreground">Simulated AI rewrite</span>
            <SourceBadge source={result.source} />
          </div>
          {/* key resets tabs and edits whenever a new result arrives */}
          <Tabs key={result.variations.map((v) => v.rewrite.content).join("|")} defaultValue={result.variations[0].style}>
            {result.variations.length > 1 && (
              <TabsList>
                {result.variations.map((v) => (
                  <TabsTrigger key={v.style} value={v.style}>
                    {STYLE_LABEL[v.style]}
                    {v.warnings.length > 0 && <span className="ml-1 text-red-600">({v.warnings.length})</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            )}
            {result.variations.map((v) => (
              <TabsContent key={v.style} value={v.style} keepMounted className="pt-3">
                <VariationResult {...props} variation={v} source={result.source} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
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
}) {
  const { original, segments, confirmedFacts, variation, source } = props;
  const { rewrite } = variation;
  const [text, setText] = useState(rewrite.content);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Unedited: show the server's checks. Edited: re-run the same deterministic checks locally.
  const edited = text !== rewrite.content;
  const warnings = edited
    ? checkRewrite({ rewrite: { content: text, usedFactIds: rewrite.usedFactIds }, segments, facts: confirmedFacts })
    : variation.warnings;
  const styleWarnings = edited ? checkStyle(text) : variation.styleWarnings;

  const parts = diffWordsWithSpace(original, text);
  const factText = new Map(confirmedFacts.map((f) => [f.id, f.text]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setEditing(true); // fall back to letting the user select the text
    }
  };

  return (
    <div className="space-y-4">
      {source === "sample" && variation.warnings.length > 0 && (
        <p className="text-xs text-muted-foreground">Intentional test case: an exaggerated rewrite to show FactCheck.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-medium">Original</h3>
          <p className="whitespace-pre-wrap text-sm">
            {parts.map((p, i) =>
              p.added ? null : p.removed ? (
                <del key={i} className="bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200">{p.value}</del>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Rewritten{edited ? " (edited)" : ""}</h3>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
              {editing ? "Done" : "Edit"}
            </Button>
          </div>
          {editing ? (
            <Textarea aria-label="Edit rewritten text" value={text} rows={12} onChange={(e) => setText(e.target.value)} />
          ) : (
            <p className="whitespace-pre-wrap text-sm">
              {parts.map((p, i) =>
                p.removed ? null : p.added ? (
                  <ins key={i} className="bg-emerald-100 text-emerald-900 no-underline dark:bg-emerald-950 dark:text-emerald-100">
                    {withFlags(p.value, warnings, styleWarnings)}
                  </ins>
                ) : (
                  <span key={i}>{withFlags(p.value, warnings, styleWarnings)}</span>
                ),
              )}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-3" aria-live="polite">
        <h3 className="mb-2 text-sm font-medium">FactCheck</h3>
        {warnings.length === 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">No unsupported concrete claims detected.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {warnings.map((w, i) => (
              <li key={i} className="rounded-md bg-red-50 p-2 dark:bg-red-950">
                <span className="font-medium">{WARNING_LABEL[w.kind]}:</span> &ldquo;{w.text}&rdquo;
                <span className="block text-muted-foreground">{w.explanation}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          FactCheck catches concrete claims like numbers, names, and inflated verbs. It can miss subtle exaggeration.
        </p>
      </div>

      {styleWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-300 p-3 dark:border-amber-800">
          <h3 className="mb-2 text-sm font-medium">Style suggestions</h3>
          <ul className="space-y-1 text-sm">
            {styleWarnings.map((w, i) => (
              <li key={i}>
                <span className="font-medium">{WARNING_LABEL[w.kind]}:</span> &ldquo;{w.text}&rdquo;
                <span className="text-muted-foreground"> {w.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rewrite.changeSummary.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">What changed</h3>
          <ul className="list-disc pl-5 text-sm">
            {rewrite.changeSummary.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {rewrite.usedFactIds.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">Facts the AI says it used</h3>
          <div className="flex flex-wrap gap-1">
            {rewrite.usedFactIds.map((id) => (
              <span key={id} className="rounded-md border px-2 py-0.5 text-xs">
                {factText.get(id) ?? `${id} (not one of your confirmed facts)`}
              </span>
            ))}
          </div>
        </div>
      )}

      <Button type="button" onClick={copy}>
        {copied ? "Copied" : warnings.length ? "Copy anyway" : "Copy"}
      </Button>
    </div>
  );
}
