"use client";

import { Check, Eye, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LIMITS, type CustomQuestion, type PlatformConfig } from "@/lib/schemas";

const toggle = (ids: string[], id: string, max: number) =>
  ids.includes(id) ? ids.filter((item) => item !== id) : ids.length < max ? [...ids, id] : ids;

export function AudienceSelection(props: {
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  loading: boolean;
  /** Questions the user typed; answered by every lens like the built-in ones. */
  customQuestions: CustomQuestion[];
  /** Sample results can't answer new questions, so typing one is off in sample mode. */
  sampleMode: boolean;
  onAudiences: (ids: string[]) => void;
  onTraits: (ids: string[]) => void;
  onCustomQuestions: (questions: CustomQuestion[]) => void;
  onFeedback: () => void;
}) {
  const { config, audiences, traits, customQuestions, sampleMode, loading, onAudiences, onTraits, onCustomQuestions, onFeedback } =
    props;
  const maxAudiences = Math.min(config.audiences.length, LIMITS.maxAudiences);
  const maxTraits = Math.min(config.traits.length, LIMITS.maxTraits);
  const [draft, setDraft] = useState("");
  const canAddQuestion = !sampleMode && customQuestions.length < LIMITS.maxCustomQuestions && draft.trim().length > 0;
  const addQuestion = () => {
    if (!canAddQuestion) return;
    const used = new Set(customQuestions.map((q) => q.id));
    const id = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9"].find((x) => !used.has(x))!;
    onCustomQuestions([...customQuestions, { id, text: draft.trim().slice(0, LIMITS.customQuestion) }]);
    setDraft("");
  };
  const groups = config.categories?.length
    ? config.categories.map((cat) => ({ ...cat, options: config.audiences.filter((a) => a.category === cat.id) }))
    : [{ id: "all", label: "", options: config.audiences }];
  return (
    <section className="flow-section fade-in">
      <h2 className="flow-title">
        <Eye /> Choose your audience lens
      </h2>
      <div className="selection-grid">
        <div>
          <h3 className="section-heading">
            Through whose eyes?{" "}
            <span className="selection-count">
              {audiences.length} / {maxAudiences}
            </span>
          </h3>
          {/* LinkedIn groups its lenses by category; Hinge has a flat list. */}
          {groups.map((group) => (
            <div key={group.id} className="audience-group">
              {group.label && <h4 className="audience-group-label">{group.label}</h4>}
              <div className="audience-options">
                {group.options.map((option) => (
                  <Button
                    variant="glass"
                    className="audience-option"
                    data-selected={audiences.includes(option.id)}
                    aria-pressed={audiences.includes(option.id)}
                    key={option.id}
                    disabled={loading}
                    title={option.summary ? option.description : undefined}
                    onClick={() => onAudiences(toggle(audiences, option.id, maxAudiences))}
                  >
                    <Eye />
                    <span>
                      <span className="audience-option-name">{option.label}</span>
                      <span className="audience-option-desc">{option.summary ?? option.description}</span>
                    </span>
                    {audiences.includes(option.id) && <Check />}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3 className="section-heading">
            {config.categories?.length ? "What should they be able to tell?" : "What should they look for?"}{" "}
            <span className="selection-count">{traits.length + customQuestions.length} selected</span>
          </h3>
          <div className="trait-options mt-4">
            {config.traits.map((option) => (
              <Button
                variant="trait"
                key={option.id}
                data-selected={traits.includes(option.id)}
                aria-pressed={traits.includes(option.id)}
                disabled={loading}
                title={option.description}
                onClick={() => onTraits(toggle(traits, option.id, maxTraits))}
              >
                {traits.includes(option.id) && <Check />}
                {option.question ?? option.label}
              </Button>
            ))}
          </div>
          {customQuestions.length > 0 && (
            <ul className="custom-questions">
              {customQuestions.map((q) => (
                <li key={q.id}>
                  <Check size={14} aria-hidden="true" />
                  <span>{q.text}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove question: ${q.text}`}
                    disabled={loading}
                    onClick={() => onCustomQuestions(customQuestions.filter((x) => x.id !== q.id))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {customQuestions.length < LIMITS.maxCustomQuestions && (
            <div className="custom-question-row">
              <label className="sr-only" htmlFor="custom-question">
                Your own question
              </label>
              <input
                id="custom-question"
                className="goal-input"
                maxLength={LIMITS.customQuestion}
                value={draft}
                disabled={sampleMode || loading}
                placeholder={sampleMode ? "Your own questions need live AI (turn off sample mode)" : "Your own question, e.g. Can they tell I lead teams?"}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addQuestion();
                }}
              />
              <Button variant="glass" size="sm" disabled={!canAddQuestion || loading} onClick={addQuestion}>
                <Plus />
                Add
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="action-band">
        <span className="empty-note" />
        <Button variant="aero" disabled={!audiences.length || (!traits.length && !customQuestions.length) || loading} onClick={onFeedback}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {loading ? "Getting feedback..." : "Get feedback"}
        </Button>
      </div>
      {loading && (
        <div className="loading-skeleton" role="status" aria-live="polite">
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}
