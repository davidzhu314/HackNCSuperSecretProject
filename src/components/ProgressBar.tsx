"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { pacedProgress } from "@/lib/progress";

// Progress bar for AI calls. Drive it with the same `loading` flag as the button: it starts when
// `active` turns true, eases toward 95% while waiting (see lib/progress.ts), and when `active` turns
// false (response or error) fills to 100% and fades out. Colors come from the platform theme on
// .app-root (--brand-*), or from `accent` when passed.

type Phase = "idle" | "running" | "finishing";

const TICK_MS = 200;
/** Fill to 100% (300ms width transition), then fade (250ms). Keep in sync with .ai-progress CSS. */
const FINISH_MS = 600;

function useProgress(active: boolean, expectedMs: number) {
  const [prevActive, setPrevActive] = useState(active);
  const [phase, setPhase] = useState<Phase>(active ? "running" : "idle");
  const [value, setValue] = useState(0);

  // Adjust state while rendering when `active` flips (React's pattern for reacting to a prop change).
  if (active !== prevActive) {
    setPrevActive(active);
    if (active) {
      setPhase("running");
      setValue(0);
    } else if (phase === "running") {
      setPhase("finishing");
      setValue(100);
    }
  }

  useEffect(() => {
    if (phase === "running") {
      const start = performance.now();
      const id = window.setInterval(() => setValue(pacedProgress(performance.now() - start, expectedMs)), TICK_MS);
      return () => window.clearInterval(id);
    }
    if (phase === "finishing") {
      const id = window.setTimeout(() => setPhase("idle"), FINISH_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase, expectedMs]);

  return { phase, value };
}

export function ProgressBar(props: {
  /** True while the request is in flight. */
  active: boolean;
  /** Status text shown above the bar, e.g. "Writing two versions…". Also the bar's accessible name. */
  label: string;
  /** How long this request usually takes. The bar reaches ~85% at this point, then slows. */
  expectedMs: number;
  /** Override the platform color, e.g. "#0A66C2". By default the bar uses the page's --brand-* theme. */
  accent?: string;
  className?: string;
}) {
  const { active, label, expectedMs, accent, className } = props;
  const { phase, value } = useProgress(active, expectedMs);
  const labelId = useId();
  if (phase === "idle") return null;

  const now = Math.round(value);
  const style = accent ? ({ "--progress-accent": accent, "--progress-fill": accent } as CSSProperties) : undefined;
  return (
    <div className={cn("ai-progress", className)} data-phase={phase} style={style}>
      <p className="ai-progress-label" id={labelId} key={label}>
        {phase === "finishing" ? "Done" : label}
      </p>
      <div
        className="ai-progress-track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
        // The percentage is an estimate; say so to screen readers rather than present it as measured.
        aria-valuetext={phase === "finishing" ? "Done" : "Working"}
      >
        <div className="ai-progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
