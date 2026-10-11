"use client";

import { ArrowLeft, Check, ChevronRight, CircleHelp, Heart, House, RotateCcw, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AudienceClash } from "@/components/AudienceClash";
import { AudienceSelection } from "@/components/AudienceSelection";
import { Backdrop, BrandMark, WorldFooter, Wordmark } from "@/components/Chrome";
import { ConsentScreen } from "@/components/ConsentScreen";
import { IdentityFacts } from "@/components/IdentityFacts";
import { ProfileInput, type TextProfile } from "@/components/ProfileInput";
import { RewriteComparison } from "@/components/RewriteComparison";
import { Button } from "@/components/ui/button";
import { errorMessage, evaluateProfile, extractFacts, rewriteProfile } from "@/lib/api-client";
import { DEMO_BIO, DEMO_HINGE_FACTS, DEMO_HINGE_INPUT, DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_INPUT } from "@/lib/demo-data";
import { emptyHingePairs, HINGE_PROMPTS, MAX_HINGE_ANSWER, MAX_HINGE_PROMPTS, type HingePair } from "@/lib/persona-ui";
import { PLATFORM_CONFIGS, PLATFORM_SECTIONS } from "@/lib/rubrics";
import { LIMITS, type EvaluateResponse, type IdentityFact, type Platform, type RewriteResponse } from "@/lib/schemas";
import { segmentBio, segmentHinge, segmentLinkedIn } from "@/lib/segments";

// Owns the whole studio: state, API calls, and the Lovable page layout. Screens are props-only.
// Rules enforced here: nothing is sent to the AI before consent, only confirmed facts reach the
// rewrite, and sample mode is only offered for the LinkedIn demo persona (the only one with cached results).

const STEPS = ["Your profile", "Consent", "Identity DNA", "Audience lenses", "Audience Clash", "Rewrite + FactCheck"];
const [INPUT, CONSENT, FACTS, AUDIENCES, CLASH, REWRITE] = [0, 1, 2, 3, 4, 5];

const EMPTY_TEXT: TextProfile = { headline: "", about: "", jobDescription: "" };

/** One line under each platform name in the picker. */
const PLATFORM_BLURB: Record<Platform, string> = {
  linkedin: "Put your best work forward.",
  handshake: "Land the internship or first job.",
  instagram: "A bio that sounds like you.",
  facebook: "Let people know what you're up to.",
  twitter: "Say what you post about.",
  hinge: "Make a real connection.",
  tinder: "A first line worth replying to.",
};

/** Demo facts preloaded for each platform (all for the same fictitious persona). */
function demoFacts(p: Platform): IdentityFact[] {
  if (p === "linkedin") return DEMO_LINKEDIN_FACTS;
  if (p === "hinge") return DEMO_HINGE_FACTS;
  return DEMO_BIO[p].facts;
}

/** The Hinge demo has two answers; fill the third slot with an unused prompt. */
function demoHingePairs(): HingePair[] {
  const pairs = DEMO_HINGE_INPUT.map((p) => ({ ...p }));
  const unused = HINGE_PROMPTS.filter((prompt) => !pairs.some((p) => p.prompt === prompt));
  while (pairs.length < MAX_HINGE_PROMPTS) pairs.push({ prompt: unused[pairs.length] ?? HINGE_PROMPTS[0], answer: "" });
  return pairs;
}

const defaultAudiences = (p: Platform) => PLATFORM_CONFIGS[p].audiences.map((a) => a.id);
const defaultTraits = (p: Platform) => PLATFORM_CONFIGS[p].traits.slice(0, 3).map((t) => t.id);

type FlowError = { message: string; retry?: () => void };

