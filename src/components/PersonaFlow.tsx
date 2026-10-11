"use client";

import { ArrowLeft, CircleHelp, Fingerprint, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudienceClash } from "@/components/AudienceClash";
import { AutofillPanel, type AutofillResult } from "@/components/AutofillPanel";
import { AudienceSelection } from "@/components/AudienceSelection";
import { BioInput } from "@/components/BioInput";
import { SCENES, ScenicBackdrop, Wordmark } from "@/components/Chrome";
import { ConsentScreen } from "@/components/ConsentScreen";
import { LinkedInEditor, type ImportState } from "@/components/LinkedInEditor";
import { PlatformSelect } from "@/components/PlatformSelect";
import { ProfileClash } from "@/components/ProfileClash";
import { ProfileInput } from "@/components/ProfileInput";
import { RewriteComparison } from "@/components/RewriteComparison";
import { resultKey, SectionRewrites, type SectionRewriteState } from "@/components/SectionRewrites";
import { StudioFinish } from "@/components/StudioFinish";
import { TinderEditor } from "@/components/TinderEditor";
import { TourStops } from "@/components/TourStops";
import { TraitScorecard } from "@/components/TraitScorecard";
import { Button } from "@/components/ui/button";
import { draftProfile, errorMessage, evaluateProfile, rewriteProfile, rewriteSection } from "@/lib/api-client";
import { applyDrafts, canFill, draftFieldFacts, draftSlots, draftSources, fillTarget, hasProfile, type TargetState } from "@/lib/autofill";
import { saveConsent, useStoredConsent, withdrawConsent } from "@/lib/consent";
import { factsFor, recordFoundOn } from "@/lib/fact-platforms";
import { getSession, updateSession, useIdentitySession } from "@/lib/identity-session";
import {
  DEMO_BIO,
  DEMO_HINGE_FACTS,
  DEMO_HINGE_INPUT,
  DEMO_LINKEDIN_FACTS,
  DEMO_LINKEDIN_PROFILE,
  DEMO_TINDER,
  DEMO_TINDER_FACTS,
  type BioPlatform,
} from "@/lib/demo-data";
import { emptyHingePairs, factTextSchema, HINGE_PROMPTS, mergeFacts, MAX_HINGE_ANSWER, MAX_HINGE_PROMPTS, type HingePair } from "@/lib/persona-ui";
import { emptyLinkedInProfile, factCheckSegments, findSection, profileCharCount, rewritableSections, segmentProfile } from "@/lib/profile";
import { changedSections, profileAsText, sectionText, withSectionText } from "@/lib/profile-edits";
import { cleanProfile, importProfileFile } from "@/lib/profile-import";
import { DEFAULT_LINKEDIN_AUDIENCES, PLATFORM_CONFIGS, PLATFORM_GROUPS } from "@/lib/rubrics";
import { PARALLEL_REWRITES, runLimited } from "@/lib/run-limited";
import { EXPECTED_MS } from "@/lib/progress";
import { ProgressBar } from "@/components/ProgressBar";
import { compareAnswered } from "@/lib/answered";
import {
  LIMITS,
  LinkedInProfileSchema,
  type EvaluateResponse,
  type IdentityFact,
  type LinkedInProfile,
  type Platform,
  type RewriteResponse,
  type CustomQuestion,
  type LengthStep,
  type SectionStyle,
  type Segment,
  type TinderFields,
  type TinderProfile,
} from "@/lib/schemas";
import { segmentBio, segmentHinge } from "@/lib/segments";
import { checkFactClaims, factCheckView, type FactCheckView } from "@/lib/fact-claims";
import { useFactChecks } from "@/lib/use-fact-checks";
import type { LieCheck } from "@/components/FactCheckDetail";
import {
  emptyTinderProfile,
  fieldFactsAsFacts,
  piecesOntoSegments,
  segmentTinder,
  TINDER_AI_FIELDS,
  tinderFieldFacts,
  type TinderAiField,
} from "@/lib/tinder";

// Owns the whole studio: state, API calls, and the page layout. Screens are props-only.
// Rules enforced here: nothing is sent to the AI before consent (asked once per browser, remembered
// as a flag), only confirmed facts reach a rewrite, and sample mode, which sends nothing and so
// needs no consent, is only offered for the LinkedIn demo persona (the only one with cached results).
// LinkedIn works on a sectioned profile; Hinge keeps its prompt answers and single rewrite; the bio
// platforms (Handshake, Instagram, GitHub) follow Hinge's steps with one bio field; Tinder adds
// About me and profile fields to prompt answers (only About, answers, and work fields reach the AI).

const STEPS = ["Your profile", "Consent", "Audience lenses", "Audience Clash", "Rewrite + FactCheck"];
const [INPUT, CONSENT, AUDIENCES, CLASH, REWRITE] = [0, 1, 2, 3, 4];
/**
 * Every platform walks the same five steps. The user's own text is the evidence (FactCheck accepts
 * it); true facts that aren't in the text can be added on the rewrite step, or come from the
 * Identity Hub.
 */
const ORDER = [INPUT, CONSENT, AUDIENCES, CLASH, REWRITE];

/** The Hinge demo has two answers; fill the third slot with an unused prompt. */
function demoHingePairs(): HingePair[] {
  const pairs = DEMO_HINGE_INPUT.map((p) => ({ ...p }));
  const unused = HINGE_PROMPTS.filter((prompt) => !pairs.some((p) => p.prompt === prompt));
  while (pairs.length < MAX_HINGE_PROMPTS) pairs.push({ prompt: unused[pairs.length] ?? HINGE_PROMPTS[0], answer: "" });
  return pairs;
}

