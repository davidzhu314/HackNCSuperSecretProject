import Image from "next/image";

export default function Home() {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [hingeAnswers, setHingeAnswers] = useState<HingeAnswer[]>([{ prompt: "", answer: "" }]);
  const [jobDescription, setJobDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [facts, setFacts] = useState<IdentityFact[]>([]);
  const [factsReady, setFactsReady] = useState(false);
  const [audienceIds, setAudienceIds] = useState<string[]>(["startup_founder", "technical_recruiter"]);
  const [traitIds, setTraitIds] = useState<string[]>(["clarity", "technical_specificity", "ownership_impact"]);
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState<"closer_to_my_words" | "balanced" | "more_playful">("balanced");
  const [evaluation, setEvaluation] = useState<EvaluateResponse | null>(null);
  const [rewriteResult, setRewriteResult] = useState<RewriteResponse | null>(null);
  const [busy, setBusy] = useState<BusyState>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const userFactId = useRef(0);

  const config = PLATFORM_CONFIGS[platform];
  const segments = useMemo<Segment[]>(() => platform === "linkedin"
    ? segmentLinkedIn({ headline, about })
    : segmentHinge(hingeAnswers), [platform, headline, about, hingeAnswers]);
  const profileLength = platform === "linkedin"
    ? headline.length + about.length
    : hingeAnswers.reduce((count, pair) => count + pair.prompt.length + pair.answer.length, 0);
  const hasProfile = segments.length > 0;
  const confirmedCount = facts.filter((fact) => fact.confirmed && fact.text.trim()).length;

  function invalidateAnalysisResults() {
    requestVersion.current += 1;
    setBusy("idle");
    setEvaluation(null);
    setRewriteResult(null);
    setActiveSegment(null);
    setError("");
  }

  function resetDownstream() {
    invalidateAnalysisResults();
    setFacts([]);
    setFactsReady(false);
  }

  function changePlatform(nextPlatform: Platform) {
    setPlatform(nextPlatform);
    setAudienceIds(nextPlatform === "linkedin" ? ["startup_founder", "technical_recruiter"] : ["humor", "shared_interests"]);
    setTraitIds(nextPlatform === "linkedin" ? ["clarity", "technical_specificity", "ownership_impact"] : ["specificity", "warmth", "authenticity"]);
    setConsent(false);
    resetDownstream();
  }

  function updateProfile(update: () => void) {
    update();
    resetDownstream();
  }

  function loadDemo() {
    resetDownstream();
    if (platform === "linkedin") {
      setHeadline(DEMO_LINKEDIN_INPUT.headline);
      setAbout(DEMO_LINKEDIN_INPUT.about);
    } else {
      setHingeAnswers(DEMO_HINGE_INPUT.map((pair) => ({ ...pair })));
    }
  }

  async function suggestFacts() {
    setError("");
    if (!consent) { setError("Please agree before profile text is sent to the AI provider."); return; }
    if (!hasProfile) { setError("Add profile text before continuing."); return; }
    if (profileLength > LIMITS.profileText) { setError(`Keep profile text under ${LIMITS.profileText} characters.`); return; }

    setBusy("extracting");
    const requestId = ++requestVersion.current;
    try {
      const result = await postApi("/api/facts/extract", { consent: true, platform, segments }, ExtractFactsResponseSchema);
      if (requestId !== requestVersion.current) return;
      setFacts(result.facts);
      setFactsReady(true);
    } catch (err) {
      if (requestId !== requestVersion.current) return;
      setError(err instanceof Error ? err.message : "Couldn’t suggest facts. Please try again.");
    } finally {
      if (requestId === requestVersion.current) setBusy("idle");
    }
  }

  function updateFact(index: number, patch: Partial<IdentityFact>) {
    invalidateAnalysisResults();
    setFacts((current) => current.map((fact, i) => i === index ? { ...fact, ...patch } : fact));
  }

  function addFact() {
    if (facts.length >= LIMITS.maxFacts) return;
    invalidateAnalysisResults();
    const id = `u${++userFactId.current}`;
    setFacts((current) => [...current, { id, text: "", confirmed: false, source: "user" }]);
  }

  function toggleSelection(id: string, selected: string[], setter: (next: string[]) => void, max: number) {
    invalidateAnalysisResults();
    if (selected.includes(id)) setter(selected.filter((item) => item !== id));
    else if (selected.length < max) setter([...selected, id]);
  }

  async function runAnalysis() {
    setError("");
    if (!consent) { setError("Please agree before profile text is sent to the AI provider."); return; }
    if (!hasProfile) { setError("Add profile text before continuing."); return; }
    if (audienceIds.length === 0 || traitIds.length === 0) { setError("Choose at least one audience and one profile trait."); return; }

    setBusy("analyzing");
    const requestId = ++requestVersion.current;
    setEvaluation(null);
    setRewriteResult(null);
    const confirmedFacts = facts.filter((fact) => fact.confirmed && fact.text.trim());
    const common = { consent: true as const, platform, segments, audiences: audienceIds };
    const optionalJobDescription = platform === "linkedin" && jobDescription.trim()
      ? { jobDescription: jobDescription.trim() }
      : {};

    const [evaluationOutcome, rewriteOutcome] = await Promise.allSettled([
      postApi("/api/evaluate", { ...common, traits: traitIds, ...optionalJobDescription }, EvaluateResponseSchema),
      postApi("/api/rewrite", {
        ...common,
        facts: confirmedFacts,
        goal: goal.trim() || undefined,
        tone,
        ...optionalJobDescription,
      }, RewriteResponseSchema),
    ]);

    if (requestId !== requestVersion.current) return;

    if (evaluationOutcome.status === "fulfilled") setEvaluation(evaluationOutcome.value);
    if (rewriteOutcome.status === "fulfilled") setRewriteResult(rewriteOutcome.value);
    const messages = [evaluationOutcome, rewriteOutcome]
      .filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
      .map((outcome) => outcome.reason instanceof Error ? outcome.reason.message : "One part of the analysis failed.");
    if (messages.length) setError(messages.join(" "));
    if (requestId === requestVersion.current) setBusy("idle");
  }

  async function copyRewrite() {
    if (!rewriteResult) return;
    try {
      await navigator.clipboard.writeText(rewriteResult.rewrite.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard access failed. Select and copy the rewrite manually.");
    }
  }

  function editRewrite(content: string) {
    setRewriteResult((current) => {
      if (!current) return current;
      const rewrite = { ...current.rewrite, content };
      const warnings = checkRewrite({ rewrite, segments, facts });
      return { ...current, rewrite, warnings };
    });
  }

  function audienceLabel(id: string) {
    return config.audiences.find((audience) => audience.id === id)?.label ?? id;
  }

  function traitLabel(id: string) {
    return config.traits.find((trait) => trait.id === id)?.label ?? id;
  }

  function critiqueSegments(critique: AudienceCritique) {
    return critique.segmentIds.flatMap((id) => {
      const segment = segments.find((item) => item.id === id);
      return segment ? [{ ...segment, id }] : [];
    });
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert h-5 w-[100px]"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the{" "}
            <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              page.tsx
            </code>{" "}
            file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert h-[14px] w-4"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={14}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}

function WarningList({ warnings }: { warnings: GuardWarning[] }) {
  return <div className="warning-list">{warnings.map((warning, index) => <div className="warning-item" key={`${warning.kind}-${warning.text}-${index}`}><TriangleAlert size={13} /><span><strong>{warning.text || warning.kind}</strong> — {warning.explanation}</span></div>)}</div>;
}
