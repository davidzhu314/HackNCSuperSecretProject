"use client";

import { ArrowDown, ArrowRight, Check, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  DEMO_HINGE_SEGMENTS,
  DEMO_LINKEDIN_FACTS,
  DEMO_LINKEDIN_SEGMENTS,
  SAMPLE_ADVERSARIAL_REWRITE,
  SAMPLE_EVALUATE,
  SAMPLE_REWRITE,
} from "@/lib/demo-data";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import type { GuardWarning, Platform, Rating, Segment } from "@/lib/schemas";

// Landing page in the Avoriaz-derived world (see AVORIAZ_STYLE_GUIDE.md).
// The demo profile is the "panorama"; critiques pin to its sentences like tour hotspots.

type Spot = {
  segmentId: string | null; // null = missing evidence, not tied to any sentence
  audience: string;
  trait: string;
  rating: Rating;
  rationale: string;
  suggestion: string;
};

const RATING_LABEL: Record<Rating, string> = {
  not_evident: "Not evident",
  weak: "Weak",
  moderate: "Moderate",
  strong: "Strong",
};
const RATING_ORDER: Rating[] = ["not_evident", "weak", "moderate", "strong"];

function labelFor(platform: Platform, audience: string, trait: string) {
  const config = PLATFORM_CONFIGS[platform];
  return {
    audience: config.audiences.find((a) => a.id === audience)?.label ?? audience,
    trait: config.traits.find((t) => t.id === trait)?.label ?? trait,
  };
}

/** Real cached sample critiques for the LinkedIn demo persona, one per sentence plus a missing-evidence one. */
function linkedinSpots(): Spot[] {
  const pick = (audience: string, trait: string, segmentId: string | null): Spot => {
    const c = SAMPLE_EVALUATE.critiques.find((x) => x.audience === audience && x.trait === trait)!;
    return { segmentId, audience, trait, rating: c.rating, rationale: c.rationale, suggestion: c.suggestion };
  };
  return [
    pick("startup_founder", "clarity", "s1"),
    pick("technical_recruiter", "approachability", "s2"),
    pick("startup_founder", "ownership_impact", "s3"),
    pick("startup_founder", "relevance", "s4"),
    pick("technical_recruiter", "technical_specificity", null),
  ];
}

/** Hinge has no cached evaluation, so these are illustrative and labeled as such. */
const HINGE_SPOTS: Spot[] = [
  {
    segmentId: "s1",
    audience: "shared_interests",
    trait: "specificity",
    rating: "moderate",
    rationale: "A concrete, checkable interest. It hands someone an easy first question.",
    suggestion: "Name one city or one truck, if there's a real favorite.",
  },
  {
    segmentId: "s2",
    audience: "humor",
    trait: "authenticity",
    rating: "strong",
    rationale: "\"No plan\" sounds like an actual Sunday, not a template answer.",
    suggestion: "Keep your wording. It already sounds like you.",
  },
  {
    segmentId: null,
    audience: "serious_relationship",
    trait: "warmth",
    rating: "not_evident",
    rationale: "Nothing here says what you're hoping to find.",
    suggestion: "Add it only if it's true for you. We won't invent it.",
  },
];

const WARNING_LABEL: Record<GuardWarning["kind"], string> = {
  unsupported_number: "Number you never gave",
  unsupported_entity: "Name not in your text",
  inflated_verb: "Stronger verb than your facts",
  invalid_fact_id: "Fact that doesn't exist",
  unsupported_claim: "Claim with nothing behind it",
  unverified_segment: "Citation that doesn't exist",
  ai_cliche: "AI cliché",
  over_limit: "Over the character limit",
};

const FLOW = ["Paste", "Agree", "Confirm facts", "Pick audiences", "Read feedback", "Rewrite"];