const isDemoHinge = (pairs: HingePair[] | null) => !!pairs && JSON.stringify(pairs) === JSON.stringify(demoHingePairs());

const isBioPlatform = (p: Platform): p is BioPlatform => PLATFORM_CONFIGS[p].input === "bio";
const isDemoBio = (p: Platform, bio: string) => isBioPlatform(p) && bio === DEMO_BIO[p].bio;

/** Demo facts are recognized by text: merging may renumber their ids. */
const DEMO_FACT_TEXTS = new Set(
  [...DEMO_LINKEDIN_FACTS, ...DEMO_HINGE_FACTS, ...DEMO_TINDER_FACTS, ...Object.values(DEMO_BIO).flatMap((d) => d.facts)].map(
    (f) => f.text,
  ),
);

const isDemoTinder = (t: TinderProfile) => JSON.stringify(t) === JSON.stringify(DEMO_TINDER);
const DEMO_PROFILE_JSON = JSON.stringify(DEMO_LINKEDIN_PROFILE);

const defaultAudiences = (p: Platform): string[] =>
  p === "linkedin" ? [...DEFAULT_LINKEDIN_AUDIENCES] : PLATFORM_CONFIGS[p].audiences.map((a) => a.id);
const defaultTraits = (p: Platform) => PLATFORM_CONFIGS[p].traits.slice(0, 3).map((t) => t.id);

/** What the extracted facts were found in, so extraction reruns only when the text changes. */
const textKey = (platform: Platform, segments: Segment[]) => `${platform}|${segments.map((s) => s.text).join("\n")}`;

