"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/schemas";
import { useState } from "react";

export type LinkedInInput = { headline: string; about: string; jobDescription: string };

export function InputStep(props: {
  value: LinkedInInput;
  onChange: (value: LinkedInInput) => void;
  onLoadDemo: () => void;
  usingDemo: boolean;
  onContinue: () => void;
}) {
  const { value, onChange, onLoadDemo, usingDemo, onContinue } = props;
  const [showJob, setShowJob] = useState(Boolean(value.jobDescription));
  const set = (patch: Partial<LinkedInInput>) => onChange({ ...value, ...patch });

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">LinkedIn</span>
        <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground" title="Coming soon">
          Hinge (coming soon)
        </span>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onLoadDemo}>
          Load demo persona
        </Button>
      </div>
      {usingDemo && <p className="text-xs text-muted-foreground">Fictitious demo persona loaded.</p>}

      <div className="space-y-2">
        <Label htmlFor="headline">Headline</Label>
        <input
          id="headline"
          value={value.headline}
          maxLength={300}
          onChange={(e) => set({ headline: e.target.value })}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          placeholder="e.g. Computer science student | Python"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="about">About</Label>
        <Textarea
          id="about"
          value={value.about}
          maxLength={LIMITS.profileText}
          rows={6}
          onChange={(e) => set({ about: e.target.value })}
          placeholder="Paste your LinkedIn About section"
        />
      </div>

      {showJob ? (
        <div className="space-y-2">
          <Label htmlFor="job">Job description (optional)</Label>
          <Textarea
            id="job"
            value={value.jobDescription}
            maxLength={LIMITS.jobDescription}
            rows={4}
            onChange={(e) => set({ jobDescription: e.target.value })}
            placeholder="Paste a real job posting to target"
          />
        </div>
      ) : (
        <Button type="button" variant="link" className="px-0" onClick={() => setShowJob(true)}>
          Target a specific job
        </Button>
      )}

      <Button type="button" onClick={onContinue} disabled={!value.about.trim()}>
        Continue
      </Button>
    </section>
  );
}
