"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LIMITS, type PlatformConfig } from "@/lib/schemas";

function toggle(list: string[], id: string, max: number) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return list.length >= max ? list : [...list, id];
}

export function AudiencePicker(props: {
  config: PlatformConfig;
  audiences: string[];
  traits: string[];
  onChange: (sel: { audiences: string[]; traits: string[] }) => void;
  onContinue: () => void;
}) {
  const { config, audiences, traits, onChange, onContinue } = props;
  const maxTraits = Math.min(5, LIMITS.maxTraits);

  return (
    <section className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">Simulated audiences (pick 1-{LIMITS.maxAudiences})</legend>
        {config.audiences.map((a) => (
          <label key={a.id} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={audiences.includes(a.id)}
              onCheckedChange={() => onChange({ audiences: toggle(audiences, a.id, LIMITS.maxAudiences), traits })}
            />
            <span>
              <span className="font-medium">{a.label}</span>
              <span className="block text-muted-foreground">{a.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-lg font-semibold">Traits to evaluate (pick 1-{maxTraits})</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {config.traits.map((t) => (
            <label key={t.id} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={traits.includes(t.id)}
                onCheckedChange={() => onChange({ audiences, traits: toggle(traits, t.id, maxTraits) })}
              />
              <span>
                <span className="font-medium">{t.label}</span>
                <span className="block text-muted-foreground">{t.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="button" onClick={onContinue} disabled={!audiences.length || !traits.length}>
        Get feedback
      </Button>
    </section>
  );
}
