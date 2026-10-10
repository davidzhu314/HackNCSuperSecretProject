"use client";

import { ArrowUpRight, Check, CircleAlert, FileUp, Fingerprint, IdCard, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { BrandMark } from "@/components/Chrome";
import { Button } from "@/components/ui/button";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE } from "@/lib/demo-data";
import { clearSession, setPhotoFile, updateSession, useIdentitySession } from "@/lib/identity-session";
import { factCoverage, rewritableSections, segmentProfile } from "@/lib/profile";
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
  const loadedDemo = !!linkedin && JSON.stringify(linkedin) === JSON.stringify(cleanProfile(DEMO_LINKEDIN_PROFILE));

  async function importPdf(file?: File) {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importProfileFile(file);
      updateSession(
        { linkedin: res.profile, linkedinImport: { fileName: file.name, warnings: res.warnings } },
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
            One identity. Authentically you.
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

      {own && linkedin ? (
        <Coverage profile={linkedin} facts={confirmed} mode={loadedDemo ? "demo" : "own"} />
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
 * Which confirmed facts show up in which LinkedIn section. Real counts only.
 * "own": the user's profile; "demo": the user loaded the demo persona; "example": nothing of
 * the user's yet, so the demo persona is shown as an example.
 */
function Coverage(props: { profile: LinkedInProfile; facts: IdentityFact[]; mode: "own" | "demo" | "example" }) {
  const { profile, facts, mode } = props;
  const demo = mode !== "own";
  const coverage = factCoverage(profile, facts);
  const sections = coverage.bySection;
  const labelOf = new Map(sections.map((s) => [s.sectionKey, s.label]));
  const missing = coverage.perFact.filter((f) => !f.sectionKeys.length);
  const total = coverage.summary.confirmed;

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
        {coverage.summary.covered} of {total} confirmed facts appear on {demo ? "the demo" : "your"} LinkedIn
      </p>
      <p className="empty-note">
        {demo
          ? mode === "example"
            ? "An example with the demo persona. Add your LinkedIn and confirm your facts in the studio to see your own. Counts only, no scores."
            : "You loaded the demo persona in the studio. Counts only, no scores."
          : "How many of your confirmed facts each section mentions. Counts only, no scores; a fact worded very differently isn’t counted."}
      </p>
      <ul className="hub-bars">
        {sections.map((s) => {
          const n = s.factIds.length;
          return (
            <li key={s.sectionKey} className="hub-bar-row" data-empty={n === 0}>
              <span className="hub-bar-label">{s.label}</span>
              <span className="hub-bar-track" aria-hidden="true">
                <span className="hub-bar-fill" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </span>
              <span className="hub-bar-count">
                {n} of {total}
              </span>
            </li>
          );
        })}
      </ul>

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
      {missing.length > 0 && mode !== "example" && (
        <div className="action-band">
          <span className="empty-note">
            {missing.length === 1 ? "1 confirmed fact isn’t" : `${missing.length} confirmed facts aren’t`} on{" "}
            {demo ? "the demo’s" : "your"} LinkedIn.
            A rewrite can add {missing.length === 1 ? "it" : "them"}.
          </span>
          <Button variant="aero" nativeButton={false} render={<Link href="/studio?platform=linkedin" />}>
            Rewrite LinkedIn <ArrowUpRight />
          </Button>
        </div>
      )}
    </section>
  );
}
