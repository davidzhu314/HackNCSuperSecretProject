"use client";

import { Check, Eye, FileText, LockKeyhole, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

// The studio's step rail: the Lovable "hotspots" as a row of pearls over the scenery.
// Steps ahead of the furthest one reached are locked.

const ICONS = [FileText, LockKeyhole, Users, Eye, Sparkles];

export function TourStops(props: {
  /** Labels of every step, indexed by step number. */
  steps: string[];
  /** The step numbers to show, in order. */
  order?: number[];
  step: number;
  furthest: number;
  disabled: boolean;
  onSelect: (step: number) => void;
}) {
  const { steps, step, furthest, disabled, onSelect } = props;
  const order = props.order ?? steps.map((_, i) => i);
  return (
    <nav className="tour-stops" aria-label="Profile workflow">
      <ol>
        {order.map((index, position) => {
          const label = steps[index];
          const Icon = ICONS[index] ?? FileText;
          const locked = index > furthest;
          return (
            <li key={label} className="tour-stop" data-active={index === step} data-done={index < step} data-locked={locked}>
              <Button
                variant="hotspot"
                size="icon"
                aria-label={`${position + 1}. ${label}${locked ? " (locked)" : ""}`}
                aria-current={index === step ? "step" : undefined}
                disabled={locked || disabled}
                onClick={() => onSelect(index)}
              >
                {index < step ? <Check /> : <Icon />}
                <span className="hotspot-orbit" aria-hidden="true" />
              </Button>
              <span className="hotspot-caption" aria-hidden="true">
                <span>{String(position + 1).padStart(2, "0")}</span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
