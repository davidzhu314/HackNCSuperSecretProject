"use client";

import { ArrowRight, ChevronDown, Eye, PenLine, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { critiquesBySection, findDisagreements, missingEvidence, RATING_LEVEL } from "@/lib/clash";
import { profileSectionList, RATING_LABEL } from "@/lib/persona-ui";
import { sectionOfSegment } from "@/lib/profile";
import type { AudienceCritique, EvaluateResponse, LinkedInProfile, PlatformConfig, Segment } from "@/lib/schemas";

// LinkedIn Audience Clash, scan first and read on demand:
// 1. a grid (questions x audiences) of ratings, readable in a few seconds;
// 2. per section, one short line per reaction, expanding to its evidence and what to change.
// Reactions cite segment ids (verified server-side). Hinge keeps the simpler AudienceClash screen.

const keyOf = (c: AudienceCritique) => `${c.audience}|${c.trait}`;

/** One row per audience in a section: its reactions, lowest rating first (that's the one shown). */
function byAudience(critiques: AudienceCritique[], audiences: string[]) {
  return audiences
    .map((audience) => ({
      audience,
      items: critiques
        .filter((c) => c.audience === audience)
        .sort((a, b) => RATING_LEVEL[a.rating] - RATING_LEVEL[b.rating]),
    }))
    .filter((row) => row.items.length);
}

export function ProfileClash(props: {
  response: EvaluateResponse;
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  profile: LinkedInProfile;
  segments: Segment[];
  onRewriteSection: (sectionKey: string) => void;
  onRewrite: () => void;
}) {
  const { response, config, audiences, traits, profile, segments, onRewriteSection, onRewrite } = props;
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const audienceLabel = (id: string) => config.audiences.find((a) => a.id === id)?.label ?? id;
  const question = (id: string) => {
    const t = config.traits.find((x) => x.id === id);
    return t?.question ?? t?.label ?? id;
  };
  const tone = (id: string) => String(Math.max(0, audiences.indexOf(id)));

  const all = useMemo(
    () => response.critiques.filter((c) => audiences.includes(c.audience) && traits.includes(c.trait)),
    [response, audiences, traits],
  );
  const visible = filter ? all.filter((c) => c.audience === filter) : all;
  const cell = (audience: string, trait: string) => all.find((c) => c.audience === audience && c.trait === trait);
  const segmentText = useMemo(() => new Map(segments.map((s) => [s.id, s.text])), [segments]);
  const segmentOrder = useMemo(() => segments.map((s) => s.id), [segments]);
  const disagreements = useMemo(() => findDisagreements(all, segmentOrder), [all, segmentOrder]);
  const bySection = critiquesBySection(visible, sectionOfSegment);
  const missing = missingEvidence(visible);
  const sections = profileSectionList(profile).filter((s) => bySection.has(s.key));
  const invalidSource = response.warnings.some((w) => w.kind === "unverified_segment");
  const gridAudiences = filter ? [filter] : audiences;

  /** Open a reaction's row (its audience in its section) and bring it into view. */
  const reveal = (c: AudienceCritique) => {
    const section = c.segmentIds.length ? sectionOfSegment(c.segmentIds[0]) : null;
    setOpen(section ? `${section}|${c.audience}` : keyOf(c));
    const target = document.getElementById(section ? `clash-${section}` : "clash-missing");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="flow-section fade-in">
      <div className="results-heading">
        <h2 className="flow-title">
          <Eye />
          Audience Clash
        </h2>
        {response.source === "sample" && <span className="sample-badge">Sample result</span>}
      </div>

      {audiences.length > 1 && (
        <div className="clash-filters" role="group" aria-label="Show reactions from">
          <Button variant="trait" data-selected={filter === null} aria-pressed={filter === null} onClick={() => setFilter(null)}>
            All
          </Button>
          {audiences.map((id) => (
            <Button
              key={id}
              variant="trait"
              data-selected={filter === id}
              aria-pressed={filter === id}
              onClick={() => setFilter(filter === id ? null : id)}
            >
              <span className="aud-dot" data-tone={tone(id)} aria-hidden="true" />
              {audienceLabel(id)}
            </Button>
          ))}
        </div>
      )}

      <div className="rating-grid-wrap">
        <table className="rating-grid">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Question</span>
              </th>
              {gridAudiences.map((id) => (
                <th scope="col" key={id}>
                  <span className="aud-dot" data-tone={tone(id)} aria-hidden="true" />
                  {audienceLabel(id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traits.map((t) => (
              <tr key={t}>
                <th scope="row">{question(t)}</th>
                {gridAudiences.map((a) => {
                  const c = cell(a, t);
                  return (
                    <td key={a}>
                      {c ? (
                        <button
                          type="button"
                          className="rating-pill"
                          data-rating={c.rating}
                          title={c.rationale}
                          onClick={() => reveal(c)}
                        >
                          {RATING_LABEL[c.rating]}
                        </button>
                      ) : (
                        <span className="empty-note">–</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {disagreements.length > 0 && (
        <section className="clash-disagree" aria-labelledby="disagree-h">
          <h3 id="disagree-h" className="section-heading">
            Where they disagree
          </h3>
          <ul>
            {disagreements.slice(0, 3).map((d) => (
              <li key={d.segmentId}>
                <button type="button" className="disagree-item" onClick={() => reveal(d.low)}>
                  <q>{segmentText.get(d.segmentId)}</q>
                  <span className="disagree-sides">
                    {[d.high, d.low].map((c) => (
                      <span key={c.audience}>
                        <span className="aud-dot" data-tone={tone(c.audience)} aria-hidden="true" />
                        {audienceLabel(c.audience)}{" "}
                        <span className="rating-pill" data-rating={c.rating}>
                          {RATING_LABEL[c.rating]}
                        </span>
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invalidSource && (
        <p className="warning-notice">
          <TriangleAlert size={15} />
          The AI cited text that doesn&apos;t exist; it was ignored.
        </p>
      )}

      <div className="clash-sections">
        {sections.map((s) => {
          const sectionSegments = segments.filter((x) => sectionOfSegment(x.id) === s.key);
          return (
            <section key={s.key} id={`clash-${s.key}`} className="clash-section" aria-label={s.label}>
              <div className="annotated-head">
                <h3 className="section-heading">{s.label}</h3>
                {s.rewritable && (
                  <Button variant="link" size="sm" onClick={() => onRewriteSection(s.key)}>
                    <PenLine />
                    Rewrite
                  </Button>
                )}
              </div>
              <ul className="reaction-rows">
                {byAudience(bySection.get(s.key) ?? [], audiences).map(({ audience, items }) => {
                  const rowKey = `${s.key}|${audience}`;
                  const isOpen = open === rowKey;
                  const first = items[0];
                  return (
                    <li key={rowKey} data-open={isOpen}>
                      <button
                        type="button"
                        className="reaction-row"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : rowKey)}
                      >
                        <span className="aud-dot" data-tone={tone(audience)} aria-hidden="true" />
                        <span className="reaction-who">{audienceLabel(audience)}</span>
                        <span className="rating-pill" data-rating={first.rating}>
                          {RATING_LABEL[first.rating]}
                        </span>
                        <span className="reaction-line">{first.rationale}</span>
                        {items.length > 1 && <span className="reaction-more">+{items.length - 1} more</span>}
                        <ChevronDown className="reaction-chevron" size={15} aria-hidden="true" />
                      </button>
                      {isOpen && (
                        <div className="reaction-detail">
                          {items.map((c) => (
                            <div className="reaction-item" key={keyOf(c)}>
                              <p className="reaction-question">
                                {question(c.trait)}{" "}
                                <span className="rating-pill" data-rating={c.rating}>
                                  {RATING_LABEL[c.rating]}
                                </span>
                              </p>
                              {c !== first && <p>{c.rationale}</p>}
                              <p className="reaction-evidence">
                                {c.segmentIds.map((id) => (
                                  <q key={id}>{segmentText.get(id)}</q>
                                ))}
                              </p>
                              {c.suggestion && (
                                <p className="reaction-change">
                                  <strong>Change:</strong> {c.suggestion}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <details className="section-text">
                <summary>Show text</summary>
                <p>{sectionSegments.map((x) => x.text).join(" ")}</p>
              </details>
            </section>
          );
        })}
      </div>

      {missing.length > 0 && (
        <section className="clash-missing" id="clash-missing" aria-labelledby="missing-h">
          <h3 id="missing-h" className="section-heading">
            <Search />
            Nobody could find
          </h3>
          <ul>
            {missing.map((c) => (
              <li key={keyOf(c)} data-open={open === keyOf(c)}>
                <span className="aud-dot" data-tone={tone(c.audience)} aria-hidden="true" />
                <span>
                  <strong>{question(c.trait)}</strong> {audienceLabel(c.audience)}
                  {c.suggestion ? `: ${c.suggestion}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!visible.length && <p className="empty-note">No feedback came back for this selection. Go back and try again.</p>}

      <div className="action-band">
        <span />
        <Button variant="aero" onClick={onRewrite}>
          Rewrite sections <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
