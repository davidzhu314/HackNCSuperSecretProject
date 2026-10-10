"use client";

import { ArrowLeft, Check, ChevronRight, CircleHelp, House, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AudienceClash } from "@/components/AudienceClash";
import { AudienceSelection } from "@/components/AudienceSelection";
import { Backdrop, BrandMark, WorldFooter, Wordmark } from "@/components/Chrome";
import { ConsentScreen } from "@/components/ConsentScreen";
import { IdentityFacts } from "@/components/IdentityFacts";
import { LinkedInEditor, type ImportState } from "@/components/LinkedInEditor";
import { ProfileClash } from "@/components/ProfileClash";
import { ProfileInput } from "@/components/ProfileInput";
import { RewriteComparison } from "@/components/RewriteComparison";
import { SectionRewrites, type SectionRewriteState } from "@/components/SectionRewrites";
import { Button } from "@/components/ui/button";
import { errorMessage, evaluateProfile, extractFacts, rewriteProfile, rewriteSection } from "@/lib/api-client";
import { saveConsent, useStoredConsent, withdrawConsent } from "@/lib/consent";
import { DEMO_HINGE_FACTS, DEMO_HINGE_INPUT, DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE } from "@/lib/demo-data";
import { emptyHingePairs, HINGE_PROMPTS, mergeFacts, MAX_HINGE_ANSWER, MAX_HINGE_PROMPTS, type HingePair } from "@/lib/persona-ui";
import { emptyLinkedInProfile, factCheckSegments, findSection, profileCharCount, rewritableSections, segmentProfile } from "@/lib/profile";
import { cleanProfile, importProfileFile } from "@/lib/profile-import";
import { DEFAULT_LINKEDIN_AUDIENCES, PLATFORM_CONFIGS } from "@/lib/rubrics";
import { runLimited } from "@/lib/run-limited";
import {
  LIMITS,
  LinkedInProfileSchema,
  type EvaluateResponse,
  type IdentityFact,
  type LinkedInProfile,
  type Platform,
  type RewriteResponse,
  type RewriteStyle,
  type Segment,
} from "@/lib/schemas";
import { segmentHinge } from "@/lib/segments";

// Owns the whole studio: state, API calls, and the page layout. Screens are props-only.
// Rules enforced here: nothing is sent to the AI before consent (asked once per browser, remembered
// as a flag), only confirmed facts reach a rewrite, and sample mode, which sends nothing and so
// needs no consent, is only offered for the LinkedIn demo persona (the only one with cached results).
// LinkedIn works on a sectioned profile; Hinge keeps its prompt answers and single rewrite.

const STEPS = ["Your profile", "Consent", "Identity DNA", "Audience lenses", "Audience Clash", "Rewrite + FactCheck"];
const [INPUT, CONSENT, FACTS, AUDIENCES, CLASH, REWRITE] = [0, 1, 2, 3, 4, 5];

/** At most this many section rewrites run at once ("Rewrite all"). */
const PARALLEL_REWRITES = 3;

/** The Hinge demo has two answers; fill the third slot with an unused prompt. */
function demoHingePairs(): HingePair[] {
  const pairs = DEMO_HINGE_INPUT.map((p) => ({ ...p }));
  const unused = HINGE_PROMPTS.filter((prompt) => !pairs.some((p) => p.prompt === prompt));
  while (pairs.length < MAX_HINGE_PROMPTS) pairs.push({ prompt: unused[pairs.length] ?? HINGE_PROMPTS[0], answer: "" });
  return pairs;
}

/** Demo facts are recognized by text: merging may renumber their ids. */
const DEMO_FACT_TEXTS = new Set([...DEMO_LINKEDIN_FACTS, ...DEMO_HINGE_FACTS].map((f) => f.text));
const DEMO_PROFILE_JSON = JSON.stringify(DEMO_LINKEDIN_PROFILE);

const defaultAudiences = (p: Platform): string[] =>
  p === "linkedin" ? [...DEFAULT_LINKEDIN_AUDIENCES] : PLATFORM_CONFIGS[p].audiences.map((a) => a.id);
const defaultTraits = (p: Platform) => PLATFORM_CONFIGS[p].traits.slice(0, 3).map((t) => t.id);

