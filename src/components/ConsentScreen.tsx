"use client";

import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConsentScreen(props: {
  canUseSample: boolean;
  sampleMode: boolean;
  onSampleModeChange: (enabled: boolean) => void;
  onAgree: () => void;
  onBack: () => void;
}) {
  const { canUseSample, sampleMode, onSampleModeChange, onAgree, onBack } = props;
  return (
    <section className="flow-section consent-screen fade-in">
      <div className="upload-icon">
        <ShieldCheck />
      </div>
      <h2 className="flow-title">Your words. Your choice.</h2>
      <p className="flow-description">Before anything goes to the AI, you decide what to share.</p>
      <dl className="consent-details">
        <div>
          <dt>What is sent</dt>
          <dd>
            Your profile text, any job description you added, and only the facts you confirm in the next step.
          </dd>
        </div>
        <div>
          <dt>Who receives it</dt>
          <dd>OpenRouter and the underlying AI model provider, to generate simulated feedback and rewrites.</dd>
        </div>
        <div>
          <dt>What is stored</dt>
          <dd>Nothing is stored by this app. Your profile and facts stay only for this session.</dd>
        </div>
      </dl>
      {canUseSample && (
        <label className="sample-toggle">
          <input type="checkbox" checked={sampleMode} onChange={(event) => onSampleModeChange(event.target.checked)} />
          <span>
            Use sample results instead (demo persona only). Nothing is sent to the AI, and every result is labeled
            &ldquo;Sample result&rdquo;.
          </span>
        </label>
      )}
      <div className="action-band">
        <Button variant="glass" onClick={onBack}>
          <ArrowLeft />
          Go back
        </Button>
        <Button variant="aero" onClick={onAgree}>
          {sampleMode && canUseSample ? "Continue with samples" : "I agree, continue"} <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
