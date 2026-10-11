"use client";

import { Check, Ruler, ScanSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/Chrome";
import { fitAcross } from "@/lib/fit";
import { LINT_LABEL, lintSegments } from "@/lib/lint";
import type { PlatformGroup, Segment } from "@/lib/schemas";

// The profile step's "Quick check": the deterministic linter and "Where it fits", both run in the
// browser on every keystroke. Nothing is sent, so they work before consent.

const SHOWN = 5;

export function QuickCheck(props: {
  segments: Segment[];
  group: PlatformGroup;
  /** LinkedIn's headline segment id, which should name a role. */
  headlineId?: string;
  /** Text to measure against every platform's limit (a bio, or LinkedIn's About). Omit to hide. */
  fitText?: string;
  /** Show a short live status with the detailed findings expandable. */
  compact?: boolean;
}) {
  const { segments, group, headlineId, fitText, compact = false } = props;
  const [all, setAll] = useState(false);
  const issues = useMemo(() => lintSegments(segments, group, headlineId), [segments, group, headlineId]);
  const fits = useMemo(() => (fitText?.trim() ? fitAcross(fitText) : []), [fitText]);
  const hasText = segments.some((s) => s.text.trim());
  const fittingCount = fits.filter((fit) => fit.fits).length;
  const status = !hasText
    ? "Local checks run as you type"
    : `${issues.length ? `${issues.length} wording ${issues.length === 1 ? "suggestion" : "suggestions"}` : "No wording issues"}${fits.length ? ` · fits ${fittingCount}/${fits.length} platform fields` : ""}`;
  const Container = compact ? "details" : "div";

  return (
    <Container className={`quick-check${compact ? " quick-check-compact" : ""}`}>
      {compact && <summary className="quick-check-summary"><ScanSearch size={15} /><span>{status}</span><span className="quick-check-tag">local · no AI</span></summary>}
      <div className={compact ? "quick-check-expanded" : undefined}>
      <h2 className="section-heading seed-heading">
        <ScanSearch />
        Quick check <span className="quick-check-tag">no AI</span>
      </h2>
      {!hasText ? (
        <p className="section-subtitle">Checks your wording as you type: buzzwords, missing specifics, repeats.</p>
      ) : !issues.length ? (
        <p className="quick-check-clean">
          <Check size={14} aria-hidden="true" />
          No wording issues found.
        </p>
      ) : (
        <>
          <ul className="quick-check-list">
            {(all ? issues : issues.slice(0, SHOWN)).map((issue, i) => (
              <li key={`${issue.kind}-${issue.text}-${i}`}>
                <span className="quick-check-kind">{LINT_LABEL[issue.kind]}</span>
                <span className="quick-check-text">“{issue.text}”</span>
                <span className="quick-check-why">{issue.explanation}</span>
              </li>
            ))}
          </ul>
          {issues.length > SHOWN && (
            <button type="button" className="quick-check-more" onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show all ${issues.length}`}
            </button>
          )}
        </>
      )}

      {fits.length > 0 && (
        <>
          <h3 className="section-heading quick-check-sub">
            <Ruler />
            Where it fits
          </h3>
          <ul className="fit-list">
            {fits.map((f) => (
              <li key={f.platform} data-fits={f.fits}>
                <span className="fit-logo" data-platform={f.platform}>
                  <BrandMark platform={f.platform} />
                </span>
                <span className="fit-name">
                  {f.label} <span className="fit-field">{f.field}</span>
                </span>
                <span className="fit-count">
                  {f.length.toLocaleString()} / {f.limit.toLocaleString()}
                </span>
                {!f.fits && f.cut && (
                  <span className="fit-cut">
                    Cut after “…{f.kept?.slice(-24)}”, losing {[...f.cut].length} characters
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      </div>
    </Container>
  );
}