export function Landing() {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [active, setActive] = useState(0);
  const [touring, setTouring] = useState(true);

  const segments: Segment[] = platform === "linkedin" ? DEMO_LINKEDIN_SEGMENTS : DEMO_HINGE_SEGMENTS;
  const spots = platform === "linkedin" ? linkedinSpots() : HINGE_SPOTS;

  // Walk through the hotspots on its own until the visitor touches anything.
  useEffect(() => {
    if (!touring) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % spots.length), 4800);
    return () => window.clearInterval(id);
  }, [touring, spots.length]);

  function choose(i: number) {
    setTouring(false);
    setActive(i);
  }

  function switchPlatform(next: Platform) {
    if (next === platform) return;
    setPlatform(next);
    setActive(0);
  }

  const missingIndex = spots.findIndex((s) => s.segmentId === null);

  return (
    <div className="pf">
      <section className="pf-hero" aria-labelledby="pf-hero-title" onPointerDown={() => setTouring(false)}>
        <header className="pf-bar">
          <Link href="/" className="pf-wordmark">
            Personify
          </Link>
          <div className="pf-switch" role="group" aria-label="Example platform">
            <span className="pf-switch-knob" data-at={platform} aria-hidden="true" />
            {(["linkedin", "hinge"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className="pf-switch-option"
                aria-pressed={platform === p}
                onClick={() => switchPlatform(p)}
              >
                {PLATFORM_CONFIGS[p].label}
              </button>
            ))}
          </div>
          <Link href="/studio" className="pf-button pf-button--square" aria-label="Open the studio">
            <ArrowRight aria-hidden="true" />
          </Link>
        </header>

        <div className="pf-pano">
          <p className="pf-sample">
            {platform === "linkedin"
              ? "Sample result · Priya Nair, a fictitious demo persona · simulated AI feedback"
              : "Illustrative example written for this page, not a model run · fictitious demo persona"}
          </p>
          <ol className="pf-segments" aria-label={`${PLATFORM_CONFIGS[platform].label} profile, sentence by sentence`}>
            {segments.map((seg) => {
              const i = spots.findIndex((s) => s.segmentId === seg.id);
              const lit = i >= 0 && i === active;
              return (
                <li key={`${platform}-${seg.id}`} className="pf-seg" data-lit={lit}>
                  <span className="pf-seg-id">{seg.id}</span>
                  <span className="pf-seg-body">
                    {seg.prompt && <span className="pf-seg-prompt">{seg.prompt}</span>}
                    <span className="pf-seg-text">
                      <span className="pf-seg-out">{seg.text}</span>
                      <span className="pf-seg-fill" aria-hidden="true">
                        {seg.text}
                      </span>
                    </span>
                  </span>
                  {i >= 0 && (
                    <Hotspot
                      active={lit}
                      label={`Feedback on ${seg.id}`}
                      onClick={() => choose(i)}
                    />
                  )}
                  {lit && <Pill platform={platform} spot={spots[i]} up={i >= 2} />}
                </li>
              );
            })}
            {missingIndex >= 0 && (
              <li className="pf-seg pf-seg--missing" data-lit={active === missingIndex}>
                <span className="pf-seg-id">—</span>
                <span className="pf-seg-body">
                  <span className="pf-seg-missing">Missing evidence: not in your text</span>
                </span>
                <Hotspot
                  active={active === missingIndex}
                  label="Feedback on missing evidence"
                  onClick={() => choose(missingIndex)}
                />
                {active === missingIndex && <Pill platform={platform} spot={spots[missingIndex]} up />}
              </li>
            )}
          </ol>
        </div>

        <div className="pf-hero-foot">
          <div className="pf-info">
            <h1 id="pf-hero-title" className="pf-info-title">
              One identity. Every platform.
            </h1>
            <p className="pf-info-text">
              Paste a profile from LinkedIn, Handshake, Instagram, Facebook, X, Hinge or Tinder. Simulated
              audiences critique it sentence by sentence,
              and the rewrite uses only facts you confirm.
            </p>
            <a href="#catch" className="pf-more">
              See what it won&apos;t write <ArrowDown aria-hidden="true" />
            </a>
            <Link href="/studio" className="pf-button pf-button--cta">
              Start with your profile
            </Link>
          </div>

        </div>
      </section>

      <Catch />

      <section id="facts" className="pf-sheet" aria-labelledby="pf-facts-title">
        <div className="pf-sheet-inner">
          <div className="pf-facts">
            <h2 id="pf-facts-title" className="pf-h2">
              Only what you confirm
            </h2>
            <p className="pf-body">
              The AI suggests facts from your text. They start unticked. You tick the true ones, edit them, or add
              your own, and nothing unticked can support a claim.
            </p>
            <FactList />
          </div>
          <div className="pf-consent">
            <h2 className="pf-h2">Nothing leaves before you agree</h2>
            <p className="pf-body">
              Your text and confirmed facts go to Google through the Gemini API only after you
              say yes, and that includes suggesting facts. The server enforces it too. Personify never stores or logs
              your profile.
            </p>
            <p className="pf-body pf-body--quiet">
              Feedback comes in words: not evident, weak, moderate, strong. No scores, no hireability, no match
              percentages, no predictions.
            </p>
          </div>
        </div>
      </section>

      <Close />
    </div>
  );
}

