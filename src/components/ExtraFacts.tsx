"use client";

import { Plus, ShieldAlert, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { useState } from "react";
import { FactCheckDetail, type LieCheck } from "@/components/FactCheckDetail";
import { Button } from "@/components/ui/button";
import type { IdentityFact } from "@/lib/schemas";

/**
 * True facts about you that aren't in your text, added on the rewrite step (every platform). Like
 * your own words, they are evidence: rewrites may use them and FactCheck accepts them. With `lieCheck`,
 * each fact shows whether it's consistent with the user's own profile and other facts (Lie Checker).
 */
export function ExtraFacts(props: {
  facts: IdentityFact[];
  /** What the user's own text is called here: "profile", "bio", "answers". */
  what: string;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  lieCheck?: LieCheck;
}) {
  const { facts, what, onAdd, onRemove, lieCheck } = props;
  const [factDraft, setFactDraft] = useState("");
  const flagged = lieCheck ? facts.filter((f) => lieCheck.views[f.id]?.status === "flagged").length : 0;
  // The rules are instant and free, so the draft is checked as it's typed. Adding is never blocked.
  const draftIssue = lieCheck?.checkDraft(factDraft)[0];
  return (
    <details className="extra-facts">
      <summary>
        Add something that isn&apos;t in your {what}{facts.length ? ` (${facts.length})` : ""}
        {flagged > 0 && <span className="extra-facts-flagged"> · {flagged} flagged by Lie Checker</span>}
      </summary>
      {lieCheck && (
        <p className="lie-check-note">
          <ShieldCheck size={13} aria-hidden />
          <span>
            Lie Checker compares each fact you add with your {what} and your other facts, and flags anything
            inconsistent or overstated.{" "}
            {lieCheck.canCheck
              ? "It can’t know what’s true, only what doesn’t add up."
              : "Only the built-in rules run here: the AI check needs your consent and is off in sample mode."}
          </span>
        </p>
      )}
      {facts.length > 0 && (
        <ul>
          {facts.map((f) => {
            const view = lieCheck?.views[f.id];
            const detailId = `fact-check-${f.id}`;
            const showDetail = !!view && (view.status !== "unverified" || view.checked || view.issues.length > 0);
            return (
              <li key={f.id} data-check={view?.status}>
                <span aria-describedby={showDetail ? detailId : undefined}>{f.text}</span>
                <Button variant="ghost" size="icon" aria-label={`Remove: ${f.text}`} onClick={() => onRemove(f.id)}>
                  <X />
                </Button>
                {lieCheck && view && showDetail && (
                  <FactCheckDetail id={detailId} view={view} canCheck={lieCheck.canCheck} onRecheck={() => lieCheck.onCheck(f.id)} />
                )}
                {lieCheck && view && !showDetail && lieCheck.canCheck && (
                  <button type="button" className="fact-check-link" onClick={() => lieCheck.onCheck(f.id)}>
                    <ShieldQuestion size={12} aria-hidden /> Check this fact
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="custom-question-row">
        <label className="sr-only" htmlFor="extra-fact">
          A true fact about you that isn&apos;t in your {what}
        </label>
        <input
          id="extra-fact"
          className="goal-input"
          maxLength={300}
          value={factDraft}
          placeholder="e.g. I presented my research at a regional conference"
          onChange={(event) => setFactDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && factDraft.trim()) {
              onAdd(factDraft);
              setFactDraft("");
            }
          }}
        />
        <Button
          variant="glass"
          size="sm"
          disabled={!factDraft.trim()}
          onClick={() => {
            onAdd(factDraft);
            setFactDraft("");
          }}
        >
          <Plus />
          Add
        </Button>
      </div>
      {draftIssue && (
        <p className="fact-check-draft" role="status">
          <ShieldAlert size={12} aria-hidden /> {draftIssue.explanation} You can still add it.
        </p>
      )}
    </details>
  );
}
