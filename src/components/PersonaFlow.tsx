"use client";

import { ArrowLeft, CircleHelp, Fingerprint, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudienceClash } from "@/components/AudienceClash";
import { AudienceSelection } from "@/components/AudienceSelection";
import { BrandMark, SCENES, ScenicBackdrop, Wordmark } from "@/components/Chrome";
import { ConsentScreen } from "@/components/ConsentScreen";
import { IdentityFacts } from "@/components/IdentityFacts";
import { LinkedInEditor, type ImportState } from "@/components/LinkedInEditor";
import { ProfileClash } from "@/components/ProfileClash";
import { ProfileInput } from "@/components/ProfileInput";
import { RewriteComparison } from "@/components/RewriteComparison";
import { SectionRewrites, type SectionRewriteState } from "@/components/SectionRewrites";
import { TourStops } from "@/components/TourStops";
import { Button } from "@/components/ui/button";
import { errorMessage, evaluateProfile, extractFacts, rewriteProfile, rewriteSection } from "@/lib/api-client";
import { saveConsent, useStoredConsent, withdrawConsent } from "@/lib/consent";
import { getSession, updateSession, useIdentitySession } from "@/lib/identity-session";
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

const isDemoHinge = (pairs: HingePair[] | null) => !!pairs && JSON.stringify(pairs) === JSON.stringify(demoHingePairs());

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
  // The platform is the URL's (`/studio?platform=`); switching navigates, and the studio is keyed on it.
  const platform = initialPlatform;
  const router = useRouter();
  const config = PLATFORM_CONFIGS[platform];
  const [step, setStep] = useState(INPUT);
  const [furthest, setFurthest] = useState(INPUT);
  const [error, setError] = useState<FlowError | null>(null);
  const [help, setHelp] = useState(false);

  // LinkedIn: a sectioned profile. Hinge: prompt answers. Both start from the Identity Hub's
  // session (memory only), so the profile and facts follow the user between pages and platforms.
  const [profile, setProfile] = useState<LinkedInProfile>(() => getSession().linkedin ?? emptyLinkedInProfile());
  const [jobDescription, setJobDescription] = useState(() => getSession().jobDescription);
  const [imported, setImported] = useState<ImportState>(() => getSession().linkedinImport);
  const [importing, setImporting] = useState(false);
  const [hinge, setHinge] = useState<HingePair[]>(() => getSession().hinge ?? emptyHingePairs());
  const [hingeDemo, setHingeDemo] = useState(() => isDemoHinge(getSession().hinge));
  const [sampleMode, setSampleMode] = useState(false);
  const consent = useStoredConsent();
  const session = useIdentitySession();

  const [facts, setFacts] = useState<IdentityFact[]>(() => getSession().facts);
  const [extracting, setExtracting] = useState(false);
  // Demo text comes with its facts, so it needs no extraction.
  const extractedFor = useRef<string | null>(
    JSON.stringify(getSession().linkedin) === JSON.stringify(DEMO_LINKEDIN_PROFILE)
      ? textKey("linkedin", segmentProfile(DEMO_LINKEDIN_PROFILE))
      : isDemoHinge(getSession().hinge)
        ? textKey("hinge", segmentHinge(demoHingePairs()))
        : null,
  );

  // Keep the hub's session in step with the studio, writing only values this studio actually
  // changed. Mounting, or Next re-showing a page it kept hidden, re-runs this effect with the
  // same values, and must not overwrite newer data from elsewhere with a stale copy.
  const synced = useRef({ profile, imported, jobDescription, hinge, facts });
  useEffect(() => {
    const prev = synced.current;
    synced.current = { profile, imported, jobDescription, hinge, facts };
    const patch: Parameters<typeof updateSession>[0] = {};
    if (profile !== prev.profile) patch.linkedin = segmentProfile(profile).length ? profile : null;
    if (imported !== prev.imported) patch.linkedinImport = imported;
    if (jobDescription !== prev.jobDescription) patch.jobDescription = jobDescription;
    if (hinge !== prev.hinge) patch.hinge = hinge.some((p) => p.answer.trim()) ? hinge : null;
    if (facts !== prev.facts) patch.facts = facts;
    if (Object.keys(patch).length) updateSession(patch);
  }, [profile, imported, jobDescription, hinge, facts]);

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

  /** `scroll: false` when the next screen scrolls to something itself (a focused section). */
  function go(next: number, { scroll = true } = {}) {
    setStep(next);
    setFurthest((prev) => Math.max(prev, next));
    setError(null);
    // A new step starts at the top, next to the step rail, not wherever the last one was scrolled.
    if (scroll && window.scrollY > 0) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    }
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

  /**
   * Start over on this platform: clears its text and results. Facts the user confirmed or typed
   * stay (they're true on every platform); the hub's "Clear this session" removes everything.
   */
  function reset() {
    resetResults();
    if (platform === "linkedin") {
      setProfile(emptyLinkedInProfile());
      setJobDescription("");
      setImported(null);
    } else {
      setHinge(emptyHingePairs());
      setHingeDemo(false);
    }
    setFacts((prev) => prev.filter((f) => f.confirmed || f.source === "user"));
    extractedFor.current = null;
    setSampleMode(false);
    setStep(INPUT);
    setError(null);
  }

  /**
   * One identity, every platform: switching keeps both profiles and the facts the user confirmed
   * or typed (true on LinkedIn and Hinge alike); results and unconfirmed suggestions are dropped.
   */
  function switchPlatform(next: Platform) {
    if (next === platform) return;
    // Both profiles stay in the hub's session; the studio for `next` starts from it. `external`
    // also restarts any studio Next kept hidden, so going back can't show a stale copy.
    updateSession({ facts: facts.filter((f) => f.confirmed || f.source === "user") }, { external: true });
    router.replace(`/studio?platform=${next}`, { scroll: false });
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

  const scene = SCENES[platform];
  const status = sample
    ? "Sample mode · nothing sent or stored"
    : consent
      ? "You agreed to send text to the AI · nothing stored"
      : "Nothing sent until you agree · nothing stored";

  return (
    <div className="app-root tour-root" data-theme={platform}>
      <ScenicBackdrop platform={platform} />
      <header className="tour-header">
        <Button variant="tour" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft />
          Overview
        </Button>
        <Wordmark className="tour-wordmark" />
        <div className="tour-header-actions">
          <div className="tour-platform-switch" role="group" aria-label="Choose a platform">
            {(["linkedin", "hinge"] as const).map((id) => (
              <Button
                variant="tour"
                key={id}
                data-selected={platform === id}
                aria-pressed={platform === id}
                disabled={loading}
                onClick={() => switchPlatform(id)}
              >
                <span className="tour-pearl" aria-hidden="true" />
                {id === "linkedin" ? "LinkedIn" : "Hinge"}
              </Button>
            ))}
          </div>
          <Link href="/hub" className="tour-avatar" aria-label="Identity Hub" title="Identity Hub">
            {session.photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimizable asset
              <img src={session.photo.url} alt="" />
            ) : (
              <Fingerprint size={17} />
            )}
          </Link>
        </div>
      </header>

      {step === INPUT && (
        <section className="tour-location" aria-label={`${scene.name} studio`}>
          <span className="tour-kicker">
            <span className="destination-mark">
              <BrandMark platform={platform} />
            </span>
            {scene.lens} <span className="tour-line" aria-hidden="true" /> THROUGH THEIR EYES
          </span>
          <h1>{scene.caption}</h1>
          <p>
            Add your profile, confirm what’s true, see it through their eyes, then rewrite. A first impression that
            still feels like you.
          </p>
        </section>
      )}

      <TourStops steps={STEPS} step={step} furthest={furthest} disabled={loading} onSelect={go} />

      <main className="tour-workspace studio-shell">
        <div className="studio-body">
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
                go(REWRITE, { scroll: false });
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

          {step > INPUT && (
            <div className="back-row">
              {step !== CONSENT ? (
                <Button variant="ghost" disabled={loading} onClick={() => go(step - 1)}>
                  <ArrowLeft />
                  Go back
                </Button>
              ) : (
                <span />
              )}
              <Button variant="ghost" disabled={loading} onClick={reset} title="Clear this session">
                <RotateCcw />
                Start over
              </Button>
            </div>
          )}
        </div>
        {help && (
          <p className="help-note" id="studio-help">
            Nothing is sent until you agree, once per browser (only that yes is remembered; withdraw it any time
            from the bar below). After that, your profile text and confirmed facts go to OpenRouter and the
            underlying AI model provider; nothing else is stored by this app. Imported PDFs and photos stay in your
            browser, and entry locations are never sent. Feedback is written by an AI model, not real people.
            Rewrites may only use facts you confirm, and FactCheck flags numbers, names, and stronger verbs it
            can&apos;t trace to your words. Sample results are labeled. Refreshing clears your session.
          </p>
        )}
      </main>

      <footer className="tour-footer">
        <span className="tour-privacy">
          <ShieldCheck size={13} />
          {status}
          {consent && (
            <Button variant="link" className="withdraw-link" onClick={withdraw}>
              Withdraw consent
            </Button>
          )}
        </span>
        <Button
          variant="tour"
          size="sm"
          className="tour-help"
          aria-expanded={help}
          aria-controls="studio-help"
          onClick={() => setHelp(!help)}
        >
          <CircleHelp />
          How this works
        </Button>
        <span className="tour-progress" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          <span className="tour-progress-label">{STEPS[step]}</span>
          {String(step + 1).padStart(2, "0")} <span>/ {String(STEPS.length).padStart(2, "0")}</span>
        </span>
      </footer>
    </div>
  );
}
