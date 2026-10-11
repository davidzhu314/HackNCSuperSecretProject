"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { IdentityFact } from "@/lib/schemas";

/**
 * True facts about you that aren't in your text, added on the rewrite step (every platform). Like
 * your own words, they are evidence: rewrites may use them and FactCheck accepts them.
 */
export function ExtraFacts(props: {
  facts: IdentityFact[];
  /** What the user's own text is called here: "profile", "bio", "answers". */
  what: string;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const { facts, what, onAdd, onRemove } = props;
  const [factDraft, setFactDraft] = useState("");
  return (
    <details className="extra-facts">
      <summary>
        Add something that isn&apos;t in your {what}{facts.length ? ` (${facts.length})` : ""}
      </summary>
      {facts.length > 0 && (
        <ul>
          {facts.map((f) => (
            <li key={f.id}>
              <span>{f.text}</span>
              <Button variant="ghost" size="icon" aria-label={`Remove: ${f.text}`} onClick={() => onRemove(f.id)}>
                <X />
              </Button>
            </li>
          ))}
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
    </details>
  );
}
