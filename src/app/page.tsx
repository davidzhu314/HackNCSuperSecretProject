"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowRight, Check, ChevronDown, Clipboard, Command, LoaderCircle,
  Plus, Sparkles, Trash2, TriangleAlert,
} from "lucide-react";
import { z } from "zod";
import { DEMO_HINGE_INPUT, DEMO_LINKEDIN_INPUT } from "@/lib/demo-data";
import { EvaluateResponseSchema, ExtractFactsResponseSchema, LIMITS, RewriteResponseSchema } from "@/lib/schemas";
import type { AudienceCritique, EvaluateResponse, GuardWarning, IdentityFact, Platform, RewriteResponse, Segment } from "@/lib/schemas";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { segmentHinge, segmentLinkedIn } from "@/lib/segments";
import { checkRewrite } from "@/lib/fact-guard";

type HingeAnswer = { prompt: string; answer: string };
type BusyState = "idle" | "extracting" | "analyzing";

async function postApi<T>(url: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Couldn’t reach the server. Check your connection and try again.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }

  if (!response.ok) {
    const message = (body as { error?: { message?: string } })?.error?.message;
    throw new Error(message || `Request failed (${response.status}). Please try again.`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("The server response did not match the expected format.");
  return parsed.data;
}

const ratingLabels: Record<AudienceCritique["rating"], string> = {
  not_evident: "Not evident", weak: "Could be clearer", moderate: "Coming through", strong: "Strong",
};

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
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Persona home"><span className="brand-mark"><Sparkles size={16} /></span>persona<span className="brand-period">.</span></a>
        <nav className="topnav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#workspace">Workspace</a><span className="local-pill"><i /> Private workspace</span></nav>
        <span className="avatar" aria-label="PERSONA">P</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR VOICE, EVERYWHERE</div>
        <h1>Show up as <em>you.</em><br />Just a little clearer.</h1>
        <p className="hero-copy">A thoughtful second opinion for your online profiles.<br className="desktop-break" /> Sharpen the story. Keep what makes it yours.</p>
        <a className="scroll-link" href="#workspace"><span className="scroll-icon"><ArrowDown size={14} /></span> GET STARTED</a>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      </section>

      <section className="workspace" id="workspace">
        <div className="workspace-heading"><div><div className="section-kicker">PROFILE STUDIO <span>01 — 03</span></div><h2>Let’s work on your profile</h2></div><div className="step-indicator"><b>{rewriteResult ? "03" : factsReady ? "02" : "01"}</b><span /><span className="muted-step">03</span></div></div>
        <div className="studio-grid">
          <section className="panel editor-panel">
            <div className="panel-top"><div><div className="panel-label"><span className="number-badge">01</span> YOUR STARTING POINT</div><h3>Where are we polishing?</h3></div><span className="required-label">REQUIRED</span></div>
            <label className="field-label" htmlFor="platform">CHOOSE A PLATFORM</label>
            <div className="select-wrap"><select id="platform" value={platform} onChange={(event) => changePlatform(event.target.value as Platform)}><option value="linkedin">LinkedIn</option><option value="hinge">Hinge</option></select><ChevronDown size={16} aria-hidden="true" /></div>

            {platform === "linkedin" ? <>
              <div className="input-label-row"><label className="field-label" htmlFor="headline">HEADLINE <span className="optional-label">OPTIONAL</span></label><span>{headline.length}/220</span></div>
              <input id="headline" className="persona-input" value={headline} maxLength={220} onChange={(event) => updateProfile(() => setHeadline(event.target.value))} placeholder="Your current LinkedIn headline" />
              <div className="input-label-row"><label className="field-label" htmlFor="about">ABOUT SECTION</label><span>{about.length} characters</span></div>
              <textarea id="about" maxLength={LIMITS.profileText} value={about} onChange={(event) => updateProfile(() => setAbout(event.target.value))} placeholder="Paste your About section…" />
              <div className="input-label-row"><label className="field-label" htmlFor="job-description">JOB DESCRIPTION <span className="optional-label">OPTIONAL</span></label></div>
              <textarea id="job-description" className="short-textarea" maxLength={LIMITS.jobDescription} value={jobDescription} onChange={(event) => { invalidateAnalysisResults(); setJobDescription(event.target.value); }} placeholder="Add a job description to tailor relevance feedback…" />
            </> : <>
              <div className="input-label-row"><label className="field-label">HINGE PROMPTS</label><span>1–3 pairs</span></div>
              <div className="hinge-editor-list">{hingeAnswers.map((pair, index) => <div className="hinge-editor" key={`hinge-${index}`}>
                <div className="hinge-editor-title"><span>PROMPT {index + 1}</span>{hingeAnswers.length > 1 && <button className="icon-button" aria-label={`Remove prompt ${index + 1}`} onClick={() => updateProfile(() => setHingeAnswers((current) => current.filter((_, i) => i !== index)))}><Trash2 size={13} /></button>}</div>
                <input className="persona-input" value={pair.prompt} maxLength={200} onChange={(event) => updateProfile(() => setHingeAnswers((current) => current.map((item, i) => i === index ? { ...item, prompt: event.target.value } : item)))} placeholder="Prompt question" aria-label={`Hinge prompt ${index + 1}`} />
                <textarea className="hinge-answer" value={pair.answer} maxLength={LIMITS.profileText} onChange={(event) => updateProfile(() => setHingeAnswers((current) => current.map((item, i) => i === index ? { ...item, answer: event.target.value } : item)))} placeholder="Your answer" aria-label={`Hinge answer ${index + 1}`} />
              </div>)}</div>
              {hingeAnswers.length < 3 && <button className="text-button add-prompt" onClick={() => updateProfile(() => setHingeAnswers((current) => [...current, { prompt: "", answer: "" }]))}><Plus size={13} /> Add another prompt</button>}
            </>}

            <div className="textarea-footer"><span>{profileLength}/{LIMITS.profileText} profile characters</span><button className="text-button" onClick={loadDemo}>Load a fictitious sample profile <ArrowRight size={13} /></button></div>
            <div className="consent-box"><input type="checkbox" id="consent" checked={consent} onChange={(event) => { if (!event.target.checked) invalidateAnalysisResults(); setConsent(event.target.checked); }} /><label htmlFor="consent"><strong>Okay to send this text for AI feedback</strong><span>Your profile and confirmed facts will be sent to OpenRouter and its underlying model provider. PERSONA does not save your profile text. Nothing is posted automatically.</span></label></div>
            <button className="primary-button" onClick={suggestFacts} disabled={busy !== "idle" || !hasProfile || !consent || profileLength > LIMITS.profileText}>
              {busy === "extracting" ? <LoaderCircle className="spin-icon" size={16} /> : <Sparkles size={16} />}{busy === "extracting" ? "Finding possible facts…" : factsReady ? "Refresh suggested facts" : "Suggest identity facts"}<ArrowRight size={15} />
            </button>
            <p className="button-note">Suggested facts stay unconfirmed until you check them.</p>

            {factsReady && <div className="workflow-section">
              <div className="panel-label"><span className="number-badge">02</span> YOUR IDENTITY DNA</div>
              <h3>Which details are true?</h3>
              <p className="section-help">{facts.length ? "Edit suggestions or add a fact. Only checked facts can support the rewrite." : "No candidate facts were suggested. Add any true details you want the rewrite to use."}</p>
              <div className="fact-list">{facts.map((fact, index) => <div className="fact-row" key={fact.id}>
                <input type="checkbox" checked={fact.confirmed} onChange={(event) => updateFact(index, { confirmed: event.target.checked })} aria-label={`Confirm fact ${index + 1}`} />
                <textarea value={fact.text} maxLength={LIMITS.factText} onChange={(event) => updateFact(index, { text: event.target.value })} aria-label={`Fact ${index + 1}`} placeholder="A true detail about you" />
                <button className="icon-button remove-fact" aria-label={`Remove fact ${index + 1}`} onClick={() => { invalidateAnalysisResults(); setFacts((current) => current.filter((_, i) => i !== index)); }}><Trash2 size={13} /></button>
              </div>)}</div>
              {facts.length < LIMITS.maxFacts && <button className="text-button add-prompt" onClick={addFact}><Plus size={13} /> Add your own fact</button>}
              <div className="selection-group"><div className="selection-heading"><span>SIMULATED AUDIENCES</span><small>Select up to 3</small></div><div className="choice-list">{config.audiences.map((audience) => <label className="choice-chip" key={audience.id}><input type="checkbox" checked={audienceIds.includes(audience.id)} onChange={() => toggleSelection(audience.id, audienceIds, setAudienceIds, LIMITS.maxAudiences)} disabled={!audienceIds.includes(audience.id) && audienceIds.length >= LIMITS.maxAudiences} /><span>{audience.label}</span></label>)}</div></div>
              <div className="selection-group"><div className="selection-heading"><span>WHAT SHOULD COME THROUGH?</span><small>Select up to {LIMITS.maxTraits}</small></div><div className="choice-list">{config.traits.map((trait) => <label className="choice-chip" key={trait.id}><input type="checkbox" checked={traitIds.includes(trait.id)} onChange={() => toggleSelection(trait.id, traitIds, setTraitIds, LIMITS.maxTraits)} disabled={!traitIds.includes(trait.id) && traitIds.length >= LIMITS.maxTraits} /><span>{trait.label}</span></label>)}</div></div>
              <div className="input-label-row"><label className="field-label" htmlFor="goal">YOUR GOAL <span className="optional-label">OPTIONAL</span></label></div>
              <input id="goal" className="persona-input" maxLength={300} value={goal} onChange={(event) => { invalidateAnalysisResults(); setGoal(event.target.value); }} placeholder={platform === "linkedin" ? "e.g. Make my project work easier to understand" : "e.g. Sound more like me, but a bit more specific"} />
              <div className="input-label-row"><label className="field-label" htmlFor="tone">REWRITE TONE</label></div>
              <div className="select-wrap"><select id="tone" value={tone} onChange={(event) => { invalidateAnalysisResults(); setTone(event.target.value as typeof tone); }}><option value="closer_to_my_words">Keep closer to my words</option><option value="balanced">Balanced</option><option value="more_playful">More playful</option></select><ChevronDown size={16} aria-hidden="true" /></div>
              <button className="primary-button analyze-button" onClick={runAnalysis} disabled={busy !== "idle" || !consent || !hasProfile || audienceIds.length === 0 || traitIds.length === 0}>
                {busy === "analyzing" ? <LoaderCircle className="spin-icon" size={16} /> : <Sparkles size={16} />}{busy === "analyzing" ? "Evaluating and rewriting…" : "Evaluate & create rewrite"}<ArrowRight size={15} />
              </button>
              <p className="button-note">{confirmedCount} confirmed fact{confirmedCount === 1 ? "" : "s"} · simulated AI feedback, not a prediction</p>
            </div>}
            {error && <div className="error-message" role="alert"><TriangleAlert size={15} /><span>{error}</span></div>}
          </section>

          <section className="panel preview-panel results-panel" aria-live="polite">
            <div className="panel-top"><div><div className="panel-label"><span className="number-badge number-badge-light">03</span> YOUR RESULTS</div><h3>{rewriteResult || evaluation ? "A clearer version of you." : "Your feedback will appear here."}</h3></div><span className="sparkle-small"><Sparkles size={17} /></span></div>
            <p className="preview-intro">{rewriteResult || evaluation ? "Simulated AI feedback can offer a fresh perspective. You decide what to use." : "Add your profile, confirm your details, and run an analysis to see evidence-linked suggestions."}</p>

            {rewriteResult ? <>
              <div className="preview-card live-result-card">
                <div className="preview-card-top"><span className="preview-platform"><span className="platform-dot">{platform === "linkedin" ? "in" : "h"}</span>{platform === "linkedin" ? "LinkedIn" : "Hinge"}<span className={rewriteResult.source === "sample" ? "demo-tag" : "live-tag"}>{rewriteResult.source === "sample" ? "SAMPLE RESULT" : "LIVE RESULT"}</span></span></div>
                <div className="profile-name">Updated profile</div>
                <textarea className="rewrite-editor" aria-label="Edit your rewritten profile" value={rewriteResult.rewrite.content} onChange={(event) => editRewrite(event.target.value)} />
                <p className="edit-hint">You can edit this text before copying. FactCheck updates as you make changes.</p>
                <div className="rewrite-divider" />
                <div className={`factcheck-status ${rewriteResult.warnings.length ? "has-warnings" : ""}`}>
                  {rewriteResult.warnings.length ? <TriangleAlert size={15} /> : <span className="note-check"><Check size={12} /></span>}
                  <span><strong>{rewriteResult.warnings.length ? `${rewriteResult.warnings.length} FactCheck item${rewriteResult.warnings.length === 1 ? "" : "s"} to review` : "No unsupported concrete claims detected"}</strong><br />FactCheck is a heuristic and can miss subtle exaggeration.</span>
                </div>
                {rewriteResult.warnings.length > 0 && <WarningList warnings={rewriteResult.warnings} />}
                {rewriteResult.rewrite.changeSummary.length > 0 && <div className="change-summary"><strong>What changed</strong><ul>{rewriteResult.rewrite.changeSummary.map((item, i) => <li key={`change-${i}`}>{item}</li>)}</ul></div>}
                <button className="copy-button" onClick={copyRewrite}><Clipboard size={14} />{copied ? "Copied to clipboard" : "Copy updated profile"}{copied && <Check size={13} />}</button>
              </div>
            </> : <div className="empty-result"><Sparkles size={20} /><span>Rewrites are grounded in your original text and the facts you confirm.</span></div>}

            {evaluation && <div className="evaluation-section">
              <div className="results-subheading"><div><div className="panel-label">AUDIENCE CLASH</div><h4>How it may come across</h4></div><span className="simulated-tag">{evaluation.source === "sample" ? "SAMPLE RESULT · " : ""}SIMULATED AI FEEDBACK</span></div>
              {evaluation.critiques.length === 0 ? <p className="section-help">No critique cards came back. Try fewer traits or audiences.</p> : <div className="critique-list">{evaluation.critiques.map((critique, index) => {
                const evidence = critiqueSegments(critique);
                return <article className={`critique-card ${activeSegment && evidence.some((segment) => segment.id === activeSegment) ? "critique-active" : ""}`} key={`${critique.audience}-${critique.trait}-${index}`}>
                  <div className="critique-head"><span>{audienceLabel(critique.audience)}</span><span className={`rating-pill rating-${critique.rating}`}>{ratingLabels[critique.rating]}</span></div>
                  <div className="critique-trait">{traitLabel(critique.trait)}</div>
                  <p>{critique.rationale}</p>
                  {critique.suggestion && <div className="critique-suggestion"><strong>Try:</strong> {critique.suggestion}</div>}
                  {evidence.length ? <div className="evidence-list"><span>BASED ON</span>{evidence.map((segment) => <button key={segment.id} className={`evidence-quote ${activeSegment === segment.id ? "evidence-active" : ""}`} onClick={() => setActiveSegment(activeSegment === segment.id ? null : segment.id)}><b>{segment.id}</b> “{segment.text}”</button>)}</div> : <div className="missing-evidence">No supporting text found in this profile.</div>}
                </article>;
              })}</div>}
              {evaluation.warnings.length > 0 && <WarningList warnings={evaluation.warnings} />}
            </div>}
            <div className="privacy-foot"><span className="lock-icon">✳</span> Simulated audience lenses. No predictions about hiring or matches.</div>
          </section>
        </div>
        <div className="trust-strip"><span><Check size={13} /> Your words stay yours</span><i /><span><Check size={13} /> No auto-posting</span><i /><span><Check size={13} /> You choose what to change</span></div>
      </section>

      <section className="how-section" id="how-it-works"><div className="how-inner"><div><div className="section-kicker">SIMPLE BY DESIGN</div><h2>Thoughtful edits.<br /><em>Still your story.</em></h2></div><div className="how-cards"><article><span>01</span><h3>Bring your words</h3><p>Paste your LinkedIn or Hinge profile. Start with what’s already yours.</p></article><article><span>02</span><h3>Get a fresh perspective</h3><p>See how your profile might come across through simulated audience lenses.</p></article><article><span>03</span><h3>Make it your own</h3><p>Copy a rewrite, tweak it, or leave it as is. You’re always in control.</p></article></div></div></section>
      <footer><a className="brand footer-brand" href="#top">persona<span className="brand-period">.</span></a><span>One identity. Every platform. Authentically you.</span><span className="footer-right"><Command size={12} /> Made for humans, by humans.</span></footer>
    </main>
  );
}

function WarningList({ warnings }: { warnings: GuardWarning[] }) {
  return <div className="warning-list">{warnings.map((warning, index) => <div className="warning-item" key={`${warning.kind}-${warning.text}-${index}`}><TriangleAlert size={13} /><span><strong>{warning.text || warning.kind}</strong> — {warning.explanation}</span></div>)}</div>;
}
