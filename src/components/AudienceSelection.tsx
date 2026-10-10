"use client";

import { Check, Eye, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LIMITS, type PlatformConfig } from "@/lib/schemas";

const toggle = (ids: string[], id: string, max: number) =>
  ids.includes(id) ? ids.filter((item) => item !== id) : ids.length < max ? [...ids, id] : ids;

export function AudienceSelection(props: {
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  loading: boolean;
  onAudiences: (ids: string[]) => void;
  onTraits: (ids: string[]) => void;
  onFeedback: () => void;
}) {
  const { config, audiences, traits, loading, onAudiences, onTraits, onFeedback } = props;
  const maxTraits = Math.min(config.traits.length, LIMITS.maxTraits);
  return (
    <section className="flow-section fade-in">
      <h2 className="flow-title">
        <Eye /> Choose your audience lens
      </h2>
      <p className="flow-description">
        Who is your profile for?
      </p>
      <div className="selection-grid">
        <div>
          <h3 className="section-heading">
            Through whose eyes?{" "}
            <span className="selection-count">
              {audiences.length} / {LIMITS.maxAudiences}
            </span>
          </h3>
          <div className="audience-options">
            {config.audiences.map((option) => (
              <Button
                variant="glass"
                className="audience-option"
                data-selected={audiences.includes(option.id)}
                aria-pressed={audiences.includes(option.id)}
                key={option.id}
                disabled={loading}
                title={option.description}
                onClick={() => onAudiences(toggle(audiences, option.id, LIMITS.maxAudiences))}
              >
                <Eye />
                <span>{option.label}</span>
                {audiences.includes(option.id) && <Check />}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="section-heading">
            What should they look for?{" "}
            <span className="selection-count">
              {traits.length} / {maxTraits}
            </span>
          </h3>
          <div className="trait-options mt-4">
            {config.traits.map((option) => (
              <Button
                variant="trait"
                key={option.id}
                data-selected={traits.includes(option.id)}
                aria-pressed={traits.includes(option.id)}
                disabled={loading}
                title={option.description}
                onClick={() => onTraits(toggle(traits, option.id, maxTraits))}
              >
                {traits.includes(option.id) && <Check />}
                {option.label}
              </Button>
            ))}
          </div>
          <p className="empty-note">
            Pick up to {LIMITS.maxAudiences} audiences and up to {maxTraits} traits.
          </p>
        </div>
      </div>
      <div className="action-band">
        <span className="empty-note" />
        <Button variant="aero" disabled={!audiences.length || !traits.length || loading} onClick={onFeedback}>
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {loading ? "Getting feedback..." : "Get feedback"}
        </Button>
      </div>
      {loading && (
        <div className="loading-skeleton" role="status" aria-live="polite">
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}
