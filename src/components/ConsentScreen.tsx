"use client";

import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConsentScreen(props: {
  /** Consent is remembered in this browser; the screen then only confirms it. */
  alreadyAgreed: boolean;
  onAgree: () => void;
  onWithdraw: () => void;
  onBack: () => void;
}) {
  const { alreadyAgreed, onAgree, onWithdraw, onBack } = props;
  return (
    <section className="flow-section consent-screen fade-in">
      <div className="upload-icon">
        <ShieldCheck />
      </div>
      <h2 className="flow-title">Send your text to the AI?</h2>
      <p className="flow-description">
        You’re asked once in this browser. Only your yes is remembered, and you can withdraw it any time.
      </p>
      <dl className="consent-details">
        <div>
          <dt>What is sent</dt>
          <dd>
            Your profile text, any job description you added, and the facts you add. On Tinder, that means your About me
            and prompt answers; rewrites also get your job title, company, school, and languages. Never where you live,
            and never your relationship, basics, or lifestyle picks. Lie Checker reads each fact you add, with your
            other facts, to check it adds up. Draft with AI sends the text you entered on your other platforms, under
            the same rules.
          </dd>
        </div>
        <div>
          <dt>Who receives it</dt>
          <dd>The AI provider, to generate feedback and rewrites: Google (Gemini API), or OpenRouter and the model&apos;s provider.</dd>
        </div>
        <div>
          <dt>What is stored</dt>
          <dd>Nothing but your yes. Your profile and facts stay only for this session.</dd>
        </div>
      </dl>
      <div className="action-band">
        <Button variant="glass" onClick={onBack}>
          <ArrowLeft />
          Go back
        </Button>
        {alreadyAgreed ? (
          <div className="consent-actions">
            <Button variant="ghost" onClick={onWithdraw}>
              Withdraw consent
            </Button>
            <Button variant="aero" onClick={onAgree}>
              Continue <ArrowRight />
            </Button>
          </div>
        ) : (
          <Button variant="aero" onClick={onAgree}>
            I agree, continue <ArrowRight />
          </Button>
        )}
      </div>
    </section>
  );
}
