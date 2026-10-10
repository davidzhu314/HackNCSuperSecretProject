"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorNotice } from "@/components/labels";
import { LIMITS, type IdentityFact } from "@/lib/schemas";
import { useState } from "react";

export function IdentityFacts(props: {
  facts: IdentityFact[];
  onChange: (facts: IdentityFact[]) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const { facts, onChange, loading, error, onRetry, onContinue } = props;
  const [draft, setDraft] = useState("");

  const update = (id: string, patch: Partial<IdentityFact>) =>
    onChange(facts.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const add = () => {
    const text = draft.trim();
    if (!text || facts.length >= LIMITS.maxFacts) return;
    // "u" prefix keeps user-added ids distinct from extracted f1, f2, ...
    const id = `u${Date.now().toString(36)}`;
    onChange([...facts, { id, text, confirmed: true, source: "user" }]);
    setDraft("");
  };

  const confirmedCount = facts.filter((f) => f.confirmed).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Identity DNA</h2>
        <p className="text-sm text-muted-foreground">
          Tick the facts that are true about you. Only ticked facts can be used in a rewrite.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground" aria-live="polite">Finding facts in your text...</p>}
      {error && <ErrorNotice message={error} onRetry={onRetry} />}

      {!loading && !error && facts.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No concrete facts found in your text. Add a few true facts about yourself.
        </p>
      )}

      <ul className="space-y-2">
        {facts.map((f) => (
          <li key={f.id} className="flex items-start gap-2 rounded-lg border p-2">
            <Checkbox
              className="mt-2"
              aria-label={`Confirm: ${f.text}`}
              checked={f.confirmed}
              onCheckedChange={(c) => update(f.id, { confirmed: c === true })}
            />
            <div className="min-w-0 flex-1">
              <textarea
                aria-label="Fact text"
                value={f.text}
                maxLength={LIMITS.factText}
                rows={1}
                onChange={(e) => update(f.id, { text: e.target.value })}
                className="field-sizing-content w-full resize-none rounded-md bg-transparent px-2 py-1 text-sm"
              />
              <span className="px-2 text-xs text-muted-foreground">
                {f.source === "extracted" ? "Suggested by AI" : "Added by you"}
              </span>
            </div>
            <button
              type="button"
              aria-label="Remove fact"
              className="shrink-0 px-1 pt-1 text-muted-foreground hover:text-foreground"
              onClick={() => onChange(facts.filter((x) => x.id !== f.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          aria-label="New fact"
          value={draft}
          maxLength={LIMITS.factText}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a true fact, e.g. I built a budgeting app in Swift."
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim() || facts.length >= LIMITS.maxFacts}>
          Add
        </Button>
      </div>

      <Button type="button" onClick={onContinue} disabled={loading}>
        Continue with {confirmedCount} confirmed {confirmedCount === 1 ? "fact" : "facts"}
      </Button>
    </section>
  );
}
