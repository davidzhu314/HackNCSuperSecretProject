"use client";

import { Copy, LoaderCircle, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// "Fill from your other profiles", on every platform's profile step. Fill copies the user's own
// sentences and shared fields into empty spots (no AI). Draft with AI writes new wording from the
// same material; sentences FactCheck can't trace are removed before they appear. Neither ever
// overwrites anything the user typed, and nothing happens until a button is pressed.

export type AutofillResult = { kind: "fill" | "draft"; notes: string[]; dropped: string[] };

export function AutofillPanel(props: {
  /** Where material comes from, e.g. ["LinkedIn", "Hinge", "3 facts"]. Empty: nothing to fill from. */
  sources: string[];
  /** Fill has something to put in an empty spot. */
  canFill: boolean;
  /** There are empty spots an AI draft could fill. */
  canDraft: boolean;
  drafting: boolean;
  /** Sample mode sends nothing, so it can't draft. */
  draftDisabledReason?: string;
  result: AutofillResult | null;
  onFill: () => void;
  onDraft: () => void;
}) {
  const { sources, canFill, canDraft, drafting, draftDisabledReason, result, onFill, onDraft } = props;
  return (
    <div className="autofill-panel">
      <h2 className="section-heading seed-heading">
        <Wand2 />
        Fill from your other profiles
      </h2>
      {sources.length ? (
        <p className="section-subtitle">
          Uses what you entered on {listOf(sources)}. Only empty spots get filled; nothing you typed changes.
        </p>
      ) : (
        <p className="section-subtitle">
          Add your profile on another platform, or confirm facts in the Hub, and you can fill this one from it.
        </p>
      )}
      {sources.length > 0 && (
        <div className="autofill-actions">
          <Button variant="glass" disabled={!canFill || drafting} onClick={onFill} title="Copies your own sentences and fields. No AI.">
            <Copy />
            Fill empty spots
          </Button>
          <Button
            variant="glass"
            disabled={!canDraft || drafting || !!draftDisabledReason}
            onClick={onDraft}
            title={draftDisabledReason ?? "Writes new wording from your own text and facts. Uses AI."}
          >
            {drafting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {drafting ? "Drafting…" : "Draft with AI"}
          </Button>
        </div>
      )}
      {sources.length > 0 && (
        <p className="empty-note autofill-help">
          Fill copies your own sentences word for word (no AI). Draft with AI rewords them to fit this platform; any
          sentence FactCheck can’t trace to your words is removed.
          {!canFill && !canDraft && " Everything here is already filled in."}
          {!canFill && canDraft && " Nothing from them fits here word for word yet; Draft with AI can reword it."}
        </p>
      )}
      {result && (
        <div className="autofill-result" role="status">
          {result.notes.length ? (
            <ul>
              {result.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : (
            <p>{result.kind === "fill" ? "Nothing to copy into the empty spots." : "The AI found nothing it could draft from your sources."}</p>
          )}
          {result.dropped.length > 0 && (
            <details>
              <summary>
                Removed {result.dropped.length} {result.dropped.length === 1 ? "sentence" : "sentences"} FactCheck couldn’t
                trace
              </summary>
              <ul>
                {result.dropped.map((s) => (
                  <li key={s}>
                    <q>{s}</q>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="empty-note">{result.kind === "draft" ? "AI draft: review it before you use it." : "Copied from your own words."}</p>
        </div>
      )}
    </div>
  );
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
