"use client";

import { ArrowRight, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { QuickCheck } from "@/components/QuickCheck";
import { Button } from "@/components/ui/button";
import { HINGE_PROMPTS, MAX_HINGE_ANSWER, type HingePair } from "@/lib/persona-ui";
import { segmentHinge } from "@/lib/segments";

// Hinge input: up to three prompt answers. (LinkedIn uses the section editor, LinkedInEditor.)

export function ProfileInput(props: {
  hinge: HingePair[];
  demo: boolean;
  canContinue: boolean;
  onHingeChange: (pairs: HingePair[]) => void;
  onLoadDemo: () => void;
  onContinue: () => void;
  /** "Fill from your other profiles" (AutofillPanel), shown under the demo button. */
  autofill?: React.ReactNode;
}) {
  const { hinge, demo, canContinue, onHingeChange, onLoadDemo, onContinue, autofill } = props;
  const [visibleCount, setVisibleCount] = useState(1);
  const segments = useMemo(() => segmentHinge(hinge), [hinge]);
  const lastAnswered = hinge.reduce((last, pair, index) => pair.answer.trim() ? index + 1 : last, 0);
  const activeCount = Math.min(hinge.length, Math.max(visibleCount, lastAnswered));
  const setPair = (index: number, patch: Partial<HingePair>) =>
    onHingeChange(hinge.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));

  return (
    <section className="flow-section fade-in">
      <div className="workspace-grid">
        <div className="profile-panel">
          <div className="panel-header">
            <h2 className="section-heading">
              <FileText />
              Hinge
            </h2>
          </div>
          <div className="profile-content">
            <p className="profile-input-hint">One answer is enough to start. Add other prompts only if you want to show more of your personality.</p>
            <div className="hinge-prompts">
              {hinge.slice(0, activeCount).map((pair, index) => (
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
            {activeCount < hinge.length && <Button variant="glass" onClick={() => setVisibleCount(activeCount + 1)}>Add another prompt <span className="optional">(optional)</span></Button>}
            <div className="input-meta">
              <span>
                <LockKeyhole size={11} />
                Only here, only for this session.
              </span>
            </div>
            <QuickCheck segments={segments} group="dating" compact />
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
          <p className="flow-description">Pick a prompt and paste your answer for each one you use.</p>
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
