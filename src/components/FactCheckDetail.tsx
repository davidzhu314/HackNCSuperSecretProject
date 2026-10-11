"use client";

import { LoaderCircle, RotateCw, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { FactCheckStatus, FactCheckView, FactIssue } from "@/lib/fact-claims";

/** What the studio hands to ExtraFacts so each fact shows its Lie Checker result. */
export type LieCheck = {
  /** fact id -> what to show for it. */
  views: Record<string, FactCheckView>;
  /** The AI check runs only after consent and never in sample mode; the rules always run. */
  canCheck: boolean;
  onCheck: (factId: string) => void;
  /** Rule-based issues for text that hasn't been added yet (shown while typing). */
  checkDraft: (text: string) => FactIssue[];
};

const STATUS_ICON: Record<FactCheckStatus, typeof ShieldCheck> = {
  verified: ShieldCheck,
  unverified: ShieldQuestion,
  pending_check: LoaderCircle,
  flagged: ShieldAlert,
};

/** The Lie Checker result under a fact: status, why, the line it was compared with, and Re-check. Never blocks saving. */
export function FactCheckDetail(props: { id: string; view: FactCheckView; canCheck: boolean; onRecheck: () => void }) {
  const { id, view, canCheck, onRecheck } = props;
  const Icon = STATUS_ICON[view.status];
  // When the AI flagged it, its reason is the headline and every rule-based issue is listed below;
  // otherwise the first rule-based issue is the headline.
  const aiFlagged = view.status === "flagged" && !!view.ai && ["exaggerated", "contradicts"].includes(view.ai.verdict);
  const extra = aiFlagged ? view.issues : view.issues.slice(1);
  const compared = view.issues.find((i) => i.source)?.source ?? view.ai?.evidence[0];
  return (
    <div className="fact-check" data-status={view.status} id={id} role="status" aria-live="polite">
      <p className="fact-check-head">
        <span className="fact-check-badge">
          <Icon size={12} className={view.status === "pending_check" ? "animate-spin" : undefined} aria-hidden />
          {view.label}
        </span>
        <span>{view.detail}</span>
      </p>
      {extra.map((issue) => (
        <p key={`${issue.kind}-${issue.text}`}>{issue.explanation}</p>
      ))}
      {view.status === "flagged" && compared && (
        <p className="fact-check-source">
          Compared with: <q>{compared.text}</q>
        </p>
      )}
      {view.ai?.suggestion && <p>Try: {view.ai.suggestion}</p>}
      {view.error && view.status === "flagged" && <p>The AI check didn’t run: {view.error}</p>}
      {view.status !== "pending_check" && canCheck && (
        <button type="button" className="fact-check-link" onClick={onRecheck}>
          <RotateCw size={11} aria-hidden /> {view.checked ? "Re-check" : "Check with AI"}
        </button>
      )}
    </div>
  );
}