function Hotspot({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className="pf-hotspot" data-active={active} aria-pressed={active} aria-label={label} onClick={onClick}>
      {active ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
    </button>
  );
}

function Pill({ platform, spot, up }: { platform: Platform; spot: Spot; up: boolean }) {
  const labels = labelFor(platform, spot.audience, spot.trait);
  return (
    <div className="pf-pill" data-up={up} role="note" aria-label={`Simulated feedback from ${labels.audience}`}>
      <div className="pf-pill-head">
        <span>{labels.audience}</span>
        <span>{spot.segmentId ?? "No sentence"}</span>
      </div>
      <div className="pf-pill-rating">
        <span className="pf-pill-trait">{labels.trait}</span>
        <RatingScale rating={spot.rating} />
      </div>
      <p className="pf-pill-text">{spot.rationale}</p>
      <p className="pf-pill-try">
        <strong>Try:</strong> {spot.suggestion}
      </p>
    </div>
  );
}

/** The demo facts as working ticks: unticking one shows it can no longer back a claim. */
function FactList() {
  const [off, setOff] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <ul className="pf-factlist" aria-label="Priya's facts (fictitious demo persona)">
      {DEMO_LINKEDIN_FACTS.map((f) => {
        const on = !off.has(f.id);
        return (
          <li key={f.id} data-on={on}>
            <button type="button" className="pf-tick" aria-pressed={on} onClick={() => toggle(f.id)}>
              {on && <Check aria-hidden="true" />}
              <span className="sr-only">{on ? `Untick ${f.id}` : `Tick ${f.id}`}</span>
            </button>
            <span className="pf-fact-id">{f.id}</span>
            <span className="pf-fact-text">
              {f.text}
              {!on && <span className="pf-fact-off">Unticked: can&apos;t support any claim in a rewrite.</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RatingScale({ rating }: { rating: Rating }) {
  const level = RATING_ORDER.indexOf(rating);
  return (
    <span className="pf-rating">
      <span className="pf-rating-steps" aria-hidden="true">
        {RATING_ORDER.map((r, i) => (
          <span key={r} data-on={i <= level && level > 0} />
        ))}
      </span>
      <span className="pf-rating-word">{RATING_LABEL[rating]}</span>
    </span>
  );
}

/** Reveal once when the element scrolls into view. Visible by default; hidden only when JS can reveal it. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setShown(entry.isIntersecting);
        if (entry.isIntersecting) io.disconnect();
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown] as const;
}

/** Split text so every flagged span can be marked. Whole-word matches only. */
function markFlags(text: string, flags: string[]) {
  const escaped = flags.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![\\w])(${escaped.join("|")})(?![\\w])`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>));
}

function Catch() {
  const [ref, shown] = useReveal<HTMLDivElement>();
  const variation = SAMPLE_ADVERSARIAL_REWRITE.variations[0];
  const warnings = variation.warnings.filter((w) => w.kind !== "unsupported_claim");
  const flags = warnings.filter((w) => w.kind !== "invalid_fact_id").map((w) => w.text);
  const honest = SAMPLE_REWRITE.variations[0].rewrite.content.split("\n")[0];

  return (
    <section id="catch" className="pf-catch" aria-labelledby="pf-catch-title">
      <div className="pf-catch-inner" ref={ref} data-shown={shown}>
        <div className="pf-catch-head">
          <h2 id="pf-catch-title" className="pf-display">
            Made up?
            <br />
            Flagged.
          </h2>
          <p className="pf-body">
            FactCheck is code, not a prompt. It compares every rewrite with your original text and the facts you
            confirmed, then flags what doesn&apos;t trace back to you.
          </p>
        </div>

        <div className="pf-catch-sheet">
          <p className="pf-fabricated">{markFlags(variation.rewrite.content, flags)}</p>
          <ul className="pf-flags">
            {warnings.map((w, i) => (
              <li key={`${w.kind}-${w.text}`} style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="pf-flag-kind">{WARNING_LABEL[w.kind]}</span>
                <span className="pf-flag-text">&ldquo;{w.text}&rdquo;</span>
                <span className="pf-flag-why">{w.explanation}</span>
              </li>
            ))}
          </ul>
          <p className="pf-caption">Intentional test case: a rewrite told to sound more impressive.</p>
        </div>

        <div className="pf-clean">
          <p className="pf-clean-line">{honest}</p>
          <p className="pf-clean-verdict">
            <Check aria-hidden="true" /> No unsupported concrete claims detected
          </p>
          <p className="pf-clean-note">
            Sample result: the grounded rewrite of the same profile. FactCheck catches concrete claims, not every
            subtle exaggeration.
          </p>
        </div>
      </div>
    </section>
  );
}

function Close() {
  const [ref, shown] = useReveal<HTMLDivElement>();
  return (
    <section id="start" className="pf-close" aria-labelledby="pf-close-title">
      <ol className="pf-flow" aria-label="How it works">
        {FLOW.map((step, i) => (
          <li key={step}>
            {step}
            {i < FLOW.length - 1 && <ArrowRight aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <div className="pf-close-type" ref={ref} data-shown={shown}>
        <h2 id="pf-close-title" className="pf-giant">
          <span className="pf-giant-out">Authentically</span>
          <span className="pf-giant-you">
            <span className="pf-giant-out">you.</span>
            <span className="pf-giant-fill" aria-hidden="true">
              you.
            </span>
          </span>
        </h2>
        <div className="pf-close-actions">
          <p className="pf-body">Improve expression, not invent identity.</p>
          <Link href="/studio" className="pf-button pf-button--cta">
            Open the studio <ArrowRight aria-hidden="true" />
          </Link>
          <p className="pf-close-hint">No login. Click &ldquo;Load demo persona&rdquo; in the studio to try Priya&apos;s profile.</p>
        </div>
      </div>
      <footer className="pf-footer">
        <span>Personify</span>
        <span>Simulated AI feedback · Professional, social and dating profiles · Personify stores nothing</span>
      </footer>
    </section>
  );
}
