"use client";

import { ArrowRight, Dna, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { factTextSchema } from "@/lib/persona-ui";
import { LIMITS, type IdentityFact } from "@/lib/schemas";

export function IdentityFacts(props: {
  facts: IdentityFact[];
  /** Facts that came preloaded with the fictitious demo persona, labeled as such. */
  demoFactIds: string[];
  loading: boolean;
  onChange: (facts: IdentityFact[]) => void;
  onContinue: () => void;
}) {
  const { facts, demoFactIds, loading, onChange, onContinue } = props;
  const [newFact, setNewFact] = useState("");
  const [error, setError] = useState("");

  function addFact() {
    const parsed = factTextSchema.safeParse(newFact);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your fact.");
      return;
    }
    if (facts.length >= LIMITS.maxFacts) {
      setError(`You can keep up to ${LIMITS.maxFacts} facts.`);
      return;
    }
    // "u" prefix keeps user-added ids distinct from extracted f1, f2, ... Facts you type are yours, so they start confirmed.
    onChange([...facts, { id: `u${Date.now().toString(36)}`, text: parsed.data, confirmed: true, source: "user" }]);
    setNewFact("");
    setError("");
  }

  const invalid = facts.some((fact) => !factTextSchema.safeParse(fact.text).success);

  return (
    <section className="flow-section fade-in">
      <h2 className="flow-title">
        <Dna /> Identity DNA
      </h2>
      <p className="flow-description">
        Tick the facts that are true about you. Only ticked facts can be used in a rewrite.
      </p>
      {loading && (
        <div role="status" aria-live="polite">
          <p className="loading-row">
            <LoaderCircle className="animate-spin" size={14} />
            Finding facts in your text…
          </p>
          <div className="loading-skeleton">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {!loading && !facts.length && (
        <p className="empty-note">No concrete facts found in your text. Add a few true facts about yourself.</p>
      )}
      <div className="identity-list">
        {facts.map((fact, index) => (
          <div className="identity-row" key={fact.id}>
            <input
              aria-label={`Confirm fact ${index + 1}`}
              type="checkbox"
              checked={fact.confirmed}
              onChange={(event) =>
                onChange(facts.map((item) => (item.id === fact.id ? { ...item, confirmed: event.target.checked } : item)))
              }
            />
            <div className="flex-1 min-w-0">
              <textarea
                className="fact-edit"
                rows={2}
                aria-label={`Fact ${index + 1}`}
                maxLength={LIMITS.factText}
                value={fact.text}
                // Editing a fact un-confirms it, so a changed statement is never used without a fresh tick.
                onChange={(event) =>
                  onChange(
                    facts.map((item) => (item.id === fact.id ? { ...item, text: event.target.value, confirmed: false } : item)),
                  )
                }
              />
              <span className="source-tag">
                {demoFactIds.includes(fact.id)
                  ? "Demo persona fact"
                  : fact.source === "extracted"
                    ? "Suggested by AI"
                    : "Added by you"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Remove fact"
              aria-label={`Remove fact ${index + 1}`}
              onClick={() => onChange(facts.filter((item) => item.id !== fact.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <div className="add-fact-row">
        <label className="sr-only" htmlFor="new-fact">
          Add a fact
        </label>
        <input
          id="new-fact"
          className="goal-input"
          maxLength={LIMITS.factText}
          value={newFact}
          onChange={(event) => setNewFact(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addFact();
          }}
          placeholder="A project, role, or skill that’s really yours…"
        />
        <Button variant="glass" disabled={facts.length >= LIMITS.maxFacts} onClick={addFact}>
          <Plus />
          Add a fact
        </Button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="action-band">
        <span className="empty-note">
          {facts.filter((fact) => fact.confirmed).length} of {facts.length} facts confirmed
        </span>
        <Button variant="aero" disabled={invalid || loading} onClick={onContinue}>
          Continue <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
