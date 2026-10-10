"use client";

import { AudienceClash } from "@/components/AudienceClash";
import { AudiencePicker } from "@/components/AudiencePicker";
import { ConsentStep } from "@/components/ConsentStep";
import { IdentityFacts } from "@/components/IdentityFacts";
import { InputStep, type LinkedInInput } from "@/components/InputStep";
import { ErrorNotice } from "@/components/labels";
import { RewriteComparison } from "@/components/RewriteComparison";
import { Button } from "@/components/ui/button";
import { errorMessage, evaluateProfile, extractFacts, rewriteProfile } from "@/lib/api-client";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_INPUT } from "@/lib/demo-data";
import { LINKEDIN_CONFIG } from "@/lib/rubrics";
import type { EvaluateResponse, IdentityFact, RewriteResponse, RewriteTone } from "@/lib/schemas";
import { segmentLinkedIn } from "@/lib/segments";
import { useMemo, useRef, useState } from "react";

// Owns the whole flow and its state. Each step is a props-only component, so
// a redesigned version (e.g. from Lovable) can replace it without touching this logic.
// Rules enforced here: nothing is sent to the AI before consent, only confirmed
// facts reach the rewrite, and sample mode is only offered for the demo persona.

const STEPS = ["input", "consent", "facts", "audiences", "clash", "rewrite"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABEL: Record<Step, string> = {
  input: "Profile",
  consent: "Consent",
  facts: "Facts",
  audiences: "Audiences",
  clash: "Feedback",
  rewrite: "Rewrite",
};

type Async<T> = { status: "idle" | "loading" | "done" | "error"; data: T | null; error: string | null };
const idle = <T,>(): Async<T> => ({ status: "idle", data: null, error: null });

const EMPTY_INPUT: LinkedInInput = { headline: "", about: "", jobDescription: "" };

export function PersonaFlow() {
  const config = LINKEDIN_CONFIG;
  const [step, setStep] = useState<Step>("input");
  const [input, setInput] = useState<LinkedInInput>(EMPTY_INPUT);
  const [usingDemo, setUsingDemo] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [consent, setConsent] = useState(false);

  const [facts, setFacts] = useState<IdentityFact[]>([]);
  const [extract, setExtract] = useState<Async<true>>(idle());
  const extractedFor = useRef<string | null>(null);

  const [audiences, setAudiences] = useState<string[]>(config.audiences.map((a) => a.id));
  const [traits, setTraits] = useState<string[]>(config.traits.slice(0, 3).map((t) => t.id));
  const [evaluation, setEvaluation] = useState<Async<EvaluateResponse>>(idle());

  const [tone, setTone] = useState<RewriteTone>("balanced");
  const [goal, setGoal] = useState("");
  const [rewrite, setRewrite] = useState<Async<RewriteResponse>>(idle());

  // Ignore responses from requests that were superseded.
  const requestId = useRef(0);

  const segments = useMemo(() => segmentLinkedIn(input), [input]);
  const original = [input.headline.trim(), input.about.trim()].filter(Boolean).join("\n\n");
  const confirmedFacts = facts.filter((f) => f.confirmed && f.text.trim());
  const sample = usingDemo && sampleMode;

  const resetResults = () => {
    setEvaluation(idle());
    setRewrite(idle());
  };

  const changeInput = (next: LinkedInInput) => {
    setInput(next);
    const isDemo =
      next.headline === DEMO_LINKEDIN_INPUT.headline && next.about === DEMO_LINKEDIN_INPUT.about;
    setUsingDemo(isDemo);
    if (!isDemo) setSampleMode(false);
    resetResults();
  };

  const loadDemo = () => {
    setInput({ ...DEMO_LINKEDIN_INPUT, jobDescription: "" });
    setUsingDemo(true);
    setFacts(DEMO_LINKEDIN_FACTS);
    // Demo facts are preloaded, so no extraction is needed for this text.
    extractedFor.current = `${DEMO_LINKEDIN_INPUT.headline}\n\n${DEMO_LINKEDIN_INPUT.about}`;
    setExtract({ status: "done", data: true, error: null });
    resetResults();
  };

  // `consented` is passed explicitly on the consent click, before React has applied setConsent(true).
  const runExtract = async (consented = consent) => {
    if (!consented) return;
    const id = ++requestId.current;
    setExtract({ status: "loading", data: null, error: null });
    try {
      const res = await extractFacts({ consent: true, platform: "linkedin", segments }, { sample });
      if (id !== requestId.current) return;
      // Keep facts the user added; replace earlier AI suggestions.
      setFacts((prev) => [...prev.filter((f) => f.source === "user"), ...res.facts]);
      extractedFor.current = original;
      setExtract({ status: "done", data: true, error: null });
    } catch (err) {
      if (id !== requestId.current) return;
      setExtract({ status: "error", data: null, error: errorMessage(err) });
    }
  };

  const runEvaluate = async () => {
    if (!consent) return;
    const id = ++requestId.current;
    setStep("clash");
    setEvaluation({ status: "loading", data: null, error: null });
    try {
      const res = await evaluateProfile(
        {
          consent: true,
          platform: "linkedin",
          segments,
          audiences,
          traits,
          jobDescription: input.jobDescription.trim() || undefined,
        },
        { sample },
      );
      if (id !== requestId.current) return;
      setEvaluation({ status: "done", data: res, error: null });
    } catch (err) {
      if (id !== requestId.current) return;
      setEvaluation({ status: "error", data: null, error: errorMessage(err) });
    }
  };

  const runRewrite = async (adversarial = false) => {
    if (!consent) return;
    const id = ++requestId.current;
    setRewrite({ status: "loading", data: null, error: null });
    try {
      const res = await rewriteProfile(
        {
          consent: true,
          platform: "linkedin",
          segments,
          facts: confirmedFacts.map((f) => ({ ...f, confirmed: true as const })),
          audiences,
          goal: goal.trim() || undefined,
          tone,
          jobDescription: input.jobDescription.trim() || undefined,
        },
        { sample, adversarial },
      );
      if (id !== requestId.current) return;
      setRewrite({ status: "done", data: res, error: null });
    } catch (err) {
      if (id !== requestId.current) return;
      setRewrite({ status: "error", data: null, error: errorMessage(err) });
    }
  };

  const goToFacts = (consented = consent) => {
    setStep("facts");
    if (extractedFor.current !== original) void runExtract(consented);
  };

  const stepIndex = STEPS.indexOf(step);
  const back = () => setStep(STEPS[Math.max(0, stepIndex - 1)]);

  return (
    <div className="space-y-6">
      <nav aria-label="Progress">
        <ol className="flex flex-wrap gap-1 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={s === step ? "step" : undefined}
              className={`rounded-md px-2 py-1 ${
                s === step ? "bg-primary text-primary-foreground" : i < stepIndex ? "bg-muted" : "text-muted-foreground"
              }`}
            >
              {i + 1}. {STEP_LABEL[s]}
            </li>
          ))}
        </ol>
      </nav>

      {sample && step !== "input" && step !== "consent" && (
        <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
          Sample mode: results are cached demo data, not a live AI run.
        </p>
      )}

      {step === "input" && (
        <InputStep
          value={input}
          onChange={changeInput}
          onLoadDemo={loadDemo}
          usingDemo={usingDemo}
          onContinue={() => (consent ? goToFacts() : setStep("consent"))}
        />
      )}

      {step === "consent" && (
        <ConsentStep
          sampleMode={sampleMode}
          onSampleModeChange={setSampleMode}
          canUseSample={usingDemo}
          onAgree={() => {
            setConsent(true);
            goToFacts(true);
          }}
          onBack={back}
        />
      )}

      {step === "facts" && (
        <IdentityFacts
          facts={facts}
          onChange={setFacts}
          loading={extract.status === "loading"}
          error={extract.error}
          onRetry={() => void runExtract()}
          onContinue={() => setStep("audiences")}
        />
      )}

      {step === "audiences" && (
        <AudiencePicker
          config={config}
          audiences={audiences}
          traits={traits}
          onChange={(sel) => {
            setAudiences(sel.audiences);
            setTraits(sel.traits);
          }}
          onContinue={() => void runEvaluate()}
        />
      )}

      {step === "clash" && (
        <>
          {evaluation.status === "loading" && (
            <p className="text-sm text-muted-foreground" aria-live="polite">Getting simulated feedback...</p>
          )}
          {evaluation.error && <ErrorNotice message={evaluation.error} onRetry={() => void runEvaluate()} />}
          {evaluation.data && (
            <AudienceClash
              result={evaluation.data}
              segments={segments}
              config={config}
              audienceIds={audiences}
              traitIds={traits}
              onRewrite={() => setStep("rewrite")}
            />
          )}
        </>
      )}

      {step === "rewrite" && (
        <RewriteComparison
          original={original}
          segments={segments}
          confirmedFacts={confirmedFacts}
          tone={tone}
          goal={goal}
          onOptionsChange={(o) => {
            setTone(o.tone);
            setGoal(o.goal);
          }}
          onGenerate={() => void runRewrite()}
          onShowAdversarial={() => void runRewrite(true)}
          result={rewrite.data}
          loading={rewrite.status === "loading"}
          error={rewrite.error}
        />
      )}

      {step !== "input" && (
        <Button type="button" variant="ghost" onClick={back}>
          Back
        </Button>
      )}
    </div>
  );
}
