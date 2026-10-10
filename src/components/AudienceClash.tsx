"use client";

import { ArrowRight, Eye, FileText, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RATING_LABEL } from "@/lib/persona-ui";
import type { AudienceCritique, EvaluateResponse, PlatformConfig, Segment } from "@/lib/schemas";

export function AudienceClash(props: {
  response: EvaluateResponse;
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  segments: Segment[];
  onRewrite: () => void;
}) {
  const { response, config, audiences, traits, segments, onRewrite } = props;
  const [selected, setSelected] = useState<AudienceCritique | null>(null);
  const label = (id: string, kind: "audiences" | "traits") => config[kind].find((option) => option.id === id)?.label ?? id;
  const critiques = response.critiques.filter((item) => audiences.includes(item.audience) && traits.includes(item.trait));
  // The server already dropped unknown ids; this filter is a second guard so nothing unverified is highlighted.
  const highlighted = selected?.missingEvidence
    ? []
    : (selected?.segmentIds.filter((id) => segments.some((segment) => segment.id === id)) ?? []);
  const invalidSource = response.warnings.some((warning) => warning.kind === "unverified_segment");

  return (
    <section className="flow-section fade-in">
      <div className="results-heading">
        <h2 className="flow-title">
          <Eye />
          Audience Clash
        </h2>
        {response.source === "sample" && <span className="sample-badge">Sample result</span>}
      </div>
      <p className="feedback-label">Simulated AI feedback</p>
      <p className="flow-description">
        Different lenses. Different impressions. These viewpoints are simulated, not real people reviewing you, and
        they don&apos;t predict how anyone will respond.
      </p>
      <div className="matrix-scroll">
        <table className="feedback-matrix">
          <caption className="sr-only">Audience and trait feedback matrix</caption>
          <thead>
            <tr>
              <th scope="col">Audience lens</th>
              {traits.map((id) => (
                <th scope="col" key={id}>
                  {label(id, "traits")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audiences.map((audience) => (
              <tr key={audience}>
                <th scope="row">{label(audience, "audiences")}</th>
                {traits.map((trait) => {
                  const critique = critiques.find((item) => item.audience === audience && item.trait === trait);
                  return (
                    <td key={trait}>
                      {critique ? (
                        <Button
                          variant="rating"
                          data-rating={critique.rating}
                          aria-label={`${label(audience, "audiences")}, ${label(trait, "traits")}: ${RATING_LABEL[critique.rating]}`}
                          onClick={() => setSelected(critique)}
                        >
                          {RATING_LABEL[critique.rating]}
                        </Button>
                      ) : (
                        <span className="unrated">No feedback</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {invalidSource && (
        <p className="warning-notice">
          <TriangleAlert size={15} />
          The AI cited text that doesn&apos;t exist; it was ignored.
        </p>
      )}
      <div className="clash-grid">
        <div className="insight-list">
          {critiques.map((critique) => (
            <Button
              variant="critique"
              className="insight-item"
              data-selected={selected === critique}
              key={`${critique.audience}|${critique.trait}`}
              onClick={() => setSelected(critique)}
            >
              <span className="insight-head">
                <span>{label(critique.audience, "audiences")}</span>
                <span className="rating-pill" data-rating={critique.rating}>
                  {RATING_LABEL[critique.rating]}
                </span>
              </span>
              <span className="critique-trait">{label(critique.trait, "traits")}</span>
              <span className="critique-copy">{critique.rationale}</span>
              <span className="critique-suggestion">{critique.suggestion}</span>
              {critique.missingEvidence && (
                <span className="missing-evidence">Missing evidence: nothing in your text supports this yet</span>
              )}
            </Button>
          ))}
          {!critiques.length && (
            <p className="empty-note">No feedback came back for this combination. Go back and try again.</p>
          )}
        </div>
        <aside className="source-panel">
          <h3 className="section-heading">
            <FileText />
            Your source text
          </h3>
          {selected?.missingEvidence && (
            <p className="missing-evidence" role="status">
              Missing evidence: nothing in your text supports this yet
            </p>
          )}
          {segments.map((segment) => (
            <div className="source-segment" data-highlighted={highlighted.includes(segment.id)} key={segment.id}>
              <span>{segment.id}</span>
              <p>
                {segment.prompt && <strong className="source-prompt">{segment.prompt}</strong>}
                {segment.text}
              </p>
            </div>
          ))}
        </aside>
      </div>
      <div className="action-band">
        <span className="empty-note">Every point stays tied to your words.</span>
        <Button variant="aero" onClick={onRewrite}>
          Rewrite my profile <ArrowRight />
        </Button>
      </div>
    </section>
  );
}
