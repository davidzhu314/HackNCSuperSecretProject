"use client";

import { Check, Eye, FileText, Fingerprint, LockKeyhole, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

// The studio's step rail: the Lovable "hotspots" as a row of pearls over the scenery.
// Steps ahead of the furthest one reached are locked.

const ICONS = [FileText, LockKeyhole, Fingerprint, Users, Eye, Sparkles];

export function TourStops(props: {
  steps: string[];
  step: number;
  furthest: number;
  disabled: boolean;
  onSelect: (step: number) => void;
}) {
  const { steps, step, furthest, disabled, onSelect } = props;
  return (
    <nav className="tour-stops" aria-label="Profile workflow">
      <ol>
        {steps.map((label, index) => {
          const Icon = ICONS[index] ?? FileText;
          const locked = index > furthest;
          return (
            <li key={label} className="tour-stop" data-active={index === step} data-done={index < step} data-locked={locked}>
              <Button
                variant="hotspot"
                size="icon"
                aria-label={`${index + 1}. ${label}${locked ? " (locked)" : ""}`}
                aria-current={index === step ? "step" : undefined}
                disabled={locked || disabled}
                onClick={() => onSelect(index)}
              >
                {index < step ? <Check /> : <Icon />}
                <span className="hotspot-orbit" aria-hidden="true" />
              </Button>
              <span className="hotspot-caption" aria-hidden="true">
                <span>{String(index + 1).padStart(2, "0")}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
