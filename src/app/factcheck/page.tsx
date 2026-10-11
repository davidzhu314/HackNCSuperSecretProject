import { ArrowLeft, Check, ShieldCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Chrome";
import { HubThemeToggle } from "@/components/HubThemeToggle";
import { Button } from "@/components/ui/button";
import { PLANT_LABEL, runBenchmark, type PlantKind } from "@/lib/benchmark";
import { WARNING_LABEL } from "@/lib/persona-ui";

export const metadata: Metadata = {
  title: "FactCheck benchmark — Personify",
  description: "How often Personify's deterministic FactCheck catches planted fabrications, with every miss listed.",
};

// The benchmark runs the real FactCheck (code, not AI) over synthetic rewrites with planted
// fabrications. It is deterministic, so running it when the page is built gives the same counts
// the tests lock in. Misses are listed, not hidden.

export default function FactCheckBenchmarkPage() {
  const r = runBenchmark();
  const kinds = Object.keys(PLANT_LABEL) as PlantKind[];
  return (
    <div className="app-root hub-root" data-theme="linkedin">
      <header className="tour-header">
        <Button variant="tour" nativeButton={false} render={<Link href="/hub" />}>
          <ArrowLeft />
          Identity Hub
        </Button>
        <Wordmark className="tour-wordmark" />
        <div className="tour-header-actions">
          <HubThemeToggle />
        </div>
      </header>
      <main className="hub-main">
        <div className="hub-layout">
          <section className="bench-hero">
            <h1>FactCheck benchmark</h1>
            <p className="empty-note">
              Synthetic rewrites with planted fabrications, run through Personify&rsquo;s FactCheck: plain code that compares a
              rewrite with your own words, not an AI. Fictitious people only.
            </p>
            <div className="bench-stats">
              <div>
                <strong>
                  {r.caught} of {r.planted}
                </strong>
                <span>planted fabrications caught</span>
              </div>
              <div>
                <strong>
                  {r.falseAlarms} of {r.cleanCases}
                </strong>
                <span>faithful rewrites wrongly flagged</span>
              </div>
            </div>
          </section>

          <section className="hub-card" aria-labelledby="kinds-h">
            <h2 id="kinds-h" className="section-heading">
              <ShieldCheck />
              By kind of fabrication
            </h2>
            <ul className="bench-kinds">
              {kinds.map((k) => (
                <li key={k}>
                  <span>{PLANT_LABEL[k]}</span>
                  <span className="bench-count" data-all={r.byKind[k].caught === r.byKind[k].planted}>
                    {r.byKind[k].caught} of {r.byKind[k].planted}
                  </span>
                </li>
              ))}
            </ul>
            <p className="empty-note hub-fine-print">
              It catches invented numbers, names, credentials, and most inflated verbs. It misses subtle exaggerations
              (&ldquo;expert&rdquo;, &ldquo;the best in town&rdquo;) and a title written as a plain noun, so a clean
              result means &ldquo;no unsupported concrete claims detected&rdquo;, not more.
            </p>
          </section>

          <section className="hub-card" aria-labelledby="cases-h">
            <h2 id="cases-h" className="section-heading">
              Every case
            </h2>
            <ul className="bench-cases">
              {r.cases.map(({ case: c, caught, missed, warnings }) => (
                <li key={c.id} data-result={!c.planted.length ? (warnings.length ? "false-alarm" : "clean") : missed.length ? "missed" : "caught"}>
                  <p className="bench-rewrite">{c.rewrite}</p>
                  <p className="bench-source">
                    <span>Source text:</span> {c.source}
                    {c.facts.length > 0 && <> · <span>Fact:</span> {c.facts.join("; ")}</>}
                  </p>
                  <div className="bench-tags">
                    {!c.planted.length && (
                      <span className="bench-tag" data-ok={!warnings.length}>
                        {warnings.length ? <X size={12} /> : <Check size={12} />}
                        {warnings.length ? "Faithful, but flagged" : "Faithful rewrite, no warnings"}
                      </span>
                    )}
                    {caught.map((p) => (
                      <span key={p.text} className="bench-tag" data-ok="true">
                        <Check size={12} /> Caught: {p.text} <em>({PLANT_LABEL[p.kind]})</em>
                      </span>
                    ))}
                    {missed.map((p) => (
                      <span key={p.text} className="bench-tag" data-ok="false">
                        <X size={12} /> Missed: {p.text} <em>({PLANT_LABEL[p.kind]})</em>
                      </span>
                    ))}
                  </div>
                  {warnings.length > 0 && (
                    <p className="bench-warnings">
                      FactCheck said: {warnings.map((w) => `${WARNING_LABEL[w.kind]} “${w.text}”`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
