"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function ConsentStep(props: {
  sampleMode: boolean;
  onSampleModeChange: (on: boolean) => void;
  canUseSample: boolean;
  onAgree: () => void;
  onBack: () => void;
}) {
  const { sampleMode, onSampleModeChange, canUseSample, onAgree, onBack } = props;
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Before we send anything</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Your pasted text and the facts you confirm are sent to <strong>OpenRouter</strong> and the underlying AI model provider to generate feedback and rewrites.</li>
        <li>We don&apos;t save your profile. Nothing is stored after you close the page.</li>
        <li>All feedback is simulated AI feedback, not the opinion of real recruiters or employers.</li>
      </ul>

      {canUseSample && (
        <div className="flex items-start gap-2 rounded-lg border p-3">
          <Checkbox id="sample" checked={sampleMode} onCheckedChange={(c) => onSampleModeChange(c === true)} />
          <Label htmlFor="sample" className="text-sm font-normal leading-snug">
            Use sample results instead (nothing is sent to the AI; results are labeled &quot;Sample result&quot;)
          </Label>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={onAgree}>I agree, continue</Button>
        <Button type="button" variant="outline" onClick={onBack}>Go back</Button>
      </div>
    </section>
  );
}