const emptySection = (style: SectionStyle, length: LengthStep): SectionRewriteState => ({
  style,
  length,
  results: {},
  loading: null,
  error: null,
});

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
  // The profile before any "Use this version" rewrites (null when none are used). Rewrites and
  // FactCheck keep working from it, so an accepted rewrite never becomes its own evidence.
  const [original, setOriginal] = useState<LinkedInProfile | null>(() => getSession().linkedinOriginal);
  const [jobDescription, setJobDescription] = useState(() => getSession().jobDescription);
  const [imported, setImported] = useState<ImportState>(() => getSession().linkedinImport);
  const [importing, setImporting] = useState(false);
  const [hinge, setHinge] = useState<HingePair[]>(() => getSession().hinge ?? emptyHingePairs());
  const [hingeDemo, setHingeDemo] = useState(() => isDemoHinge(getSession().hinge));
  // Bio platforms: this platform's bio. Each platform keeps its own in the session.
  const [bio, setBio] = useState(() => getSession().bios[platform] ?? "");
  // Tinder: About me, prompt answers, and profile fields; which work fields came from LinkedIn.
  const [tinder, setTinder] = useState<TinderProfile>(() => getSession().tinder ?? emptyTinderProfile());
  const [fromLinkedIn, setFromLinkedIn] = useState<TinderAiField[]>([]);
  // "Fill from your other profiles": the last fill or draft, and whether a draft is running.
  const [autofillResult, setAutofillResult] = useState<AutofillResult | null>(null);
  const [drafting, setDrafting] = useState(false);
  // Where the consent screen returns to: the profile step when it was opened by "Draft with AI".
  const [draftAfterConsent, setDraftAfterConsent] = useState(false);
  const [sampleMode, setSampleMode] = useState(false);
  const consent = useStoredConsent();
  const session = useIdentitySession();

  const [facts, setFacts] = useState<IdentityFact[]>(() => getSession().facts);
  // Lie Checker AI results, kept here so they survive moving between steps.
  const factChecks = useFactChecks();

  // Keep the hub's session in step with the studio, writing only values this studio actually
  // changed. Mounting, or Next re-showing a page it kept hidden, re-runs this effect with the
  // same values, and must not overwrite newer data from elsewhere with a stale copy.
  const synced = useRef({ profile, original, imported, jobDescription, hinge, bio, tinder, facts });
  useEffect(() => {
    const prev = synced.current;
    synced.current = { profile, original, imported, jobDescription, hinge, bio, tinder, facts };
    const patch: Parameters<typeof updateSession>[0] = {};
    if (profile !== prev.profile) patch.linkedin = segmentProfile(profile).length ? profile : null;
    if (original !== prev.original) patch.linkedinOriginal = original;
    if (imported !== prev.imported) patch.linkedinImport = imported;
    if (jobDescription !== prev.jobDescription) patch.jobDescription = jobDescription;
    if (hinge !== prev.hinge) patch.hinge = hinge.some((p) => p.answer.trim()) ? hinge : null;
    if (bio !== prev.bio) patch.bios = { ...getSession().bios, [platform]: bio.trim() ? bio : undefined };
    if (tinder !== prev.tinder) patch.tinder = tinder;
    if (facts !== prev.facts) {
      patch.facts = facts;
      // Newly suggested facts are used only on the platform they were found on, until shared.
      const map = getSession().factPlatforms;
      const recorded = recordFoundOn(map, facts, platform);
      if (Object.keys(recorded).length !== Object.keys(map).length) patch.factPlatforms = recorded;
    }
    if (Object.keys(patch).length) updateSession(patch);
  }, [platform, profile, original, imported, jobDescription, hinge, bio, tinder, facts]);

  const [audiences, setAudiences] = useState(() => defaultAudiences(initialPlatform));
  const [traits, setTraits] = useState(() => defaultTraits(initialPlatform));
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);
  // The selected rewrite as the same lenses read it, with its segments (so a lens's cited lines can be quoted).
  const [improvedEvaluation, setImprovedEvaluation] = useState<{ evaluation: EvaluateResponse; segments: Segment[] } | null>(null);
  // The text the feedback was given on, so Audience Clash stays consistent after rewrites are used.
  const [evaluatedOn, setEvaluatedOn] = useState<{ profile: LinkedInProfile; segments: Segment[] } | null>(null);

  const [goal, setGoal] = useState("");
  // Hinge: one rewrite of all answers.
  const [rewriting, setRewriting] = useState(false);
  const [rewrite, setRewrite] = useState<RewriteResponse | null>(null);
  const [singleApplied, setSingleApplied] = useState<string | null>(null);
  const [singlePrevious, setSinglePrevious] = useState<string | null>(null);
  const [adversarial, setAdversarial] = useState<RewriteResponse | null>(null);
  // LinkedIn: one rewrite per section per style, cached.
  const [sectionStates, setSectionStates] = useState<Record<string, SectionRewriteState>>({});
  const [allStyle, setAllStyle] = useState<SectionStyle>("professional");
  const [allLength, setAllLength] = useState<LengthStep>("same");
  const [rewritingAll, setRewritingAll] = useState(false);
  const [focusSection, setFocusSection] = useState<string | null>(null);

  // Ignore responses from requests that were superseded (new input, new facts, platform switch, reset).
  const requestId = useRef(0);
  const sectionGen = useRef(0);
  // Section rewrites: what each section was last set to (generated once its current request
  // finishes), which results are cached, and which sections have a request in flight.
  const wantedSection = useRef<Record<string, { style: SectionStyle; length: LengthStep }>>({});
  const cachedSection = useRef(new Set<string>());
  const sectionInFlight = useRef(new Set<string>());

  const clean = useMemo(() => cleanProfile(profile), [profile]);
  const segments = useMemo(
    () =>
      config.input === "sections"
        ? segmentProfile(clean)
        : config.input === "bio"
          ? segmentBio(bio)
          : config.input === "tinder"
            ? segmentTinder(tinder)
            : segmentHinge(hinge),
    [config.input, clean, bio, hinge, tinder],
  );
  // Tinder: the work fields a rewrite may mention (never location or lifestyle picks).
  const fieldFacts = useMemo(() => (config.input === "tinder" ? tinderFieldFacts(tinder.fields) : []), [config.input, tinder.fields]);
  // Rewrites work from the original text; `applied` is which sections currently use a rewrite.
  const baseClean = useMemo(() => (original ? cleanProfile(original) : clean), [original, clean]);
  const sections = useMemo(() => (platform === "linkedin" ? rewritableSections(baseClean) : []), [platform, baseClean]);
  const applied = useMemo(() => (original ? changedSections(cleanProfile(original), clean) : []), [original, clean]);
  // The text a single rewrite (Hinge or a bio) is compared against.
  const textOriginal =
    config.input === "bio"
      ? bio.trim()
      : config.input === "tinder"
        ? segments.map((s) => s.text).join("\n\n")
        : hinge.map((p) => p.answer.trim()).filter(Boolean).join("\n\n");
  const sourceKey = textKey(platform, segments);
  // Write once, show up everywhere: only confirmed facts shared with this platform can be used here.
  const factPlatforms = session.factPlatforms;
  const confirmedFacts = factsFor(platform, facts, factPlatforms);
  const allConfirmed = facts.filter((f) => f.confirmed && f.text.trim()).length;
  const usingDemo =
    platform === "linkedin"
      ? JSON.stringify(baseClean) === DEMO_PROFILE_JSON
      : config.input === "bio"
        ? isDemoBio(platform, bio)
        : config.input === "tinder"
          ? isDemoTinder(tinder)
          : hingeDemo;
  const targetJob = config.jobDescription ? jobDescription.trim() || undefined : undefined;
  const canUseSample = usingDemo && platform === "linkedin";
  const sample = canUseSample && sampleMode;
  /** May this run proceed? Sample mode sends nothing, so it never needs consent. */
  const allowed = sample || consent;
  const loading = evaluating || rewriting || rewritingAll || importing;

  const inputError = (() => {
    if (platform === "linkedin") {
      if (!segments.length) return "Add at least a headline, About, or one entry before continuing.";
      if (profileCharCount(clean) > LIMITS.profileText)
        return `Keep your profile under ${LIMITS.profileText.toLocaleString()} characters.`;
      const parsed = LinkedInProfileSchema.safeParse(clean);
      return parsed.success ? null : (parsed.error.issues[0]?.message ?? "Check your profile.");
    }
    if (config.input === "bio") {
      if (!bio.trim()) return `Add your ${config.fieldLabel} before continuing.`;
      return bio.length > LIMITS.sectionText ? `Keep it under ${LIMITS.sectionText.toLocaleString()} characters.` : null;
    }
    if (config.input === "tinder") {
      if (!segments.length) return "Add your About me or at least one prompt answer before continuing.";
      if ([...tinder.about].length > LIMITS.tinderAbout) return `Keep About me under ${LIMITS.tinderAbout} characters.`;
      if (tinder.prompts.some((p) => p.answer.length > LIMITS.tinderAnswer))
        return `Keep each answer under ${LIMITS.tinderAnswer} characters.`;
      return null;
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
    wantedSection.current = {};
    cachedSection.current.clear();
    sectionInFlight.current.clear();
    setRewritingAll(false);
    setRewrite(null);
    setAdversarial(null);
  }

  /** New text means new suggestions and new results. Facts the user typed are kept; consent is remembered. */
  function resetResults() {
    requestId.current++;
    setEvaluating(false);
    setRewriting(false);
    setFurthest(INPUT);
    setEvaluation(null);
    setImprovedEvaluation(null);
    setEvaluatedOn(null);
    setSingleApplied(null);
    setSinglePrevious(null);
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
      setOriginal(null);
      setJobDescription("");
      setImported(null);
    } else if (config.input === "bio") {
      setBio("");
    } else if (config.input === "tinder") {
      setTinder(emptyTinderProfile());
      setFromLinkedIn([]);
    } else {
      setHinge(emptyHingePairs());
      setHingeDemo(false);
    }
    setFacts((prev) => prev.filter((f) => f.confirmed || f.source === "user"));
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

  /** Editing the profile yourself makes the edited text (accepted rewrites included) the new original. */
  function changeProfile(next: LinkedInProfile) {
    setProfile(next);
    setOriginal(null);
    resetResults();
  }

  /** "Use this version": put a section's rewrite into the profile. Results are kept. */
  function applyRewrite(key: string, text: string) {
    if (!original) setOriginal(profile);
    setImprovedEvaluation(null);
    setProfile((p) => withSectionText(p, key, text));
  }

  function undoRewrite(key: string) {
    if (!original) return;
    setImprovedEvaluation(null);
    const next = withSectionText(profile, key, sectionText(original, key) ?? "");
    setProfile(next);
    if (!changedSections(cleanProfile(original), cleanProfile(next)).length) setOriginal(null);
  }

  async function copyProfile() {
    try {
      await navigator.clipboard.writeText(profileAsText(clean));
      return true;
    } catch {
      setError({ message: "Clipboard access is unavailable. Copy each section from its card instead." });
      return false;
    }
  }

  function changeJobDescription(text: string) {
    // The job description isn't profile text: it changes feedback and rewrites, not consent or facts.
    setJobDescription(text);
    setEvaluation(null);
    clearRewrites();
  }

  function changeBio(next: string) {
    setBio(next);
    resetResults();
  }

  /** About and answers are what feedback and rewrites read; work fields only feed rewrites; the rest neither. */
  function changeTinder(next: TinderProfile, edited?: keyof TinderFields) {
    setTinder(next);
    if (!edited) resetResults();
    else {
      setFromLinkedIn((prev) => prev.filter((k) => k !== edited));
      if ((TINDER_AI_FIELDS as readonly string[]).includes(edited)) clearRewrites();
    }
  }

  /** This platform's profile, in the shape autofill.ts works on. */
  function currentTarget(): TargetState {
    if (config.input === "sections") return { kind: "linkedin", value: profile };
    if (config.input === "bio") return { kind: "bio", platform, value: bio };
    if (config.input === "tinder") return { kind: "tinder", value: tinder };
    return { kind: "hinge", value: hinge };
  }
  // Drafts finish after the user may have typed: apply them to the latest profile, not a stale copy.
  const targetRef = useRef<TargetState | null>(null);
  useEffect(() => {
    targetRef.current = currentTarget();
  });

  function setTarget(next: TargetState, fromLinkedInFields: TinderAiField[] = []) {
    if (next.kind === "linkedin") changeProfile(next.value);
    else if (next.kind === "bio") changeBio(next.value);
    else if (next.kind === "tinder") {
      changeTinder(next.value);
      if (fromLinkedInFields.length) setFromLinkedIn((prev) => [...new Set([...prev, ...fromLinkedInFields])]);
    } else changeHinge(next.value);
  }

  /** The other platforms as material: the session, with this platform's live state in it. */
  const autofillSources = { linkedin: session.linkedin, hinge: session.hinge, tinder: session.tinder, bios: session.bios };

  /** "Fill empty spots": the user's own sentences and fields, no AI. */
  function runFill() {
    const r = fillTarget(currentTarget(), autofillSources, confirmedFacts);
    if (r.notes.length) setTarget(r.state, r.fromLinkedIn);
    setAutofillResult({ kind: "fill", notes: r.notes, dropped: [] });
  }

  /** "Draft with AI": new wording from the user's own text and facts; untraceable sentences removed. */
  async function runDraft(agreed = false) {
    if (!consent && !agreed) {
      setDraftAfterConsent(true);
      go(CONSENT);
      return;
    }
    const slots = draftSlots(currentTarget());
    const sources = draftSources(autofillSources);
    if (!slots.length || !sources.length) return;
    const fieldFacts = draftFieldFacts(autofillSources);
    setDrafting(true);
    setError(null);
    try {
      const res = await draftProfile({
        consent: true,
        platform,
        sources,
        facts: confirmedFacts.map((f) => ({ ...f, confirmed: true as const })),
        ...(fieldFacts.length ? { fieldFacts } : {}),
        slots,
      });
      const drafted = res.drafts.filter((d) => d.text.trim());
      if (drafted.length && targetRef.current) setTarget(applyDrafts(targetRef.current, drafted));
      setAutofillResult({
        kind: "draft",
        notes: drafted.map((d) => `${slots.find((s) => s.id === d.slotId)?.label ?? d.slotId}: drafted`),
        dropped: res.drafts.flatMap((d) => d.dropped),
      });
    } catch (err) {
      setError({ message: errorMessage(err), retry: () => void runDraft(true) });
    } finally {
      setDrafting(false);
    }
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
      setOriginal(null);
      setImported({ fileName: file.name, warnings: res.warnings });
      resetResults();
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "That file couldn’t be read." });
    } finally {
      setImporting(false);
    }
  }

  /** Demo facts are used only on the demo's platform until shared, like facts found in your text. */
  function addDemoFacts(demoFacts: IdentityFact[]) {
    const merged = mergeFacts(facts, demoFacts);
    setFacts(merged);
    const added = merged.filter((f) => DEMO_FACT_TEXTS.has(f.text));
    updateSession({ factPlatforms: recordFoundOn(getSession().factPlatforms, added, platform, true) });
  }


  function loadDemo() {
    resetResults();
    if (platform === "linkedin") {
      setProfile(structuredClone(DEMO_LINKEDIN_PROFILE));
      setOriginal(null);
      setImported(null);
      addDemoFacts(DEMO_LINKEDIN_FACTS);
    } else if (isBioPlatform(platform)) {
      const demo = DEMO_BIO[platform];
      setBio(demo.bio);
      addDemoFacts(demo.facts);
    } else if (config.input === "tinder") {
      setTinder(structuredClone(DEMO_TINDER));
      setFromLinkedIn([]);
      addDemoFacts(DEMO_TINDER_FACTS);
    } else {
      const pairs = demoHingePairs();
      setHinge(pairs);
      setHingeDemo(true);
      addDemoFacts(DEMO_HINGE_FACTS);
    }
    setStep(INPUT);
    setError(null);
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
    if (allowed) go(AUDIENCES);
    else go(CONSENT);
  }

  async function runEvaluate() {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    if (!audiences.length || (!traits.length && !customQuestions.length)) {
      setError({ message: "Choose at least one audience and question." });
      return;
    }
    // Cached sample feedback belongs to the demo's original text, so in sample mode the feedback is
    // on that text (Audience Clash then says it predates the rewrites you used).
    const evalProfile = sample ? baseClean : clean;
    const evalSegments = sample ? segmentProfile(baseClean) : segments;
    const id = ++requestId.current;
    setEvaluating(true);
    setError(null);
    try {
      const res = await evaluateProfile(
        {
          consent: true,
          platform,
          segments: platform === "linkedin" ? evalSegments : segments,
          audiences,
          traits,
          ...(customQuestions.length && !sample ? { customQuestions } : {}),
          jobDescription: targetJob,
        },
        { sample },
      );
      if (id !== requestId.current) return;
      setEvaluation(res);
      setEvaluatedOn({ profile: evalProfile, segments: platform === "linkedin" ? evalSegments : segments });
      go(CLASH);
    } catch (err) {
      if (id !== requestId.current) return;
      setError({ message: errorMessage(err), retry: () => void runEvaluate() });
    } finally {
      if (id === requestId.current) setEvaluating(false);
    }
  }

  /** Hinge and bio rewrites, and the FactCheck demo on every platform. */
  async function runRewrite(mode: "normal" | "adversarial" = "normal") {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    const id = ++requestId.current;
    setRewriting(true);
    setImprovedEvaluation(null);
    setError(null);
    try {
      const res = await rewriteProfile(
        {
          consent: true,
          platform,
          segments,
          facts: confirmedFacts.map((f) => ({ ...f, confirmed: true as const })),
          ...(fieldFacts.length ? { fieldFacts } : {}),
          audiences,
          goal: goal.trim() || undefined,
          tone: "balanced", // the two rewrite versions (direct, narrative) replace a tone control
          jobDescription: targetJob,
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

  async function scoreDraft(text: string, sectionKey?: string) {
    if (!evaluation) throw new Error("Original audience scores are unavailable. Run feedback again first.");
    let candidateSegments: Segment[];
    if (platform === "linkedin") {
      if (!sectionKey) throw new Error("Choose a LinkedIn section rewrite to compare.");
      candidateSegments = segmentProfile(cleanProfile(withSectionText(clean, sectionKey, text)));
    } else if (config.input === "bio") candidateSegments = segmentBio(text);
    else if (config.input === "tinder") candidateSegments = piecesOntoSegments(text, segments);
    else {
      const prompts = hinge.filter((pair) => pair.answer.trim());
      const answers = text.split(/\n\s*\n/).map((answer) => answer.trim()).filter(Boolean);
      candidateSegments = segmentHinge(prompts.map((pair, index) => ({ prompt: pair.prompt, answer: answers[index] ?? "" })));
    }
    if (!candidateSegments.length) throw new Error("The selected draft has no text to score.");
    const result = await evaluateProfile({
      consent: true,
      platform,
      segments: candidateSegments,
      audiences,
      traits: evalTraits,
      ...(customQuestions.length ? { customQuestions } : {}),
      jobDescription: targetJob,
    });
    setImprovedEvaluation({ evaluation: result, segments: candidateSegments });
    return compareAnswered(evaluation, result, audiences, evalTraits);
  }

  function patchSection(key: string, patch: Partial<SectionRewriteState>) {
    setSectionStates((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptySection(allStyle, allLength)), ...patch } }));
  }

  /** LinkedIn: rewrite one section in one style and length. Errors stay on that section's card. */
  async function runSection(key: string, style: SectionStyle, length: LengthStep, autoScore = true) {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    const section = findSection(baseClean, key);
    if (!section) return;
    const gen = sectionGen.current;
    setImprovedEvaluation(null);
    sectionInFlight.current.add(key);
    patchSection(key, { style, length, loading: { style, length }, error: null });
    try {
      const res = await rewriteSection(
        {
          consent: true,
          platform: "linkedin",
          section,
          profile: baseClean,
          facts: confirmedFacts.map((f) => ({ ...f, confirmed: true as const })),
          style,
          length,
          audiences,
          goal: goal.trim() || undefined,
          jobDescription: jobDescription.trim() || undefined,
        },
        { sample },
      );
      if (gen !== sectionGen.current) return;
      cachedSection.current.add(`${key}|${resultKey(style, length)}`);
      // Keep the style and length the user has moved to since; only the result is stored.
      setSectionStates((prev) => {
        const cur = prev[key] ?? emptySection(style, length);
        return {
          ...prev,
          [key]: { ...cur, results: { ...cur.results, [resultKey(style, length)]: res }, loading: null, error: null, autoScoreKey: autoScore ? resultKey(style, length) : null },
        };
      });
    } catch (err) {
      if (gen !== sectionGen.current) return;
      sectionInFlight.current.delete(key);
      patchSection(key, { loading: null, error: errorMessage(err) });
      return;
    }
    sectionInFlight.current.delete(key);
    // The slider or style moved while this ran: generate where it ended up, unless that's cached.
    const want = wantedSection.current[key];
    if (want && !cachedSection.current.has(`${key}|${resultKey(want.style, want.length)}`)) {
      void runSection(key, want.style, want.length);
    }
  }

  /** Generate a section's chosen style + length now, or after its current request (cached results show instantly). */
  function requestSection(key: string, style: SectionStyle, length: LengthStep) {
    wantedSection.current[key] = { style, length };
    if (sectionInFlight.current.has(key) || cachedSection.current.has(`${key}|${resultKey(style, length)}`)) return;
    void runSection(key, style, length);
  }

  /** Picking a style shows its cached result at the current length; once a section has results, it generates. */
  function chooseStyle(key: string, style: SectionStyle) {
    const cur = sectionStates[key] ?? emptySection(allStyle, allLength);
    patchSection(key, { style });
    const engaged = Object.keys(cur.results).length > 0 || Boolean(cur.loading);
    if (engaged) requestSection(key, style, cur.length);
  }

  /** The slider: dragging only moves it; releasing generates that length (or shows it from the cache). */
  function chooseLength(key: string, length: LengthStep, commit: boolean) {
    const cur = sectionStates[key] ?? emptySection(allStyle, allLength);
    patchSection(key, { length });
    if (commit) requestSection(key, cur.style, length);
  }

  async function rewriteAll() {
    if (!allowed) {
      go(CONSENT);
      return;
    }
    setRewritingAll(true);
    const gen = sectionGen.current;
    // Cached sections switch instantly; the rest run at most PARALLEL_REWRITES at a time.
    for (const s of sections) patchSection(s.key, { style: allStyle, length: allLength });
    const todo = sections.filter((s) => !sectionStates[s.key]?.results[resultKey(allStyle, allLength)]);
    await runLimited(todo, PARALLEL_REWRITES, (s) => runSection(s.key, allStyle, allLength, false));
    if (gen === sectionGen.current) setRewritingAll(false);
  }

  const sourcesFor = (key: string): Segment[] => factCheckSegments(baseClean, key) ?? [];
  // This platform's steps; `stepPos` is where the current step sits among them.
  const order = ORDER;
  const stepPos = Math.max(0, order.indexOf(step));
  const prevStep = order[Math.max(0, stepPos - 1)];
  // Feedback screens label the user's own questions like the built-in ones.
  const evalConfig = useMemo(
    () => ({
      ...config,
      traits: [
        ...config.traits,
        ...customQuestions.map((q) => ({ id: q.id, label: q.text, question: q.text, description: q.text })),
      ],
    }),
    [config, customQuestions],
  );
  const evalTraits = [...traits, ...customQuestions.map((q) => q.id)];

  /** LinkedIn: a fact that isn't on the profile, typed on the rewrite screen. Used only on LinkedIn until shared. */
  // Lie Checker compares facts with the user's ORIGINAL text (before "Use this version"), like
  // FactCheck, so an accepted rewrite never becomes evidence for a fact.
  const lieCheckSegments = useMemo(
    () => (platform === "linkedin" ? segmentProfile(baseClean) : segments),
    [platform, baseClean, segments],
  );
  const lieCheckBasis = textKey(platform, lieCheckSegments);
  const otherFactsOf = (id: string, all: IdentityFact[]) =>
    all.filter((f) => f.id !== id && f.text.trim()).map(({ id, text }) => ({ id, text: text.trim() }));

  function checkFact(fact: IdentityFact, all: IdentityFact[] = facts, force = false) {
    // The AI check sends text to the provider: only after consent, and never in sample mode.
    if (!consent || sample || !factTextSchema.safeParse(fact.text).success) return;
    factChecks.run(
      { platform, fact: { id: fact.id, text: fact.text }, segments: lieCheckSegments, otherFacts: otherFactsOf(fact.id, all) },
      lieCheckBasis,
      { force },
    );
  }

  const factViews = useMemo(() => {
    const out: Record<string, FactCheckView> = {};
    for (const fact of facts) {
      const issues = checkFactClaims(fact.text, { segments: lieCheckSegments, otherFacts: otherFactsOf(fact.id, facts) });
      out[fact.id] = factCheckView(fact.text, lieCheckBasis, issues, factChecks.checks[fact.id]);
    }
    return out;
  }, [facts, lieCheckSegments, lieCheckBasis, factChecks.checks]);

  const lieCheck: LieCheck = {
    views: factViews,
    canCheck: consent && !sample,
    onCheck: (id) => {
      const fact = facts.find((f) => f.id === id);
      if (fact) checkFact(fact, facts, true);
    },
    checkDraft: (text) => checkFactClaims(text, { segments: lieCheckSegments, otherFacts: otherFactsOf("", facts) }),
  };

  function addExtraFact(text: string) {
    const t = text.trim().slice(0, LIMITS.factText);
    if (!t) return;
    const merged = mergeFacts(facts, [{ id: "f1", text: t, confirmed: true, source: "user" }]);
    setFacts(merged);
    clearRewrites();
    const added = merged.find((f) => f.text.trim().toLowerCase() === t.toLowerCase());
    if (added) checkFact(added, merged);
  }

  function removeExtraFact(id: string) {
    setFacts((prev) => prev.filter((f) => f.id !== id));
    clearRewrites();
  }
  const otherPlatform: Platform = platform === "linkedin" ? "hinge" : "linkedin";
  const feedbackStale = !!evaluatedOn && textKey(platform, evaluatedOn.segments) !== sourceKey;

  // Labels for the platforms (and facts) this one can be filled from.
  const autofillFrom = PLATFORM_GROUPS.flatMap((g) => g.platforms)
    .filter((p) => p !== platform && hasProfile(p, autofillSources))
    .map((p) => `your ${PLATFORM_CONFIGS[p].label}`);
  if (confirmedFacts.length) autofillFrom.push(`your ${confirmedFacts.length} confirmed ${confirmedFacts.length === 1 ? "fact" : "facts"}`);
  const autofillPanel = (
    <AutofillPanel
      sources={autofillFrom}
      canFill={canFill(platform, autofillSources, confirmedFacts)}
      canDraft={autofillFrom.length > 0 && draftSlots(currentTarget()).length > 0}
      drafting={drafting}
      draftDisabledReason={sample ? "Sample mode sends nothing. Turn it off to draft with AI." : undefined}
      result={autofillResult}
      onFill={runFill}
      onDraft={() => void runDraft()}
    />
  );

  const scene = SCENES[platform];
  const status = sample
    ? "Sample mode · nothing sent or stored"
    : consent
      ? "You agreed to send text to the AI · nothing stored"
      : "Nothing sent until you agree · nothing stored";

  return (
    <div className="app-root tour-root" data-theme={platform} data-group={config.group}>
      <ScenicBackdrop platform={platform} />
      <header className="tour-header">
        <Button variant="tour" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft />
          Overview
        </Button>
        <Wordmark className="tour-wordmark" />
        <div className="tour-header-actions">
          <div className="tour-platform-picker">
            <span>PLATFORM</span>
            <PlatformSelect value={platform} disabled={loading} onChange={switchPlatform} />
          </div>
          <Link href="/hub" className="tour-hub-link" title="Your Identity Hub: facts and sources for every platform">
            <span className="tour-avatar" aria-hidden="true">
              {session.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimizable asset
                <img src={session.photo.url} alt="" />
              ) : (
                <Fingerprint size={17} />
              )}
            </span>
            <span className="tour-hub-label">
              Hub
              {allConfirmed > 0 && <span className="tour-hub-count">{allConfirmed} facts</span>}
            </span>
          </Link>
        </div>
      </header>

      {step === INPUT && (
        <section className="tour-location" aria-label={`${scene.name} studio`}>
          <h1>{scene.caption}</h1>
          <p>
            Add your profile, confirm what’s true, see it through their eyes, then rewrite. A first impression that
            still feels like you.
          </p>
        </section>
      )}

      <TourStops steps={STEPS} order={order} step={step} furthest={furthest} disabled={loading} onSelect={go} />

      <main className="tour-workspace studio-shell">
        <div className="studio-body">
          {sample && step > CONSENT && (
            <p className="prototype-notice">
              <ShieldCheck size={15} />
              Sample mode: results below are cached demo data for the fictitious persona, not a live AI run.
            </p>
          )}

          {/* Lives here, not in the lens step: results move the studio to Audience Clash, and the bar
              should finish and fade there instead of vanishing with the step. */}
          <ProgressBar active={evaluating} label="Reading your profile through each lens…" expectedMs={EXPECTED_MS.evaluate} />

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
              autofill={autofillPanel}
            />
          )}
          {step === INPUT && config.input === "bio" && (
            <BioInput
              platform={platform}
              bio={bio}
              demo={usingDemo}
              canContinue={!inputError}
              onBioChange={changeBio}
              jobDescription={jobDescription}
              onJobDescription={changeJobDescription}
              onLoadDemo={loadDemo}
              onContinue={continueFromInput}
              autofill={autofillPanel}
            />
          )}
          {step === INPUT && config.input === "tinder" && (
            <TinderEditor
              tinder={tinder}
              fromLinkedIn={fromLinkedIn}
              demo={usingDemo}
              canContinue={!inputError}
              onChange={changeTinder}
              onLoadDemo={loadDemo}
              onContinue={continueFromInput}
              autofill={autofillPanel}
            />
          )}
          {step === INPUT && config.input === "prompts" && (
            <ProfileInput
              hinge={hinge}
              demo={hingeDemo}
              canContinue={!inputError}
              onHingeChange={changeHinge}
              onLoadDemo={loadDemo}
              onContinue={continueFromInput}
              autofill={autofillPanel}
            />
          )}
          {step === CONSENT && (
            <ConsentScreen
              alreadyAgreed={consent}
              onAgree={() => {
                saveConsent();
                if (draftAfterConsent) {
                  setDraftAfterConsent(false);
                  go(INPUT);
                  void runDraft(true);
                } else go(AUDIENCES);
              }}
              onWithdraw={withdraw}
              onBack={() => {
                setDraftAfterConsent(false);
                go(INPUT);
              }}
            />
          )}
          {step === AUDIENCES && (
            <AudienceSelection
              config={config}
              audiences={audiences}
              traits={traits}
              customQuestions={customQuestions}
              sampleMode={sample}
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
              onCustomQuestions={(qs) => {
                setCustomQuestions(qs);
                setEvaluation(null);
                setFurthest(AUDIENCES);
              }}
              onFeedback={() => void runEvaluate()}
            />
          )}
          {step === CLASH && evaluation && feedbackStale && (
            <div className="prototype-notice stale-notice">
              <TriangleAlert size={15} />
              <span>
                This feedback is on your profile before the rewrites you used.
                {!sample && " Get feedback again to see how the audiences read the new version."}
              </span>
              {!sample && (
                <Button variant="glass" size="sm" onClick={() => go(AUDIENCES)}>
                  Get new feedback
                </Button>
              )}
            </div>
          )}
          {step === CLASH && evaluation && platform === "linkedin" && (
            <ProfileClash
              response={evaluation}
              config={evalConfig}
              audiences={audiences}
              traits={evalTraits}
              profile={evaluatedOn?.profile ?? clean}
              segments={evaluatedOn?.segments ?? segments}
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
          {step === CLASH && evaluation && platform !== "linkedin" && (
            <AudienceClash
              response={evaluation}
              config={evalConfig}
              audiences={audiences}
              traits={evalTraits}
              segments={evaluatedOn?.segments ?? segments}
              onRewrite={() => go(REWRITE)}
            />
          )}
          {step === REWRITE && platform === "linkedin" && (
            <SectionRewrites
              sections={sections}
              states={sectionStates}
              sourcesFor={sourcesFor}
              confirmedFacts={confirmedFacts}
              onAddFact={addExtraFact}
              onRemoveFact={removeExtraFact}
              lieCheck={lieCheck}
              goal={goal}
              allStyle={allStyle}
              allLength={allLength}
              sampleMode={sample}
              rewritingAll={rewritingAll}
              focusKey={focusSection}
              adversarial={adversarial}
              applied={applied}
              currentText={(key) => sectionText(clean, key) ?? ""}
              onUse={applyRewrite}
              onUndo={undoRewrite}
              adversarialOriginal={[baseClean.headline, baseClean.about].filter((t) => t.trim()).join("\n\n")}
              adversarialSegments={segments}
              onGoal={(g) => {
                setGoal(g);
              }}
              onStyle={chooseStyle}
              onLength={chooseLength}
              onGenerate={(key) => void runSection(key, sectionStates[key]?.style ?? allStyle, sectionStates[key]?.length ?? allLength)}
              onAllStyle={setAllStyle}
              onAllLength={setAllLength}
              onRewriteAll={() => void rewriteAll()}
              onAdversarial={(enabled) => (enabled ? void runRewrite("adversarial") : setAdversarial(null))}
              onError={(message) => setError({ message })}
              onScore={scoreDraft}
            />
          )}
          {step === REWRITE && platform !== "linkedin" && (
            <RewriteComparison
              original={textOriginal}
              segments={segments}
              confirmedFacts={confirmedFacts}
              fieldFacts={fieldFactsAsFacts(fieldFacts)}
              result={adversarial ?? rewrite}
              goal={goal}
              loading={rewriting}
              adversarial={adversarial !== null}
              onGoal={setGoal}
              onGenerate={() => void runRewrite()}
              onAdversarial={(enabled) => (enabled ? void runRewrite("adversarial") : setAdversarial(null))}
              onError={(message) => setError({ message })}
              textName={platform === "hinge" ? "answers" : platform === "tinder" ? "About me and answers" : config.fieldLabel.toLowerCase()}
              onAddFact={addExtraFact}
              onRemoveFact={removeExtraFact}
              onScore={(text) => scoreDraft(text)}
              lieCheck={lieCheck}
              use={{
                current: singleApplied ?? textOriginal,
                applied: singleApplied !== null,
                onUse: (text) => { setImprovedEvaluation(null); setSinglePrevious(singleApplied); setSingleApplied(text); },
                onUndo: () => { setImprovedEvaluation(null); setSingleApplied(singlePrevious); setSinglePrevious(null); },
              }}
            />
          )}
          {step === REWRITE && evaluation && (
            <TraitScorecard
              baseline={evaluation}
              baselineSegments={evaluatedOn?.segments ?? segments}
              improved={improvedEvaluation}
              config={evalConfig}
              audiences={audiences}
              traits={evalTraits}
              sampleMode={sample}
            />
          )}
          {step === REWRITE && (
            <StudioFinish
              platform={platform}
              used={platform === "linkedin" ? { count: applied.length, total: sections.length } : undefined}
              confirmedFacts={factsFor(otherPlatform, facts, factPlatforms).length}
              onCopyProfile={platform === "linkedin" ? copyProfile : undefined}
              onOtherPlatform={() => switchPlatform(otherPlatform)}
            />
          )}

          {step > INPUT && (
            <div className="back-row">
              {step !== CONSENT ? (
                <Button variant="ghost" disabled={loading} onClick={() => go(prevStep)}>
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
            browser, and entry locations are never sent. On Tinder, only your About me, prompt answers, and work
            fields (job title, company, school, languages) are sent; never where you live or your other profile fields. Feedback is written by an AI model, not real people.
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
        <span className="tour-progress" aria-label={`Step ${stepPos + 1} of ${order.length}: ${STEPS[step]}`}>
          <span className="tour-progress-label">{STEPS[step]}</span>
          {String(stepPos + 1).padStart(2, "0")} <span>/ {String(order.length).padStart(2, "0")}</span>
        </span>
      </footer>
    </div>
  );
}
