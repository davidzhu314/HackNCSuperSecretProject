"use client";

import { ArrowRight, FileText, Fingerprint, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { LIMITS, type Platform } from "@/lib/schemas";

// Bio platforms (Handshake, Instagram, Facebook, X, Tinder): one text field, counted against the
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
  /** Confirmed facts shared with this platform, offered as a first draft for an empty bio. */
  seedFacts?: number;
  onSeed?: () => void;
}) {
  const { platform, bio, demo, canContinue, onBioChange, jobDescription, onJobDescription, onLoadDemo, onContinue, seedFacts, onSeed } =
    props;
  const config = PLATFORM_CONFIGS[platform];
  const field = config.fieldLabel.toLowerCase();
  const length = [...bio].length;
  // A draft may run over while you write; the rewrite is held to the limit.
  const over = config.maxChars !== undefined && length > config.maxChars;

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
          </div>
        </div>
        <div className="perspective-panel">
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
          {!!seedFacts && onSeed && !bio.trim() && (
            <>
              <h2 className="section-heading seed-heading">
                <Fingerprint />
                Start from your facts
              </h2>
              <p className="section-subtitle">
                Fills your {field} with your confirmed facts, word for word, as many as fit {config.label}&apos;s limit.
                Edit them into your own voice.
              </p>
              <Button variant="glass" onClick={onSeed}>
                <Fingerprint />
                Use my {seedFacts} {seedFacts === 1 ? "fact" : "facts"}
              </Button>
            </>
          )}
          <p className="flow-description">
            {config.maxChars
              ? `${config.label} allows ${config.maxChars} characters here. Paste what you have; the rewrite will fit it.`
              : `Paste your ${field}.`}
          </p>
        </div>
      </div>
      <div className="action-band">
        <span className="empty-note">Next: confirm the facts about you.</span>
        <Button variant="aero" disabled={!canContinue} onClick={onContinue}>
          Continue <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
