"use client";

import { ArrowUpRight, Check, CircleAlert, FileUp, Fingerprint, IdCard, ImagePlus, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { BrandMark } from "@/components/Chrome";
import { Button } from "@/components/ui/button";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE } from "@/lib/demo-data";
import { PLATFORMS, platformsOf, togglePlatform, type FactPlatforms } from "@/lib/fact-platforms";
import { clearSession, getSession, setPhotoFile, updateSession, useIdentitySession } from "@/lib/identity-session";
import type { HingePair } from "@/lib/persona-ui";
import { factCoverage, rewritableSections, segmentProfile } from "@/lib/profile";
import { hingeFactIds } from "@/lib/profile-edits";
import { cleanProfile, importProfileFile } from "@/lib/profile-import";
import type { IdentityFact, LinkedInProfile } from "@/lib/schemas";

// The Identity Hub: one pool of source material and confirmed facts for every platform.
// Everything here lives in this tab's memory (identity-session.ts) and is read in the browser;
// nothing is sent or stored. Coverage counts are real (factCoverage), never scores. Without the
// user's own profile and confirmed facts, the coverage shows the labeled demo persona instead.

export function IdentityHub() {
  const session = useIdentitySession();
  const pdfInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedin = session.linkedin ? cleanProfile(session.linkedin) : null;
  const linkedinSections = linkedin ? rewritableSections(linkedin).length : 0;
  const hingeAnswers = session.hinge?.filter((p) => p.answer.trim()).length ?? 0;
  const confirmed = session.facts.filter((f) => f.confirmed && f.text.trim());
  const own = !!linkedin && segmentProfile(linkedin).length > 0 && confirmed.length > 0;
  // Before any "Use this version" rewrites; the demo is recognized by its original text.
  const before = session.linkedinOriginal ? cleanProfile(session.linkedinOriginal) : null;
  const loadedDemo = JSON.stringify(before ?? linkedin) === JSON.stringify(cleanProfile(DEMO_LINKEDIN_PROFILE));

  async function importPdf(file?: File) {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importProfileFile(file);
      updateSession(
        { linkedin: res.profile, linkedinOriginal: null, linkedinImport: { fileName: file.name, warnings: res.warnings } },
        { external: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file couldn’t be read.");
    } finally {
      setImporting(false);
      if (pdfInput.current) pdfInput.current.value = "";
    }
  }

  function choosePhoto(file?: File) {
    if (!file) return;
    setError(setPhotoFile(file));
    if (photoInput.current) photoInput.current.value = "";
  }

  return (
    <div className="hub-layout">
      <section className="hub-persona hub-card" aria-label="Your identity">
        <div
          className="hub-portrait"
          data-dragging={dragging}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choosePhoto(e.dataTransfer.files[0]);
          }}
        >
          {session.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimizable asset
            <img src={session.photo.url} alt="Your profile photo" />
          ) : (
            <Fingerprint size={34} aria-hidden="true" />
          )}
        </div>
        <div className="hub-persona-text">
          <span className="eyebrow">
            <Fingerprint size={13} />
            Write once, show up everywhere
          </span>
          <h1>Your Identity Hub</h1>
          <p className="empty-note">
            {linkedin ? `LinkedIn: ${linkedinSections} sections` : "LinkedIn: not added"} ·{" "}
            {hingeAnswers ? `Hinge: ${hingeAnswers} ${hingeAnswers === 1 ? "answer" : "answers"}` : "Hinge: not added"} ·{" "}
            {confirmed.length} confirmed {confirmed.length === 1 ? "fact" : "facts"}
          </p>
          <div className="hub-actions">
            <input
              ref={photoInput}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose a profile photo"
              onChange={(e) => choosePhoto(e.target.files?.[0])}
            />
            <Button variant="glass" size="sm" onClick={() => photoInput.current?.click()}>
              <ImagePlus />
              {session.photo ? "Change photo" : "Add photo"}
            </Button>
            {session.photo && (
              <Button variant="ghost" size="sm" onClick={() => updateSession({ photo: null })}>
                Remove photo
              </Button>
            )}
          </div>
          <p className="empty-note hub-fine-print">
            Your photo stays on this device and is never sent to the AI. This page keeps everything in this tab only;
            refreshing clears it.
          </p>
        </div>
      </section>

      {error && (
        <p className="flow-error" role="alert">
          <CircleAlert size={16} />
          {error}
        </p>
      )}

      <div className="hub-grid">
        <section className="hub-card hub-source" data-platform="linkedin" aria-labelledby="src-linkedin">
          <div className="hub-source-head">
            <span className="platform-icon">
              <BrandMark platform="linkedin" />
            </span>
            <div>
              <h2 id="src-linkedin">LinkedIn</h2>
              <p className="empty-note">
                {session.linkedinImport
                  ? `Imported from ${session.linkedinImport.fileName} · ${linkedinSections} sections`
                  : linkedin
                    ? `${linkedinSections} sections, entered in the studio`
                    : "Not added yet. Import LinkedIn’s “Save to PDF” export, or type it in the studio."}
              </p>
            </div>
          </div>
          {!!session.linkedinImport?.warnings.length && (
            <ul className="hub-warnings">
              {session.linkedinImport.warnings.map((w) => (
                <li key={w}>
                  <CircleAlert size={13} aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          )}
          <div className="hub-actions">
            <input
              ref={pdfInput}
              type="file"
              className="hidden"
              accept=".pdf,.txt,.md,.json"
              aria-label="Import a LinkedIn PDF"
              onChange={(e) => void importPdf(e.target.files?.[0])}
            />
            <Button variant="glass" size="sm" disabled={importing} onClick={() => pdfInput.current?.click()}>
              {importing ? <LoaderCircle className="animate-spin" /> : <FileUp />}
              {linkedin ? "Replace with a PDF" : "Import PDF"}
            </Button>
            <Button variant="aero" size="sm" nativeButton={false} render={<Link href="/studio?platform=linkedin" />}>
              {linkedin ? "Review in studio" : "Open studio"} <ArrowUpRight />
            </Button>
          </div>
        </section>

        <section className="hub-card hub-source" data-platform="hinge" aria-labelledby="src-hinge">
          <div className="hub-source-head">
            <span className="platform-icon">
              <BrandMark platform="hinge" />
            </span>
            <div>
              <h2 id="src-hinge">Hinge</h2>
              <p className="empty-note">
                {hingeAnswers
                  ? `${hingeAnswers} prompt ${hingeAnswers === 1 ? "answer" : "answers"}`
                  : "Not added yet. Up to three prompt answers."}
              </p>
            </div>
          </div>
          <p className="empty-note">
            Facts you confirmed on LinkedIn come with you, so Hinge starts from the same true facts.
          </p>
          <div className="hub-actions">
            <Button variant="aero" size="sm" nativeButton={false} render={<Link href="/studio?platform=hinge" />}>
              {hingeAnswers ? "Review in studio" : "Open studio"} <ArrowUpRight />
            </Button>
          </div>
        </section>
      </div>

      <FactsCard facts={confirmed} linkedin={linkedin} hinge={session.hinge} factPlatforms={session.factPlatforms} />

      {own && linkedin ? (
        <Coverage profile={linkedin} before={before} facts={confirmed} mode={loadedDemo ? "demo" : "own"} />
      ) : (
        <Coverage profile={DEMO_LINKEDIN_PROFILE} facts={DEMO_LINKEDIN_FACTS.filter((f) => f.confirmed)} mode="example" />
      )}

      {(linkedin || hingeAnswers > 0 || session.facts.length > 0 || session.photo) && (
        <div className="hub-clear">
          <Button variant="ghost" size="sm" onClick={clearSession}>
            <Trash2 />
            Clear this session
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Your facts: the one set of confirmed facts every platform draws on, and where each shows up.
 * LinkedIn by section, Hinge in the answers; both by the same deterministic word overlap.
 */
function FactsCard(props: {
  facts: IdentityFact[];
  linkedin: LinkedInProfile | null;
  hinge: HingePair[] | null;
  factPlatforms: FactPlatforms;
}) {
  const { facts, linkedin, hinge, factPlatforms } = props;
  const hasHinge = !!hinge?.some((p) => p.answer.trim());
  const linkedinCoverage = linkedin ? factCoverage(linkedin, facts) : null;
  const labelOf = new Map(linkedinCoverage?.bySection.map((s) => [s.sectionKey, s.label]));
  const onHinge = hingeFactIds(hinge, facts);

  return (
    <section className="hub-card hub-facts-card" aria-labelledby="facts-h">
      <div className="results-heading">
        <h2 id="facts-h" className="section-heading">
          <Fingerprint />
          Your facts
        </h2>
        <span className="empty-note">Write once, show up everywhere: {facts.length} confirmed</span>
      </div>
      {!facts.length ? (
        <p className="empty-note">
          No confirmed facts yet. Confirm them in the studio (step 3, Identity DNA). You confirm each fact once, choose
          which platforms may use it, and rewrites everywhere use only these.
        </p>
      ) : (
        <ul className="hub-facts">
          {facts.map((fact) => {
            const keys = linkedinCoverage?.perFact.find((f) => f.factId === fact.id)?.sectionKeys ?? [];
            const shared = platformsOf(fact, factPlatforms);
            return (
              <li key={fact.id} className="hub-fact hub-fact-wide">
                <Check size={15} aria-hidden="true" />
                <div>
                  <p>{fact.text}</p>
                  <span className="fact-share" role="group" aria-label="Platforms this fact is used on">
                    Use on
                    {PLATFORMS.map((p) => (
                      <button
                        type="button"
                        key={p}
                        className="share-chip"
                        data-on={shared.includes(p)}
                        aria-pressed={shared.includes(p)}
                        onClick={() => updateSession({ factPlatforms: togglePlatform(getSession().factPlatforms, fact, p) })}
                      >
                        {p === "linkedin" ? "LinkedIn" : "Hinge"}
                      </button>
                    ))}
                  </span>
                  <div className="fact-platforms">
                    {linkedin && (
                      <span className="fact-platform" data-found={keys.length > 0} data-shared={shared.includes("linkedin")}>
                        <strong>LinkedIn:</strong>{" "}
                        {!shared.includes("linkedin")
                          ? "not shared"
                          : keys.length
                            ? keys.map((k) => labelOf.get(k) ?? k).join(", ")
                            : "not yet"}
                      </span>
                    )}
                    {hasHinge && (
                      <span className="fact-platform" data-found={onHinge.has(fact.id)} data-shared={shared.includes("hinge")}>
                        <strong>Hinge:</strong>{" "}
                        {!shared.includes("hinge") ? "not shared" : onHinge.has(fact.id) ? "in your answers" : "not yet"}
                      </span>
                    )}
                    {!linkedin && !hasHinge && <span className="empty-note">Add a profile to see where it appears.</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {facts.length > 0 && (
        <p className="empty-note hub-fine-print">
          Approximate: a fact counts when most of its words (and all its numbers) appear. A fact worded very differently
          isn’t counted.
        </p>
      )}
    </section>
  );
}

/**
 * Which confirmed facts show up in which LinkedIn section. Real counts only.
 * "own": the user's profile; "demo": the user loaded the demo persona; "example": nothing of
 * the user's yet, so the demo persona is shown as an example. `before` is the profile before
 * any "Use this version" rewrites, for a before → after count.
 */
function Coverage(props: {
  profile: LinkedInProfile;
  before?: LinkedInProfile | null;
  facts: IdentityFact[];
  mode: "own" | "demo" | "example";
}) {
  const { profile, before, facts, mode } = props;
  const demo = mode !== "own";
  const coverage = factCoverage(profile, facts);
  const earlier = before ? factCoverage(before, facts) : null;
  const sections = coverage.bySection;
  const labelOf = new Map(sections.map((s) => [s.sectionKey, s.label]));
  const missing = coverage.perFact.filter((f) => !f.sectionKeys.length);
  const total = coverage.summary.confirmed;
  const gained = earlier ? coverage.summary.covered - earlier.summary.covered : 0;

  return (
    <section aria-labelledby="coverage" className="hub-card hub-coverage">
      <div className="results-heading">
        <h2 id="coverage" className="section-heading">
          <IdCard />
          {demo ? "Your facts on LinkedIn: demo" : "Your facts on LinkedIn"}
        </h2>
        {demo && <span className="sample-badge">Demo profile (fictitious)</span>}
      </div>
      <p className="status-note">
        <Check size={14} />
        {earlier && earlier.summary.covered !== coverage.summary.covered
          ? `${earlier.summary.covered} → ${coverage.summary.covered}`
          : coverage.summary.covered}{" "}
        of {total} confirmed facts appear on {demo ? "the demo" : "your"} LinkedIn
        {earlier ? " (before → after the rewrites you used)" : ""}
      </p>
      {gained > 0 && (
        <p className="hub-gain">
          <Sparkles size={14} />
          The rewrites you used added {gained} {gained === 1 ? "fact" : "facts"} to your profile.
        </p>
      )}
      <p className="empty-note">
        {mode === "example"
          ? "An example with the demo persona. Add your LinkedIn and confirm your facts in the studio to see your own. Counts only, no scores."
          : "How many of your confirmed facts each section mentions. Counts only, no scores."}
      </p>
      <ul className="hub-bars">
        {sections.map((s) => {
          const n = s.factIds.length;
          const was = earlier?.bySection.find((b) => b.sectionKey === s.sectionKey)?.factIds.length;
          return (
            <li key={s.sectionKey} className="hub-bar-row" data-empty={n === 0}>
              <span className="hub-bar-label">{s.label}</span>
              <span className="hub-bar-track" aria-hidden="true">
                <span className="hub-bar-fill" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </span>
              <span className="hub-bar-count">
                {was !== undefined && was !== n ? `${was} → ` : ""}
                {n} of {total}
              </span>
            </li>
          );
        })}
      </ul>

      {mode === "example" && (
        <>
          <h3 className="section-heading hub-subheading">Each fact</h3>
          <ul className="hub-facts">
            {coverage.perFact.map((c) => {
              const fact = facts.find((f) => f.id === c.factId);
              return (
                <li key={c.factId} className="hub-fact" data-missing={!c.sectionKeys.length}>
                  {c.sectionKeys.length ? <Check size={15} aria-hidden="true" /> : <CircleAlert size={15} aria-hidden="true" />}
                  <div>
                    <p>{fact?.text}</p>
                    <p className="empty-note">
                      {c.sectionKeys.length
                        ? `In: ${c.sectionKeys.map((k) => labelOf.get(k) ?? k).join(", ")}`
                        : "Not on LinkedIn yet"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {missing.length > 0 && mode !== "example" && (
        <div className="action-band">
          <span className="empty-note">
            {missing.length === 1 ? "1 confirmed fact isn’t" : `${missing.length} confirmed facts aren’t`} on{" "}
            {demo ? "the demo’s" : "your"} LinkedIn. A rewrite can add {missing.length === 1 ? "it" : "them"}.
          </span>
          <Button variant="aero" nativeButton={false} render={<Link href="/studio?platform=linkedin" />}>
            Rewrite LinkedIn <ArrowUpRight />
          </Button>
        </div>
      )}
    </section>
  );
}