export function PersonaFlow() {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const config = PLATFORM_CONFIGS[platform];
  const [step, setStep] = useState(INPUT);
  const [furthest, setFurthest] = useState(INPUT);
  const [error, setError] = useState<FlowError | null>(null);
  const [help, setHelp] = useState(false);

  const [text, setText] = useState<TextProfile>(EMPTY_TEXT);
  const [hinge, setHinge] = useState<HingePair[]>(emptyHingePairs);
  const [usingDemo, setUsingDemo] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const [consent, setConsent] = useState(false);

  const [facts, setFacts] = useState<IdentityFact[]>([]);
  const [extracting, setExtracting] = useState(false);
  const extractedFor = useRef<string | null>(null);

  const [audiences, setAudiences] = useState(defaultAudiences("linkedin"));
  const [traits, setTraits] = useState(defaultTraits("linkedin"));
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);

  const [goal, setGoal] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewrite, setRewrite] = useState<RewriteResponse | null>(null);
  const [adversarial, setAdversarial] = useState<RewriteResponse | null>(null);

  // Ignore responses from requests that were superseded (new input, platform switch, reset).
  const requestId = useRef(0);

  const segments = useMemo(
    () =>
      config.input === "headline_about"
        ? segmentLinkedIn(text)
        : config.input === "bio"
          ? segmentBio(text.about)
          : segmentHinge(hinge),
    [config.input, text, hinge],
  );
  const original =
    config.input === "headline_about"
      ? [text.headline.trim(), text.about.trim()].filter(Boolean).join("\n\n")
      : config.input === "bio"
        ? text.about.trim()
        : hinge.map((p) => p.answer.trim()).filter(Boolean).join("\n\n");
  const jobDescription = config.jobDescription ? text.jobDescription.trim() || undefined : undefined;
  const sourceKey = `${platform}|${original}`;
  const confirmedFacts = facts.filter((f) => f.confirmed && f.text.trim());
  const canUseSample = usingDemo && platform === "linkedin";
  const sample = canUseSample && sampleMode;
  const loading = extracting || evaluating || rewriting;

  const inputError = (() => {
    if (config.input !== "prompts") {
      if (!text.about.trim()) return `Add your ${config.fieldLabel} text before continuing.`;
      if (text.headline.length + text.about.length > LIMITS.profileText) return "Keep your profile under 4,000 characters.";
      return null;
    }
    if (!hinge.some((p) => p.answer.trim())) return "Add at least one prompt answer before continuing.";
    if (hinge.some((p) => p.answer.length > MAX_HINGE_ANSWER)) return "Keep each Hinge answer under 300 characters.";
    return null;
  })();

  function go(next: number) {
    setStep(next);
    setFurthest((prev) => Math.max(prev, next));
    setError(null);
  }

  /** New text means new consent, new suggestions, and new results. Facts the user typed are kept. */
  function resetResults() {
    requestId.current++;
    setExtracting(false);
    setEvaluating(false);
    setRewriting(false);
    setConsent(false);
    setFurthest(INPUT);
    setEvaluation(null);
    setRewrite(null);
    setAdversarial(null);
  }

  function reset() {
    resetResults();
    setText(EMPTY_TEXT);
    setHinge(emptyHingePairs());
    setFacts([]);
    extractedFor.current = null;
    setUsingDemo(false);
    setSampleMode(false);
    setStep(INPUT);
    setError(null);
  }

  function switchPlatform(next: Platform) {
    if (next === platform) return;
    reset();
    setPlatform(next);
    setAudiences(defaultAudiences(next));
    setTraits(defaultTraits(next));
  }

  function changeText(next: TextProfile) {
    setText(next);
    setUsingDemo(
      platform === "linkedin"
        ? next.headline === DEMO_LINKEDIN_INPUT.headline && next.about === DEMO_LINKEDIN_INPUT.about
        : platform !== "hinge" && next.about === DEMO_BIO[platform].bio,
    );
    // The job description isn't profile text, so editing it alone keeps consent and facts.
    if (next.headline !== text.headline || next.about !== text.about) resetResults();
    else {
      setEvaluation(null);
      setRewrite(null);
      setAdversarial(null);
    }
  }

  function changeHinge(next: HingePair[]) {
    setHinge(next);
    setUsingDemo(false);
    resetResults();
  }

  function loadDemo() {
    resetResults();
    if (platform === "linkedin") {
      setText({ ...DEMO_LINKEDIN_INPUT, jobDescription: "" });
      extractedFor.current = `linkedin|${DEMO_LINKEDIN_INPUT.headline.trim()}\n\n${DEMO_LINKEDIN_INPUT.about.trim()}`;
    } else if (platform === "hinge") {
      const pairs = demoHingePairs();
      setHinge(pairs);
      extractedFor.current = `hinge|${pairs.map((p) => p.answer.trim()).filter(Boolean).join("\n\n")}`;
    } else {
      const { bio } = DEMO_BIO[platform];
      setText({ ...EMPTY_TEXT, about: bio });
      extractedFor.current = `${platform}|${bio.trim()}`;
    }
    setFacts(demoFacts(platform).map((f) => ({ ...f })));
    setUsingDemo(true);
    setStep(INPUT);
    setError(null);
  }

  // `consented` is passed explicitly from the consent click, before React has applied setConsent(true).
  async function runExtract(consented = consent) {
    if (!consented) return;
    const id = ++requestId.current;
    setExtracting(true);
    setError(null);
    try {
      const res = await extractFacts({ consent: true, platform, segments }, { sample });
      if (id !== requestId.current) return;
      // Keep facts the user added; replace earlier AI suggestions.
      setFacts((prev) => [...prev.filter((f) => f.source === "user"), ...res.facts].slice(0, LIMITS.maxFacts));
      extractedFor.current = sourceKey;
    } catch (err) {
      if (id !== requestId.current) return;
      setError({ message: errorMessage(err), retry: () => void runExtract() });
    } finally {
      if (id === requestId.current) setExtracting(false);
    }
  }

  function goToFacts(consented = consent) {
    go(FACTS);
    if (extractedFor.current !== sourceKey) void runExtract(consented);
  }

  function continueFromInput() {
    if (inputError) {
      setError({ message: inputError });
      return;
    }
    if (consent) goToFacts();
    else go(CONSENT);
  }

  async function runEvaluate() {
    if (!consent || !audiences.length || !traits.length) {
      setError({ message: "Confirm consent and choose at least one audience and trait." });
      return;
    }
    const id = ++requestId.current;
    setEvaluating(true);
    setError(null);
    try {
      const res = await evaluateProfile(
        {
          consent: true,
          platform,
          segments,
          audiences,
          traits,
          jobDescription,
        },
        { sample },
      );
      if (id !== requestId.current) return;
      setEvaluation(res);
      go(CLASH);
    } catch (err) {
      if (id !== requestId.current) return;
      setError({ message: errorMessage(err), retry: () => void runEvaluate() });
    } finally {
      if (id === requestId.current) setEvaluating(false);
    }
  }

  async function runRewrite(mode: "normal" | "adversarial" = "normal") {
    if (!consent || !confirmedFacts.length) {
      setError({ message: "Confirm at least one fact and agree to continue first." });
      return;
    }
    const id = ++requestId.current;
    setRewriting(true);
    setError(null);
    try {
      const res = await rewriteProfile(
        {
          consent: true,
          platform,
          segments,
          facts: confirmedFacts.map((f) => ({ ...f, confirmed: true as const })),
          audiences,
          goal: goal.trim() || undefined,
          tone: "balanced", // the two rewrite versions (direct, narrative) replace a tone control
          jobDescription,
        },
        { sample, adversarial: mode === "adversarial" },
      );
      if (id !== requestId.current) return;
      if (mode === "adversarial") setAdversarial(res);
      else {
        setRewrite(res);
        setAdversarial(null);
      }
    } catch (err) {
      if (id !== requestId.current) return;
      setError({ message: errorMessage(err), retry: () => void runRewrite(mode) });
    } finally {
      if (id === requestId.current) setRewriting(false);
    }
  }

  return (
    <div className="app-root" data-theme={config.category}>
      <Backdrop />
      <header className="site-header">
        <Wordmark />
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/" className="studio-link">
            Home
          </Link>
          <span className="session-label">One identity. Every platform.</span>
          <span className="header-avatar">You</span>
        </nav>
      </header>
      <main className="studio-shell">
        <div className="studio-topbar">
          <div className="breadcrumb">
            <Link href="/" aria-label="Home">
              <House size={13} />
            </Link>
            <ChevronRight size={11} />
            <span>Profile studio</span>
          </div>
          <span className="privacy-badge">
            <ShieldCheck size={13} />
            {sample ? "Sample mode · nothing sent or stored" : "Sent only after consent · nothing stored"}
          </span>
        </div>
        <div className="studio-body">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <Sparkles size={12} />
                Authentically you
              </div>
              <h1>You, in your best light.</h1>
              <p className="welcome-copy">One identity. Every platform. Authentically you.</p>
              <p className="principle-copy">Improve expression, not invent identity.</p>
            </div>
            {step > INPUT && (
              <Button variant="glass" onClick={reset} title="Clear this session">
                <RotateCcw />
                Start over
              </Button>
            )}
          </div>

          <div className="platform-sections" role="group" aria-label="Choose a platform">
            {PLATFORM_SECTIONS.map((section) => (
              <section key={section.category} aria-labelledby={`section-${section.category}`}>
                <h2 className="platform-section-title" id={`section-${section.category}`}>
                  {section.label}
                </h2>
                <div className="platform-grid">
                  {section.platforms.map((id) => (
                    <Button
                      variant="platform"
                      key={id}
                      data-platform={id}
                      data-category={section.category}
                      data-active={platform === id}
                      aria-pressed={platform === id}
                      disabled={loading}
                      onClick={() => switchPlatform(id)}
                    >
                      <span className="platform-icon">
                        <BrandMark platform={id} />
                      </span>
                      <span>
                        <span className="platform-name">{PLATFORM_CONFIGS[id].label}</span>
                        <span className="platform-description">{PLATFORM_BLURB[id]}</span>
                      </span>
                      <span className="platform-check" aria-hidden="true" />
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <nav className="stage-bar expanded-stages" aria-label="Profile workflow">
            {STEPS.map((label, index) => (
              <Button
                variant="stage"
                key={label}
                data-active={step === index}
                aria-current={step === index ? "step" : undefined}
                disabled={index > furthest || loading}
                onClick={() => go(index)}
              >
                <span className="stage-number">{index < step ? <Check size={11} /> : index + 1}</span>
                {label}
              </Button>
            ))}
          </nav>

          {sample && step >= FACTS && (
            <p className="prototype-notice">
              <ShieldCheck size={15} />
              Sample mode: results below are cached demo data for the fictitious persona, not a live AI run.
            </p>
          )}

          {error && (
            <div className="flow-error" role="alert">
              <TriangleAlert />
              <p>{error.message}</p>
              {error.retry && (
                <Button variant="glass" onClick={error.retry}>
                  Try again
                </Button>
              )}
              <Button variant="ghost" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          )}

          {step === INPUT && (
            <ProfileInput
              platform={platform}
              text={text}
              hinge={hinge}
              demo={usingDemo}
              canContinue={!inputError}
              onTextChange={changeText}
              onHingeChange={changeHinge}
              onLoadDemo={loadDemo}
              onContinue={continueFromInput}
              onError={(message) => setError(message ? { message } : null)}
            />
          )}
          {step === CONSENT && (
            <ConsentScreen
              canUseSample={canUseSample}
              sampleMode={sampleMode}
              onSampleModeChange={setSampleMode}
              onAgree={() => {
                setConsent(true);
                goToFacts(true);
              }}
              onBack={() => go(INPUT)}
            />
          )}
          {step === FACTS && (
            <IdentityFacts
              facts={facts}
              demoFactIds={usingDemo ? demoFacts(platform).map((f) => f.id) : []}
              loading={extracting}
              onChange={(next) => {
                setFacts(next);
                setRewrite(null);
                setAdversarial(null);
              }}
              onContinue={() => go(AUDIENCES)}
            />
          )}
          {step === AUDIENCES && (
            <AudienceSelection
              config={config}
              audiences={audiences}
              traits={traits}
              loading={evaluating}
              onAudiences={(ids) => {
                setAudiences(ids);
                setEvaluation(null);
                setFurthest(AUDIENCES);
              }}
              onTraits={(ids) => {
                setTraits(ids);
                setEvaluation(null);
                setFurthest(AUDIENCES);
              }}
              onFeedback={() => void runEvaluate()}
            />
          )}
          {step === CLASH && evaluation && (
            <AudienceClash
              response={evaluation}
              config={config}
              audiences={audiences}
              traits={traits}
              segments={segments}
              onRewrite={() => go(REWRITE)}
            />
          )}
          {step === REWRITE && (
            <RewriteComparison
              original={original}
              segments={segments}
              confirmedFacts={confirmedFacts}
              result={adversarial ?? rewrite}
              goal={goal}
              loading={rewriting}
              adversarial={adversarial !== null}
              onGoal={setGoal}
              onGenerate={() => void runRewrite()}
              onAdversarial={(enabled) => (enabled ? void runRewrite("adversarial") : setAdversarial(null))}
              onError={(message) => setError({ message })}
            />
          )}

          {step > INPUT && step !== CONSENT && (
            <div className="back-row">
              <Button variant="ghost" disabled={loading} onClick={() => go(step - 1)}>
                <ArrowLeft />
                Go back
              </Button>
            </div>
          )}
        </div>
        <footer className="studio-footer">
          <span className="footer-message">
            <ShieldCheck size={12} />
            Honest words. Real connections. Always you.
          </span>
          <span>Made for your next chapter.</span>
          <Button variant="link" className="sample-link" aria-expanded={help} onClick={() => setHelp(!help)}>
            <CircleHelp />A little help
          </Button>
        </footer>
        {help && (
          <p className="help-note">
            Nothing is sent until you agree on the consent step. After that, your profile text and confirmed facts go
            to OpenRouter and the underlying AI model provider; nothing is stored by this app. All feedback is
            simulated AI feedback, not real people. Rewrites may only use facts you confirm, and FactCheck flags
            numbers, names, and stronger verbs it can&apos;t trace to your words. Sample results are labeled.
            Refreshing clears your session.
          </p>
        )}
      </main>
      <WorldFooter>
        A little clarity. A lot of you. <Heart size={10} />
      </WorldFooter>
    </div>
  );
}