/** What the extracted facts were found in, so extraction reruns only when the text changes. */
const textKey = (platform: Platform, segments: Segment[]) => `${platform}|${segments.map((s) => s.text).join("\n")}`;

const emptySection = (style: RewriteStyle): SectionRewriteState => ({ style, results: {}, loading: null, error: null });

type FlowError = { message: string; retry?: () => void };

/** `initialPlatform` comes from the URL (`/studio?platform=hinge`), e.g. from the Identity Hub. */
export function PersonaFlow({ initialPlatform = "linkedin" }: { initialPlatform?: Platform }) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const config = PLATFORM_CONFIGS[platform];
  const [step, setStep] = useState(INPUT);
  const [furthest, setFurthest] = useState(INPUT);
  const [error, setError] = useState<FlowError | null>(null);
  const [help, setHelp] = useState(false);

  // LinkedIn: a sectioned profile. Hinge: prompt answers.
  const [profile, setProfile] = useState<LinkedInProfile>(emptyLinkedInProfile);
  const [jobDescription, setJobDescription] = useState("");
  const [imported, setImported] = useState<ImportState>(null);
  const [importing, setImporting] = useState(false);
  const [hinge, setHinge] = useState<HingePair[]>(emptyHingePairs);
  const [hingeDemo, setHingeDemo] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const consent = useStoredConsent();

  const [facts, setFacts] = useState<IdentityFact[]>([]);
  const [extracting, setExtracting] = useState(false);
  const extractedFor = useRef<string | null>(null);

  const [audiences, setAudiences] = useState(() => defaultAudiences(initialPlatform));
  const [traits, setTraits] = useState(() => defaultTraits(initialPlatform));
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);

  const [goal, setGoal] = useState("");
  // Hinge: one rewrite of all answers.
  const [rewriting, setRewriting] = useState(false);
  const [rewrite, setRewrite] = useState<RewriteResponse | null>(null);
  const [adversarial, setAdversarial] = useState<RewriteResponse | null>(null);
  // LinkedIn: one rewrite per section per style, cached.
  const [sectionStates, setSectionStates] = useState<Record<string, SectionRewriteState>>({});
  const [allStyle, setAllStyle] = useState<RewriteStyle>("direct");
  const [rewritingAll, setRewritingAll] = useState(false);
  const [focusSection, setFocusSection] = useState<string | null>(null);

  // Ignore responses from requests that were superseded (new input, new facts, platform switch, reset).
  const requestId = useRef(0);
  const sectionGen = useRef(0);

  const clean = useMemo(() => cleanProfile(profile), [profile]);
  const segments = useMemo(
    () => (platform === "linkedin" ? segmentProfile(clean) : segmentHinge(hinge)),
    [platform, clean, hinge],
  );
  const sections = useMemo(() => (platform === "linkedin" ? rewritableSections(clean) : []), [platform, clean]);
  const hingeOriginal = hinge.map((p) => p.answer.trim()).filter(Boolean).join("\n\n");
  const sourceKey = textKey(platform, segments);
  const confirmedFacts = facts.filter((f) => f.confirmed && f.text.trim());
  const usingDemo = platform === "linkedin" ? JSON.stringify(clean) === DEMO_PROFILE_JSON : hingeDemo;
  const canUseSample = usingDemo && platform === "linkedin";
  const sample = canUseSample && sampleMode;
  /** May this run proceed? Sample mode sends nothing, so it never needs consent. */
  const allowed = sample || consent;
  const loading = extracting || evaluating || rewriting || rewritingAll || importing;

  const inputError = (() => {
    if (platform === "linkedin") {
      if (!segments.length) return "Add at least a headline, About, or one entry before continuing.";
      if (profileCharCount(clean) > LIMITS.profileText)
        return `Keep your profile under ${LIMITS.profileText.toLocaleString()} characters.`;
      const parsed = LinkedInProfileSchema.safeParse(clean);
      return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Check your profile.");
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

  /** Rewrites depend on the text and the confirmed facts; drop them when either changes. */
  function clearRewrites() {
    sectionGen.current++;
    setSectionStates({});
    setRewritingAll(false);
    setRewrite(null);
    setAdversarial(null);
  }

  /** New text means new suggestions and new results. Facts the user typed are kept; consent is remembered. */
  function resetResults() {
    requestId.current++;
    setExtracting(false);
    setEvaluating(false);
    setRewriting(false);
    setFurthest(INPUT);
    setEvaluation(null);
    setFocusSection(null);
    clearRewrites();
  }

  function reset() {
    resetResults();
    setProfile(emptyLinkedInProfile());
    setJobDescription("");
    setImported(null);
    setHinge(emptyHingePairs());
    setHingeDemo(false);
    setFacts([]);
    extractedFor.current = null;
    setSampleMode(false);
    setStep(INPUT);
    setError(null);
  }

  /**
   * One identity, every platform: switching clears the profile text and results, but keeps the
   * facts the user confirmed or typed. They are true about the person on LinkedIn and Hinge alike.
   */
  function switchPlatform(next: Platform) {
    if (next === platform) return;
    const kept = facts.filter((f) => f.confirmed || f.source === "user");
    reset();
    setFacts(kept);
    setPlatform(next);
    setAudiences(defaultAudiences(next));
    setTraits(defaultTraits(next));
  }

  function changeProfile(next: LinkedInProfile) {
    setProfile(next);
    resetResults();
  }

  function changeJobDescription(text: string) {
    // The job description isn't profile text: it changes feedback and rewrites, not consent or facts.
    setJobDescription(text);
    setEvaluation(null);
    clearRewrites();
  }

  function changeHinge(next: HingePair[]) {
    setHinge(next);
    setHingeDemo(false);
    resetResults();
  }

  async function importFile(file: File) {
    setImporting(true);
    setError(null);
    try {
      const res = await importProfileFile(file);
      setProfile(res.profile);
      setImported({ fileName: file.name, warnings: res.warnings });
      resetResults();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "That file couldn’t be read." });
    } finally {
      setImporting(false);
    }
  }

  function loadDemo() {
    resetResults();
    if (platform === "linkedin") {
      setProfile(structuredClone(DEMO_LINKEDIN_PROFILE));
      setImported(null);
      setFacts((prev) => mergeFacts(prev, DEMO_LINKEDIN_FACTS));
      // Demo facts are preloaded, so no extraction is needed for this text.
      extractedFor.current = textKey("linkedin", segmentProfile(DEMO_LINKEDIN_PROFILE));
    } else {
      const pairs = demoHingePairs();
      setHinge(pairs);
      setHingeDemo(true);
      setFacts((prev) => mergeFacts(prev, DEMO_HINGE_FACTS));
      extractedFor.current = textKey("hinge", segmentHinge(pairs));
    }
    setStep(INPUT);
    setError(null);
  }

  // `ok` is passed explicitly from the consent click, before the stored flag has re-rendered.
  async function runExtract(ok = allowed) {
    if (!ok) return;
    const id = ++requestId.current;
    setExtracting(true);
    setError(null);
    try {
      const res = await extractFacts({ consent: true, platform, segments }, { sample });
      if (id !== requestId.current) return;
      // Keep confirmed and user-added facts (including ones carried over from the other platform);
      // replace earlier unconfirmed AI suggestions.
      setFacts((prev) => mergeFacts(prev, res.facts));
      extractedFor.current = sourceKey;
    } catch (err) {
      if (id !== requestId.current) return;
      setError({ message: errorMessage(err), retry: () => void runExtract() });
    } finally {
      if (id === requestId.current) setExtracting(false);
    }
  }

  function goToFacts(ok = allowed) {
    go(FACTS);
    if (extractedFor.current !== sourceKey) void runExtract(ok);
  }

  /** Forget consent in this browser. Results already on screen stay; the next AI call asks again. */
  function withdraw() {
    withdrawConsent();
    if (!sample && step > CONSENT) go(CONSENT);
  }

  function continueFromInput() {
    if (inputError) {
      setError({ message: inputError });
      return;
    }
    if (allowed) goToFacts();
    else go(CONSENT);
  }

  async function runEvaluate() {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    if (!audiences.length || !traits.length) {
      setError({ message: "Choose at least one audience and trait." });
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
          jobDescription: platform === "linkedin" ? jobDescription.trim() || undefined : undefined,
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

  /** Hinge rewrite, and the FactCheck demo on both platforms. */
  async function runRewrite(mode: "normal" | "adversarial" = "normal") {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    if (!confirmedFacts.length) {
      setError({ message: "Confirm at least one fact first." });
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
          jobDescription: platform === "linkedin" ? jobDescription.trim() || undefined : undefined,
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

  function patchSection(key: string, patch: Partial<SectionRewriteState>) {
    setSectionStates((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptySection(allStyle)), ...patch } }));
  }

  /** LinkedIn: rewrite one section in one style. Errors stay on that section's card. */
  async function runSection(key: string, style: RewriteStyle) {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    const section = findSection(clean, key);
    if (!section) return;
    if (!confirmedFacts.length) {
      setError({ message: "Confirm at least one fact first." });
      return;
    }
    const gen = sectionGen.current;
    patchSection(key, { style, loading: style, error: null });
    try {
      const res = await rewriteSection(
        {
          consent: true,
          platform: "linkedin",
          section,
          profile: clean,
          facts: confirmedFacts.map((f) => ({ ...f, confirmed: true as const })),
          style,
          audiences,
          goal: goal.trim() || undefined,
          jobDescription: jobDescription.trim() || undefined,
        },
        { sample },
      );
      if (gen !== sectionGen.current) return;
      setSectionStates((prev) => {
        const cur = prev[key] ?? emptySection(style);
        return { ...prev, [key]: { ...cur, results: { ...cur.results, [style]: res }, loading: null, error: null } };
      });
    } catch (err) {
      if (gen !== sectionGen.current) return;
      patchSection(key, { loading: null, error: errorMessage(err) });
    }
  }

  /** Picking a style shows its cached result; if the other style was already generated, generate this one too. */
  function chooseStyle(key: string, style: RewriteStyle) {
    const cur = sectionStates[key] ?? emptySection(allStyle);
    patchSection(key, { style });
    const engaged = Object.keys(cur.results).length > 0;
    if (engaged && !cur.results[style]) void runSection(key, style);
  }

  async function rewriteAll() {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    setRewritingAll(true);
    const gen = sectionGen.current;
    // Cached sections switch instantly; the rest run at most PARALLEL_REWRITES at a time.
    for (const s of sections) patchSection(s.key, { style: allStyle });
    const todo = sections.filter((s) => !sectionStates[s.key]?.results[allStyle]);
    await runLimited(todo, PARALLEL_REWRITES, (s) => runSection(s.key, allStyle));
    if (gen === sectionGen.current) setRewritingAll(false);
  }

  const sourcesFor = (key: string): Segment[] => factCheckSegments(clean, key) ?? [];

  return (
    <div className="app-root" data-theme={platform}>
      <Backdrop />
      <header className="site-header">
        <Wordmark />
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/" className="studio-link">
            Home
          </Link>
          <Link href="/hub" className="studio-link">
            Identity Hub
          </Link>
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
            {sample ? "Sample mode · nothing sent or stored" : consent ? "You agreed to send text to the AI · nothing stored" : "Nothing sent until you agree · nothing stored"}
            {consent && (
              <Button variant="link" className="withdraw-link" onClick={withdraw}>
                Withdraw consent
              </Button>
            )}
          </span>
        </div>
        <div className="studio-body">
          <div className="welcome-row">
            <div>
              <h1>Profile studio</h1>
              <p className="welcome-copy">Add your profile, confirm your facts, get feedback, then rewrite.</p>
            </div>
            {step > INPUT && (
              <Button variant="glass" onClick={reset} title="Clear this session">
                <RotateCcw />
                Start over
              </Button>
            )}
          </div>

          <div className="platform-grid" aria-label="Choose a platform">
            {(["linkedin", "hinge"] as const).map((id) => (
              <Button
                variant="platform"
                key={id}
                data-platform={id}
                data-active={platform === id}
                aria-pressed={platform === id}
                disabled={loading}
                onClick={() => switchPlatform(id)}
              >
                <span className="platform-icon">
                  <BrandMark platform={id} />
                </span>
                <span>
                  <span className="platform-name">{id === "linkedin" ? "LinkedIn" : "Hinge"}</span>
                  <span className="platform-description">
                    {id === "linkedin" ? "Headline, About, and experience" : "Prompt answers"}
                  </span>
                </span>
                <span className="platform-check" aria-hidden="true" />
              </Button>
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

          {step === INPUT && platform === "linkedin" && (
            <LinkedInEditor
              profile={profile}
              jobDescription={jobDescription}
              demo={usingDemo}
              imported={imported}
              importing={importing}
              canUseSample={canUseSample}
              sampleMode={sampleMode}
              canContinue={!inputError && !importing}
              onChange={changeProfile}
              onJobDescription={changeJobDescription}
              onImportFile={(file) => void importFile(file)}
              onLoadDemo={loadDemo}
              onSampleModeChange={setSampleMode}
              onContinue={continueFromInput}
            />
          )}
          {step === INPUT && platform === "hinge" && (
            <ProfileInput
              hinge={hinge}
              demo={hingeDemo}
              canContinue={!inputError}
              onHingeChange={changeHinge}
              onLoadDemo={loadDemo}
              onContinue={continueFromInput}
            />
          )}
          {step === CONSENT && (
            <ConsentScreen
              alreadyAgreed={consent}
              onAgree={() => {
                saveConsent();
                goToFacts(true);
              }}
              onWithdraw={withdraw}
              onBack={() => go(INPUT)}
            />
          )}
          {step === FACTS && (
            <IdentityFacts
              facts={facts}
              demoFactIds={facts.filter((f) => DEMO_FACT_TEXTS.has(f.text)).map((f) => f.id)}
              loading={extracting}
              onChange={(next) => {
                setFacts(next);
                clearRewrites();
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
          {step === CLASH && evaluation && platform === "linkedin" && (
            <ProfileClash
              response={evaluation}
              config={config}
              audiences={audiences}
              traits={traits}
              profile={clean}
              segments={segments}
              onRewriteSection={(key) => {
                setFocusSection(key);
                go(REWRITE);
              }}
              onRewrite={() => {
                setFocusSection(null);
                go(REWRITE);
              }}
            />
          )}
          {step === CLASH && evaluation && platform === "hinge" && (
            <AudienceClash
              response={evaluation}
              config={config}
              audiences={audiences}
              traits={traits}
              segments={segments}
              onRewrite={() => go(REWRITE)}
            />
          )}
          {step === REWRITE && platform === "linkedin" && (
            <SectionRewrites
              sections={sections}
              states={sectionStates}
              sourcesFor={sourcesFor}
              confirmedFacts={confirmedFacts}
              goal={goal}
              allStyle={allStyle}
              rewritingAll={rewritingAll}
              focusKey={focusSection}
              adversarial={adversarial}
              adversarialOriginal={[clean.headline, clean.about].filter((t) => t.trim()).join("\n\n")}
              adversarialSegments={segments}
              onGoal={(g) => {
                setGoal(g);
              }}
              onStyle={chooseStyle}
              onGenerate={(key) => void runSection(key, sectionStates[key]?.style ?? allStyle)}
              onAllStyle={setAllStyle}
              onRewriteAll={() => void rewriteAll()}
              onAdversarial={(enabled) => (enabled ? void runRewrite("adversarial") : setAdversarial(null))}
              onError={(message) => setError({ message })}
            />
          )}
          {step === REWRITE && platform === "hinge" && (
            <RewriteComparison
              original={hingeOriginal}
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
            Nothing is stored. Refreshing clears your session.
          </span>
          <Button variant="link" className="sample-link" aria-expanded={help} onClick={() => setHelp(!help)}>
            <CircleHelp />Help
          </Button>
        </footer>
        {help && (
          <p className="help-note">
            Nothing is sent until you agree, once per browser (only that yes is remembered; withdraw it any time
            from the top bar). After that, your profile text and confirmed facts go to OpenRouter and the
            underlying AI model provider; nothing else is stored by this app. Imported PDFs are read in your
            browser, and entry locations are never sent. Feedback is written by an AI model, not real people.
            Rewrites may only use facts you confirm, and FactCheck flags numbers, names, and stronger verbs it
            can&apos;t trace to your words. Sample results are labeled. Refreshing clears your session.
          </p>
        )}
      </main>
      <WorldFooter />
    </div>
  );
}
