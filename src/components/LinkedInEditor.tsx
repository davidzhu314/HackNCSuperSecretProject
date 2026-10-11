"use client";

import { ArrowRight, Fingerprint, FileText, LoaderCircle, Plus, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { nextEntryId, profileCharCount } from "@/lib/profile";
import { ENTRY_KINDS, LIMITS, type EntrySectionKind, type LinkedInProfile, type ProfileEntry } from "@/lib/schemas";

// LinkedIn profile, one box per section. Titles, organizations, and dates are editable but
// never rewritten; only the headline, About, and each entry's description are.

const KIND: Record<EntrySectionKind, { heading: string; one: string; title: string; org: string }> = {
  experience: { heading: "Experience", one: "experience", title: "Title", org: "Company" },
  education: { heading: "Education", one: "education", title: "Degree", org: "School" },
  projects: { heading: "Projects", one: "project", title: "Project name", org: "Context (class, team, personal…)" },
  volunteering: { heading: "Volunteering", one: "volunteering role", title: "Role", org: "Organization" },
};

export type ImportState = { fileName: string; warnings: string[] } | null;

export function LinkedInEditor(props: {
  profile: LinkedInProfile;
  jobDescription: string;
  demo: boolean;
  imported: ImportState;
  importing: boolean;
  canUseSample: boolean;
  sampleMode: boolean;
  canContinue: boolean;
  onChange: (profile: LinkedInProfile) => void;
  onJobDescription: (text: string) => void;
  onImportFile: (file: File) => void;
  onLoadDemo: () => void;
  onSampleModeChange: (enabled: boolean) => void;
  onContinue: () => void;
  /** Confirmed facts shared with LinkedIn, offered as a starting About when it's empty. */
  seedFacts?: number;
  onSeed?: () => void;
}) {
  const { profile, jobDescription, demo, imported, importing, canUseSample, sampleMode, canContinue, seedFacts, onSeed } =
    props;
  const { onChange, onJobDescription, onImportFile, onLoadDemo, onSampleModeChange, onContinue } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const chars = profileCharCount(profile);
  const over = chars > LIMITS.profileText;

  const setEntry = (kind: EntrySectionKind, id: string, patch: Partial<ProfileEntry>) =>
    onChange({ ...profile, [kind]: profile[kind].map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const addEntry = (kind: EntrySectionKind) =>
    onChange({
      ...profile,
      [kind]: [...profile[kind], { id: nextEntryId(profile, kind), title: "", organization: "", dates: "", description: "" }],
    });
  const removeEntry = (kind: EntrySectionKind, id: string) =>
    onChange({ ...profile, [kind]: profile[kind].filter((e) => e.id !== id) });

  return (
    <section className="flow-section fade-in">
      <div className="workspace-grid">
        <div className="profile-panel">
          <div className="panel-header">
            <h2 className="section-heading">
              <FileText />
              LinkedIn
            </h2>
          </div>
          <div className="profile-content">
            {/* Only warnings that need the user's attention; routine import notes aren't shown. */}
            {imported && imported.warnings.length > 0 && (
              <div className="import-review" role="status">
                <ul>
                  {imported.warnings.map((w, i) => (
                    <li key={i}>
                      <TriangleAlert size={13} aria-hidden="true" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="section-editor">
              <div className="editor-box">
                <label className="field-label" htmlFor="li-headline">
                  Headline <span className="optional">rewritable</span>
                </label>
                <input
                  id="li-headline"
                  className="goal-input"
                  value={profile.headline}
                  maxLength={LIMITS.headlineChars}
                  placeholder="e.g. Computer science senior | Python and React"
                  onChange={(e) => onChange({ ...profile, headline: e.target.value })}
                />
              </div>
              <div className="editor-box">
                <label className="field-label" htmlFor="li-about">
                  About <span className="optional">rewritable</span>
                </label>
                <textarea
                  id="li-about"
                  className="profile-textarea about-textarea"
                  value={profile.about}
                  maxLength={LIMITS.sectionText}
                  placeholder="Paste your About section…"
                  onChange={(e) => onChange({ ...profile, about: e.target.value })}
                />
              </div>

              {ENTRY_KINDS.map((kind) => (
                <div className="editor-box" key={kind}>
                  <div className="editor-box-head">
                    <h3 className="section-heading">
                      {KIND[kind].heading} <span className="selection-count">{profile[kind].length}</span>
                    </h3>
                    <Button
                      variant="glass"
                      size="sm"
                      disabled={profile[kind].length >= LIMITS.maxEntries}
                      onClick={() => addEntry(kind)}
                    >
                      <Plus />
                      Add {KIND[kind].one}
                    </Button>
                  </div>
                  {!profile[kind].length && (
                    <p className="empty-note">
                      None yet.{" "}
                      {kind === "projects" || kind === "volunteering"
                        ? "LinkedIn’s PDF export may leave this out; add entries by hand."
                        : ""}
                    </p>
                  )}
                  {profile[kind].map((entry, index) => (
                    <fieldset className="entry-card" key={entry.id}>
                      <legend className="sr-only">
                        {KIND[kind].heading} {index + 1}
                      </legend>
                      <div className="entry-fields">
                        <label className="entry-field">
                          <span>{KIND[kind].title}</span>
                          <input
                            className="goal-input"
                            value={entry.title}
                            maxLength={LIMITS.entryField}
                            onChange={(e) => setEntry(kind, entry.id, { title: e.target.value })}
                          />
                        </label>
                        <label className="entry-field">
                          <span>{KIND[kind].org}</span>
                          <input
                            className="goal-input"
                            value={entry.organization}
                            maxLength={LIMITS.entryField}
                            onChange={(e) => setEntry(kind, entry.id, { organization: e.target.value })}
                          />
                        </label>
                        <label className="entry-field">
                          <span>Dates</span>
                          <input
                            className="goal-input"
                            value={entry.dates ?? ""}
                            maxLength={100}
                            placeholder="e.g. June 2026 - Present"
                            onChange={(e) => setEntry(kind, entry.id, { dates: e.target.value })}
                          />
                        </label>
                      </div>
                      <p className="entry-kept">Kept exactly as written.</p>
                      <label className="entry-field">
                        <span>
                          Description <span className="optional">rewritable</span>
                        </span>
                        <textarea
                          className="profile-textarea entry-textarea"
                          value={entry.description}
                          maxLength={LIMITS.sectionText}
                          placeholder="- One line per bullet"
                          onChange={(e) => setEntry(kind, entry.id, { description: e.target.value })}
                        />
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="entry-remove"
                        aria-label={`Remove ${KIND[kind].one} ${index + 1}`}
                        onClick={() => removeEntry(kind, entry.id)}
                      >
                        <Trash2 />
                        Remove
                      </Button>
                    </fieldset>
                  ))}
                </div>
              ))}

              <div className="editor-box">
                <label className="field-label" htmlFor="li-skills">
                  Skills <span className="optional">one per line · listed, not rewritten</span>
                </label>
                <textarea
                  id="li-skills"
                  className="profile-textarea entry-textarea"
                  value={profile.skills.join("\n")}
                  onChange={(e) => onChange({ ...profile, skills: e.target.value.split("\n").slice(0, LIMITS.maxListItems) })}
                />
              </div>

              <details className="job-details">
                <summary>Target a specific job</summary>
                <label className="field-label mt-4" htmlFor="job">
                  Job description <span className="optional">(optional)</span>
                </label>
                <textarea
                  id="job"
                  className="profile-textarea job-textarea"
                  maxLength={LIMITS.jobDescription}
                  value={jobDescription}
                  onChange={(e) => onJobDescription(e.target.value)}
                  placeholder="Paste the role you have in mind…"
                />
              </details>
            </div>

          </div>
        </div>
        <div className="perspective-panel linkedin-side">
          <h2 className="section-heading">
            <Upload />
            Import from LinkedIn
          </h2>
          <p className="section-subtitle">Use LinkedIn’s “Save to PDF” export, or fill in the sections yourself.</p>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md,.json"
            aria-label="Import a LinkedIn PDF or text file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportFile(file);
              event.target.value = "";
            }}
          />
          <Button variant="glass" disabled={importing} onClick={() => fileInput.current?.click()}>
            {importing ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {importing ? "Reading file…" : "Import PDF"}
          </Button>
          <h2 className="section-heading seed-heading">
            <Sparkles />
            Try it with a demo
          </h2>
          <p className="section-subtitle">Loads a made-up profile so you can see every step.</p>
          <Button variant="glass" disabled={importing} onClick={onLoadDemo}>
            <Sparkles />
            Load demo persona
          </Button>
          {demo && (
            <div className="demo-row">
              <p className="demo-note">Fictitious demo persona</p>
              {canUseSample && (
                <label className="sample-toggle">
                  <input type="checkbox" checked={sampleMode} onChange={(event) => onSampleModeChange(event.target.checked)} />
                  <span>
                    Use sample results instead. Nothing is sent to the AI, and every result is labeled &ldquo;Sample
                    result&rdquo;.
                  </span>
                </label>
              )}
            </div>
          )}
          {!!seedFacts && onSeed && !profile.about.trim() && (
            <>
              <h2 className="section-heading seed-heading">
                <Fingerprint />
                Start from your facts
              </h2>
              <p className="section-subtitle">
                Fills About with your confirmed facts, word for word, as a first draft. Edit them into your own voice.
              </p>
              <Button variant="glass" disabled={importing} onClick={onSeed}>
                <Fingerprint />
                Use my {seedFacts} {seedFacts === 1 ? "fact" : "facts"}
              </Button>
            </>
          )}
          <p className="flow-description">
            Only the headline, About, and descriptions get rewritten; titles, organizations, and dates stay exactly as
            you write them.
          </p>
        </div>
      </div>

      <div className="action-band">
        <span className="empty-note" data-over={over}>
          {chars.toLocaleString()} / {LIMITS.profileText.toLocaleString()} characters
          {over ? " · shorten the profile to continue" : ""}
        </span>
        <Button variant="aero" disabled={!canContinue} onClick={onContinue}>
          Continue <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
