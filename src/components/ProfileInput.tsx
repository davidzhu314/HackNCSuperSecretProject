"use client";

import { ArrowRight, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HINGE_PROMPTS, MAX_HINGE_ANSWER, type HingePair } from "@/lib/persona-ui";

// Hinge input: up to three prompt answers. (LinkedIn uses the section editor, LinkedInEditor.)

export function ProfileInput(props: {
  hinge: HingePair[];
  demo: boolean;
  canContinue: boolean;
  onHingeChange: (pairs: HingePair[]) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
}) {
  const { hinge, demo, canContinue, onHingeChange, onLoadDemo, onContinue } = props;
  const setPair = (index: number, patch: Partial<HingePair>) =>
    onHingeChange(hinge.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));

  return (
    <section className="flow-section fade-in">
      <div className="workspace-grid">
        <div className="profile-panel">
          <div className="panel-header">
            <h2 className="section-heading">
              <FileText />
              Your Hinge profile
            </h2>
          </div>
          <div className="profile-content">
            <div className="hinge-prompts">
              {hinge.map((pair, index) => (
                <div className="hinge-prompt" key={index}>
                  <label className="field-label" htmlFor={`prompt-${index}`}>
                    Prompt {index + 1}
                  </label>
                  <select
                    id={`prompt-${index}`}
                    className="audience-select"
                    value={pair.prompt}
                    onChange={(event) => setPair(index, { prompt: event.target.value })}
                  >
                    {HINGE_PROMPTS.map((prompt) => (
                      <option key={prompt}>{prompt}</option>
                    ))}
                  </select>
                  <textarea
                    aria-label={`Answer ${index + 1}`}
                    className="profile-textarea hinge-answer"
                    maxLength={MAX_HINGE_ANSWER}
                    value={pair.answer}
                    placeholder="Your answer…"
                    onChange={(event) => setPair(index, { answer: event.target.value })}
                  />
                  <span className="empty-note">
                    {pair.answer.length} / {MAX_HINGE_ANSWER}
                  </span>
                </div>
              ))}
            </div>
            <div className="input-meta">
              <span>
                <LockKeyhole size={11} />
                Only here, only for this session.
              </span>
            </div>
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
          <p className="flow-description">Pick a prompt and paste your answer for each one you use.</p>
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
