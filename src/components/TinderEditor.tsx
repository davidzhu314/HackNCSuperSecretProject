"use client";

import { ArrowRight, FileText, LockKeyhole, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { QuickCheck } from "@/components/QuickCheck";
import { Button } from "@/components/ui/button";
import { LIMITS, type TinderChoiceField, type TinderFields, type TinderProfile } from "@/lib/schemas";
import {
  filledFieldCount,
  segmentTinder,
  TINDER_FIELD_GROUPS,
  TINDER_PROMPTS,
  tinderOptions,
  type TinderAiField,
} from "@/lib/tinder";

// Tinder input: About me, up to three prompt answers, and profile fields the user picks. The AI
// never fills or sees the picks; only About, the answers, and the work fields can reach a rewrite.

export function TinderEditor(props: {
  tinder: TinderProfile;
  /** Work fields that were filled from LinkedIn and not edited since. */
  fromLinkedIn: TinderAiField[];
  demo: boolean;
  canContinue: boolean;
  /** `edited` is the field the user changed, so its "from your LinkedIn" tag can go. */
  onChange: (next: TinderProfile, edited?: keyof TinderFields) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
  /** "Fill from your other profiles" (AutofillPanel), shown under the demo button. */
  autofill?: React.ReactNode;
}) {
  const { tinder, fromLinkedIn, demo, canContinue, onChange, onLoadDemo, onContinue, autofill } =
    props;
  const segments = useMemo(() => segmentTinder(tinder), [tinder]);
  const [visiblePromptCount, setVisiblePromptCount] = useState(1);
  const [profileDetailsOpen, setProfileDetailsOpen] = useState(false);
  const lastAnswered = tinder.prompts.reduce((last, prompt, index) => prompt.answer.trim() ? index + 1 : last, 0);
  const activePromptCount = Math.min(tinder.prompts.length, Math.max(visiblePromptCount, lastAnswered));
  const savedFieldCount = filledFieldCount(tinder.fields);
  const aboutLength = [...tinder.about].length;
  const aboutOver = aboutLength > LIMITS.tinderAbout;

  const setFields = (patch: Partial<TinderFields>, edited: keyof TinderFields) =>
    onChange({ ...tinder, fields: { ...tinder.fields, ...patch } }, edited);
  const setPrompt = (index: number, patch: Partial<TinderProfile["prompts"][number]>) =>
    onChange({ ...tinder, prompts: tinder.prompts.map((p, i) => (i === index ? { ...p, ...patch } : p)) });
  const unused = TINDER_PROMPTS.filter((p) => !tinder.prompts.some((x) => x.prompt === p));

  return (
    <section className="flow-section fade-in">
      <div className="workspace-grid">
        <div className="profile-panel">
          <div className="panel-header">
            <h2 className="section-heading">
              <FileText />
              Tinder
            </h2>
          </div>
          <div className="profile-content">
            <label className="field-label" htmlFor="tinder-about">
              About me
            </label>
            <textarea
              id="tinder-about"
              className="profile-textarea"
              maxLength={LIMITS.sectionText}
              value={tinder.about}
              placeholder="Paste your Tinder About me…"
              onChange={(event) => onChange({ ...tinder, about: event.target.value })}
            />
            <div className="input-meta">
              <span>
                <LockKeyhole size={11} />
                Only here, only for this session.
              </span>
              <span className="bio-count" data-over={aboutOver}>
                {aboutOver ? "Over Tinder's limit · " : ""}
                {aboutLength} / {LIMITS.tinderAbout}
              </span>
            </div>

            <p className="profile-input-hint">Start with your About me or one prompt. Add more only if you want.</p>
            <h3 className="tinder-subhead">Prompts <span className="optional">(optional)</span></h3>
            <div className="hinge-prompts">
              {tinder.prompts.slice(0, activePromptCount).map((pair, index) => (
                <div className="hinge-prompt" key={index}>
                  <div className="tinder-prompt-head">
                    <label className="field-label" htmlFor={`tinder-prompt-${index}`}>
                      Prompt {index + 1}
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove prompt ${index + 1}`}
                      onClick={() => onChange({ ...tinder, prompts: tinder.prompts.filter((_, i) => i !== index) })}
                    >
                      <X />
                      Remove
                    </Button>
                  </div>
                  <select
                    id={`tinder-prompt-${index}`}
                    className="audience-select"
                    value={pair.prompt}
                    onChange={(event) => setPrompt(index, { prompt: event.target.value })}
                  >
                    {[pair.prompt, ...unused].map((prompt) => (
                      <option key={prompt}>{prompt}</option>
                    ))}
                  </select>
                  <textarea
                    aria-label={`Answer ${index + 1}`}
                    className="profile-textarea hinge-answer"
                    maxLength={LIMITS.tinderAnswer}
                    value={pair.answer}
                    placeholder="Your answer…"
                    onChange={(event) => setPrompt(index, { answer: event.target.value })}
                  />
                  <span className="empty-note">
                    {pair.answer.length} / {LIMITS.tinderAnswer}
                  </span>
                </div>
              ))}
            </div>
            {activePromptCount < LIMITS.maxTinderPrompts && (
              <Button
                variant="glass"
                size="sm"
                className="mt-4"
                onClick={() => {
                  if (activePromptCount === tinder.prompts.length) {
                    onChange({ ...tinder, prompts: [...tinder.prompts, { prompt: unused[0], answer: "" }] });
                  }
                  setVisiblePromptCount(activePromptCount + 1);
                }}
              >
                <Plus />
                Add another prompt
              </Button>
            )}
            <QuickCheck segments={segments} group="dating" fitText={tinder.about} compact />

            <details
              className="job-details tinder-extra-details"
              open={profileDetailsOpen}
              onToggle={(event) => setProfileDetailsOpen(event.currentTarget.open)}
            >
              <summary>
                Optional profile details{savedFieldCount ? ` · ${savedFieldCount} added` : ""}
                {fromLinkedIn.length > 0 && <span className="optional"> · {fromLinkedIn.length} from LinkedIn</span>}
              </summary>
              <p className="empty-note tinder-assumed">These fields are optional. Personal and lifestyle picks are never sent to the AI.</p>
            {TINDER_FIELD_GROUPS.map((group) => (
              <details className="job-details tinder-group" key={group.id}>
                <summary>
                  {group.label} <span className="optional">· {group.note}</span>
                </summary>
                <div className="tinder-fields">
                  {group.fields.map((field) => {
                    const id = `tinder-${field.key}`;
                    const tag = (fromLinkedIn as string[]).includes(field.key) && (
                      <span className="from-linkedin">from your LinkedIn</span>
                    );
                    if (field.kind === "text") {
                      return (
                        <div key={field.key}>
                          <label className="field-label" htmlFor={id}>
                            {field.label}
                            {tag}
                          </label>
                          <input
                            id={id}
                            className="goal-input"
                            maxLength={LIMITS.tinderField}
                            value={tinder.fields[field.key]}
                            placeholder={field.placeholder}
                            onChange={(event) => setFields({ [field.key]: event.target.value }, field.key)}
                          />
                        </div>
                      );
                    }
                    if (field.kind === "languages") {
                      return (
                        <div key={field.key} className="tinder-field-wide">
                          <span className="field-label">
                            {field.label}
                            {tag}
                          </span>
                          <LanguagesInput
                            languages={tinder.fields.languages}
                            onChange={(languages) => setFields({ languages }, "languages")}
                          />
                        </div>
                      );
                    }
                    if (field.kind === "many") {
                      return (
                        <ManyChoice
                          key={field.key}
                          label={field.label}
                          options={tinderOptions(field.key)}
                          value={tinder.fields[field.key] as readonly string[]}
                          onChange={(value) => setFields({ [field.key]: value } as Partial<TinderFields>, field.key)}
                        />
                      );
                    }
                    return (
                      <div key={field.key}>
                        <label className="field-label" htmlFor={id}>
                          {field.label}
                        </label>
                        <select
                          id={id}
                          className="audience-select"
                          value={(tinder.fields[field.key as TinderChoiceField] as string | null) ?? ""}
                          onChange={(event) =>
                            setFields({ [field.key]: event.target.value || null } as Partial<TinderFields>, field.key)
                          }
                        >
                          <option value="">Not shown</option>
                          {tinderOptions(field.key).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
            </details>
          </div>
        </div>
        <div className="perspective-panel">
          {autofill}
          <h2 className="section-heading">
            <Sparkles />
            Try it with a demo
          </h2>
          <p className="section-subtitle">Loads a made-up profile so you can see every step.</p>
          <Button variant="glass" onClick={onLoadDemo}>
            <Sparkles />
            Load demo persona
          </Button>
          {demo && <p className="demo-note">Fictitious demo persona</p>}
          <p className="flow-description">
            Only your About me, prompt answers, and work or education details are sent for a rewrite.
          </p>
        </div>
      </div>
      <div className="action-band">
        <span className="empty-note">Next: choose who reads it.</span>
        <Button variant="aero" disabled={!canContinue} onClick={onContinue}>
          Continue <ArrowRight />
        </Button>
      </div>
    </section>
  );
}

/** Several picks from a fixed list, as toggle chips. */
function ManyChoice(props: { label: string; options: readonly string[]; value: readonly string[]; onChange: (value: string[]) => void }) {
  const { label, options, value, onChange } = props;
  return (
    <fieldset className="tinder-field-wide tinder-many">
      <legend className="field-label">
        {label} <span className="optional">(pick any)</span>
      </legend>
      <div className="trait-options">
        {options.map((option) => {
          const on = value.includes(option);
          return (
            <Button
              key={option}
              variant="trait"
              data-selected={on}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== option) : options.filter((o) => o === option || value.includes(o)))}
            >
              {option}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Languages as removable chips plus an add box. */
function LanguagesInput({ languages, onChange }: { languages: string[]; onChange: (languages: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const full = languages.length >= LIMITS.maxLanguages;
  function add() {
    const name = draft.trim().slice(0, LIMITS.listItem);
    if (!name || full) return;
    if (!languages.some((l) => l.toLowerCase() === name.toLowerCase())) onChange([...languages, name]);
    setDraft("");
  }
  return (
    <>
      {languages.length > 0 && (
        <div className="trait-options">
          {languages.map((language) => (
            <Button
              key={language}
              variant="trait"
              data-selected
              aria-label={`Remove ${language}`}
              onClick={() => onChange(languages.filter((l) => l !== language))}
            >
              {language}
              <X />
            </Button>
          ))}
        </div>
      )}
      <div className="add-fact-row">
        <input
          aria-label="Add a language"
          className="goal-input"
          maxLength={LIMITS.listItem}
          value={draft}
          disabled={full}
          placeholder={full ? `Up to ${LIMITS.maxLanguages} languages` : "e.g. Spanish"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button variant="glass" size="sm" disabled={!draft.trim() || full} onClick={add}>
          <Plus />
          Add
        </Button>
      </div>
    </>
  );
}
