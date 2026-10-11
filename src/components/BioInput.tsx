"use client";

import { ArrowRight, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { QuickCheck } from "@/components/QuickCheck";
import { Button } from "@/components/ui/button";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { LIMITS, type Platform } from "@/lib/schemas";
import { segmentBio } from "@/lib/segments";

// Bio platforms (Handshake, Instagram, GitHub): one text field, counted against the
// platform's own limit. (LinkedIn uses LinkedInEditor; Hinge uses ProfileInput.)

export function BioInput(props: {
  platform: Platform;
  bio: string;
  demo: boolean;
  canContinue: boolean;
  onBioChange: (bio: string) => void;
  /** Professional platforms only (Handshake). */
  jobDescription?: string;
  onJobDescription?: (text: string) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
  /** "Fill from your other profiles" (AutofillPanel), shown under the demo button. */
  autofill?: React.ReactNode;
}) {
  const { platform, bio, demo, canContinue, onBioChange, jobDescription, onJobDescription, onLoadDemo, onContinue, autofill } =
    props;
  const config = PLATFORM_CONFIGS[platform];
  const field = config.fieldLabel.toLowerCase();
  const length = [...bio].length;
  const starterHint: Partial<Record<Platform, string>> = {
    handshake: "Start with your field of study, one relevant project, and the kind of role you want.",
    instagram: "Choose one identity anchor and one or two interests people should notice first.",
    github: "Say what you build or study, and the languages or projects you work with.",
    tinder: "Share one real interest and one specific detail that feels like you.",
  };
  // A draft may run over while you write; the rewrite is held to the limit.
  const over = config.maxChars !== undefined && length > config.maxChars;
  const segments = useMemo(() => segmentBio(bio), [bio]);

  return (
    <section className="flow-section fade-in">
      <div className="workspace-grid">
        <div className="profile-panel">
          <div className="panel-header">
            <h2 className="section-heading">
              <FileText />
              {config.label}
            </h2>
          </div>
          <div className="profile-content">
            <label className="field-label" htmlFor="bio">
              {config.fieldLabel}
            </label>
            <textarea
              id="bio"
              className="profile-textarea"
              maxLength={LIMITS.sectionText}
              value={bio}
              placeholder={`Paste your ${config.label} ${field}…`}
              onChange={(event) => onBioChange(event.target.value)}
            />
            <p className="profile-input-hint">{starterHint[platform] ?? `Paste your current ${field} or write the few details you want people to remember.`}</p>
            <div className="input-meta">
              <span>
                <LockKeyhole size={11} />
                Only here, only for this session.
              </span>
              {config.maxChars && (
                <span className="bio-count" data-over={over}>
                  {over ? `Over ${config.label}'s limit · ` : ""}
                  {length} / {config.maxChars}
                </span>
              )}
            </div>
            {config.jobDescription && onJobDescription && (
              <details className="job-details">
                <summary>Target a specific job</summary>
                <label className="field-label mt-4" htmlFor="job">
                  Job description <span className="optional">(optional)</span>
                </label>
                <textarea
                  id="job"
                  className="profile-textarea job-textarea"
                  maxLength={LIMITS.jobDescription}
                  value={jobDescription ?? ""}
                  onChange={(event) => onJobDescription(event.target.value)}
                  placeholder="Paste the role you have in mind…"
                />
              </details>
            )}
            <QuickCheck segments={segments} group={config.group} fitText={bio} compact />
          </div>
        </div>
        <div className="perspective-panel">
          {autofill}
          <details className="profile-tools">
            <summary>Optional tools and examples</summary>
            <div className="profile-tools-content">
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
            {config.maxChars
              ? `${config.label} allows ${config.maxChars} characters here. Paste what you have; the rewrite will fit it.`
              : `Paste your ${field}.`}
          </p>
            </div>
          </details>
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
