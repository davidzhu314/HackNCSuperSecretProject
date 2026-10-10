"use client";

import { ArrowRight, Eye, PenLine, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { critiquesBySection, findDisagreements, missingEvidence } from "@/lib/clash";
import { profileSectionList, RATING_LABEL } from "@/lib/persona-ui";
import { sectionOfSegment } from "@/lib/profile";
import type { AudienceCritique, EvaluateResponse, LinkedInProfile, PlatformConfig, Rating, Segment } from "@/lib/schemas";

// LinkedIn Audience Clash: the profile itself, annotated. Each audience's reactions sit on the
// sentences they cite (segment ids, verified server-side), with what to change and a jump to
// that section's rewrite. Hinge keeps the simpler AudienceClash screen.

const RATINGS: Rating[] = ["strong", "moderate", "weak", "not_evident"];

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
  const [selected, setSelected] = useState<AudienceCritique | null>(null);

  const audienceLabel = (id: string) => config.audiences.find((a) => a.id === id)?.label ?? id;
  const question = (id: string) => {
    const t = config.traits.find((x) => x.id === id);
    return t?.question ?? t?.label ?? id;
  };
  const tone = (id: string) => String(Math.max(0, audiences.indexOf(id)));

  const all = response.critiques.filter((c) => audiences.includes(c.audience) && traits.includes(c.trait));
  const visible = filter ? all.filter((c) => c.audience === filter) : all;
  const segmentText = useMemo(() => new Map(segments.map((s) => [s.id, s.text])), [segments]);
  const segmentOrder = useMemo(() => segments.map((s) => s.id), [segments]);
  const disagreements = useMemo(() => findDisagreements(all, segmentOrder), [all, segmentOrder]);
  const bySection = critiquesBySection(visible, sectionOfSegment);
  const missing = missingEvidence(visible);
  const sections = profileSectionList(profile);
  // A reaction's card sits under the first section it cites; other sections it cites still show,
  // highlighted, with a link to that card.
  const anchorOf = (c: AudienceCritique) => sectionOfSegment(c.segmentIds[0]);
  const citedElsewhere = (key: string) =>
    visible.filter((c) => !c.missingEvidence && anchorOf(c) !== key && c.segmentIds.some((id) => sectionOfSegment(id) === key));
  const shown = sections.filter((s) => bySection.has(s.key) || citedElsewhere(s.key).length);
  const quiet = sections.filter((s) => !shown.includes(s));
  const cited = new Set(visible.flatMap((c) => c.segmentIds));
  const focused = new Set(selected && !selected.missingEvidence ? selected.segmentIds : []);
  const invalidSource = response.warnings.some((w) => w.kind === "unverified_segment");

  const jumpTo = (segmentId: string) => {
    const key = sectionOfSegment(segmentId);
    if (key) document.getElementById(`clash-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <p className="flow-description">
        Your profile with each audience’s reactions attached to the sentences they’re about.
      </p>

      <div className="clash-filters" role="group" aria-label="Show reactions from">
        <Button variant="trait" data-selected={filter === null} aria-pressed={filter === null} onClick={() => setFilter(null)}>
          All audiences
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

      <div className="clash-summary">
        {audiences.map((id) => {
          const mine = all.filter((c) => c.audience === id);
          return (
            <div key={id} className="clash-summary-row">
              <span className="aud-dot" data-tone={tone(id)} aria-hidden="true" />
              <strong>{audienceLabel(id)}</strong>
              <span className="empty-note">
                {RATINGS.map((r) => ({ r, n: mine.filter((c) => c.rating === r).length }))
                  .filter((x) => x.n)
                  .map((x) => `${x.n} ${RATING_LABEL[x.r].toLowerCase()}`)
                  .join(" · ") || "no feedback"}
              </span>
            </div>
          );
        })}
      </div>

      {disagreements.length > 0 && (
        <section className="clash-disagree" aria-labelledby="disagree-h">
          <h3 id="disagree-h" className="section-heading">
            Where they disagree
          </h3>
          <ul>
            {disagreements.slice(0, 4).map((d) => (
              <li key={d.segmentId}>
                <button type="button" className="disagree-item" onClick={() => jumpTo(d.segmentId)}>
                  <q>{segmentText.get(d.segmentId)}</q>
                  <span className="disagree-sides">
                    <span>
                      <span className="aud-dot" data-tone={tone(d.high.audience)} aria-hidden="true" />
                      {audienceLabel(d.high.audience)}:{" "}
                      <span className="rating-pill" data-rating={d.high.rating}>
                        {RATING_LABEL[d.high.rating]}
                      </span>
                    </span>
                    <span>
                      <span className="aud-dot" data-tone={tone(d.low.audience)} aria-hidden="true" />
                      {audienceLabel(d.low.audience)}:{" "}
                      <span className="rating-pill" data-rating={d.low.rating}>
                        {RATING_LABEL[d.low.rating]}
                      </span>
                    </span>
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

      <div className="annotated">
        {shown.map((s) => {
            const sectionSegments = segments.filter((x) => sectionOfSegment(x.id) === s.key);
            return (
              <section key={s.key} id={`clash-${s.key}`} className="annotated-section" aria-label={s.label}>
                <div className="annotated-head">
                  <h3 className="section-heading">{s.label}</h3>
                  {s.rewritable && (
                    <Button variant="link" size="sm" onClick={() => onRewriteSection(s.key)}>
                      <PenLine />
                      Rewrite this section
                    </Button>
                  )}
                </div>
                <div className="annotated-text">
                  {sectionSegments.map((x) => (
                    <span key={x.id} data-cited={cited.has(x.id)} data-focused={focused.has(x.id)}>
                      {x.text}{" "}
                    </span>
                  ))}
                </div>
                {citedElsewhere(s.key).length > 0 && (
                  <p className="cited-elsewhere">
                    Also cited by:{" "}
                    {citedElsewhere(s.key).map((c) => (
                      <button
                        type="button"
                        key={`${c.audience}|${c.trait}`}
                        className="cited-link"
                        onClick={() => {
                          setSelected(c);
                          jumpTo(c.segmentIds[0]);
                        }}
                      >
                        <span className="aud-dot" data-tone={tone(c.audience)} aria-hidden="true" />
                        {audienceLabel(c.audience)} · {question(c.trait)}
                      </button>
                    ))}
                  </p>
                )}
                <div className="reaction-list">
                  {(bySection.get(s.key) ?? []).map((c) => (
                    <button
                      type="button"
                      key={`${c.audience}|${c.trait}`}
                      className="reaction-card"
                      data-tone={tone(c.audience)}
                      data-selected={selected === c}
                      aria-pressed={selected === c}
                      onClick={() => setSelected(selected === c ? null : c)}
                    >
                      <span className="reaction-head">
                        <span className="aud-dot" data-tone={tone(c.audience)} aria-hidden="true" />
                        <strong>{audienceLabel(c.audience)}</strong>
                        <span className="rating-pill" data-rating={c.rating}>
                          {RATING_LABEL[c.rating]}
                        </span>
                      </span>
                      <span className="reaction-question">{question(c.trait)}</span>
                      <span className="reaction-text">{c.rationale}</span>
                      <span className="reaction-evidence">
                        Evidence:{" "}
                        {c.segmentIds.map((id) => (
                          <q key={id}>{segmentText.get(id)}</q>
                        ))}
                      </span>
                      {c.suggestion && (
                        <span className="reaction-change">
                          <strong>What to change:</strong> {c.suggestion}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        {quiet.length > 0 && (
          <p className="empty-note">No reactions on: {quiet.map((s) => s.label).join(", ")}.</p>
        )}
      </div>

      {missing.length > 0 && (
        <section className="clash-missing" aria-labelledby="missing-h">
          <h3 id="missing-h" className="section-heading">
            <Search />
            Nobody could find
          </h3>
          <ul>
            {missing.map((c) => (
              <li key={`${c.audience}|${c.trait}`}>
                <span className="aud-dot" data-tone={tone(c.audience)} aria-hidden="true" />
                <span>
                  <strong>{question(c.trait)}</strong> ({audienceLabel(c.audience)}) {c.suggestion}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!visible.length && <p className="empty-note">No feedback came back for this selection. Go back and try again.</p>}

      <div className="action-band">
        <span className="empty-note">Click a reaction to highlight its evidence.</span>
        <Button variant="aero" onClick={onRewrite}>
          Rewrite sections <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
