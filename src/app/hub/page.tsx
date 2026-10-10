import { ArrowRight, Check, CircleAlert, IdCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Backdrop, BrandMark, WorldFooter, Wordmark } from "@/components/Chrome";
import { Button } from "@/components/ui/button";
import { DEMO_LINKEDIN_FACTS, DEMO_LINKEDIN_PROFILE, DEMO_PERSONA } from "@/lib/demo-data";
import { factCoverage } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Identity Hub — Personify",
  description: "A demo profile showing which of your confirmed facts appear on each platform.",
};

// Demo only: the fictitious persona, nothing saved, no login. Every number is a real count
// from Person 1's factCoverage over the demo profile and confirmed facts; there are no scores.
export default function HubPage() {
  const profile = DEMO_LINKEDIN_PROFILE;
  const facts = DEMO_LINKEDIN_FACTS.filter((f) => f.confirmed);
  const coverage = factCoverage(profile, facts);
  const sections = coverage.bySection;
  const labelOf = new Map(sections.map((s) => [s.sectionKey, s.label]));
  const missing = coverage.perFact.filter((f) => !f.sectionKeys.length);
  const name = DEMO_PERSONA.name.replace(/\s*\(.*\)$/, "");
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="app-root" data-theme="linkedin">
      <Backdrop />
      <header className="site-header">
        <Wordmark />
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/" className="studio-link">
            Home
          </Link>
          <Button variant="glass" nativeButton={false} render={<Link href="/studio" />}>
            Profile studio <ArrowRight />
          </Button>
        </nav>
      </header>
      <main className="studio-shell">
        <div className="studio-body hub-body">
          <div className="hub-title-row">
            <h1>Identity Hub</h1>
            <span className="sample-badge">Demo profile</span>
          </div>
          <p className="welcome-copy">
            One set of confirmed facts, used by every platform. This page shows a fictitious demo persona; nothing is saved.
          </p>

          <section className="hub-persona" aria-label="Demo persona">
            <span className="hub-avatar" aria-hidden="true">
              {initials}
            </span>
            <div>
              <h2>{name}</h2>
              <p className="empty-note">
                Demo persona (fictitious) · 1 LinkedIn profile · {sections.length} sections · {coverage.summary.confirmed}{" "}
                confirmed facts
              </p>
              <p className="status-note">
                <Check size={14} />
                {coverage.summary.covered} of {coverage.summary.confirmed} confirmed facts appear on your LinkedIn
              </p>
            </div>
          </section>

          <section aria-labelledby="platforms">
            <h2 id="platforms" className="section-heading">
              Open a platform
            </h2>
            <div className="hub-platforms">
              <Link href="/studio?platform=linkedin" className="hub-platform" data-platform="linkedin">
                <span className="platform-icon">
                  <BrandMark platform="linkedin" />
                </span>
                <span>
                  <span className="platform-name">LinkedIn</span>
                  <span className="platform-description">Your profile by section · feedback and rewrites</span>
                </span>
                <ArrowRight className="hub-arrow" aria-hidden="true" />
              </Link>
              <Link href="/studio?platform=hinge" className="hub-platform" data-platform="hinge">
                <span className="platform-icon">
                  <BrandMark platform="hinge" />
                </span>
                <span>
                  <span className="platform-name">Hinge</span>
                  <span className="platform-description">Prompt answers · feedback and rewrites</span>
                </span>
                <ArrowRight className="hub-arrow" aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section aria-labelledby="coverage" className="hub-coverage">
            <h2 id="coverage" className="section-heading">
              <IdCard />
              Your facts on LinkedIn
            </h2>
            <p className="empty-note">
              How many of your confirmed facts each section mentions. Counts only, no scores.
            </p>
            <ul className="hub-bars">
              {sections.map((s) => {
                const n = s.factIds.length;
                return (
                  <li key={s.sectionKey} className="hub-bar-row" data-empty={n === 0}>
                    <span className="hub-bar-label">{s.label}</span>
                    <span className="hub-bar-track" aria-hidden="true">
                      <span
                        className="hub-bar-fill"
                        style={{ width: `${coverage.summary.confirmed ? (n / coverage.summary.confirmed) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="hub-bar-count">
                      {n} of {coverage.summary.confirmed}
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
                          : "Not on your LinkedIn yet"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {missing.length > 0 && (
              <div className="action-band">
                <span className="empty-note">
                  {missing.length === 1 ? "1 confirmed fact isn’t" : `${missing.length} confirmed facts aren’t`} on your LinkedIn.
                  A rewrite can add {missing.length === 1 ? "it" : "them"}.
                </span>
                <Button variant="aero" nativeButton={false} render={<Link href="/studio?platform=linkedin" />}>
                  Rewrite LinkedIn <ArrowRight />
                </Button>
              </div>
            )}
          </section>
        </div>
      </main>
      <WorldFooter />
    </div>
  );
}
