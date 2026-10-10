"use client";

import { Button } from "@/components/ui/button";
import { RatingBadge, SourceBadge } from "@/components/labels";
import type { AudienceCritique, EvaluateResponse, PlatformConfig, Segment } from "@/lib/schemas";
import { useState } from "react";

const key = (c: Pick<AudienceCritique, "audience" | "trait">) => `${c.audience}|${c.trait}`;

export function AudienceClash(props: {
  result: EvaluateResponse;
  segments: Segment[];
  config: PlatformConfig;
  audienceIds: string[];
  traitIds: string[];
  onRewrite: () => void;
}) {
  const { result, segments, config, audienceIds, traitIds, onRewrite } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const byKey = new Map(result.critiques.map((c) => [key(c), c]));
  const active = selected ? byKey.get(selected) : undefined;
  const label = (list: { id: string; label: string }[], id: string) => list.find((x) => x.id === id)?.label ?? id;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Audience Clash</h2>
        <span className="text-xs text-muted-foreground">Simulated AI feedback</span>
        <SourceBadge source={result.source} />
      </div>

      {result.warnings.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          The AI cited text that doesn&apos;t exist ({result.warnings.map((w) => w.text).join(", ")}); it was ignored.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left font-medium">Audience</th>
              {traitIds.map((t) => (
                <th key={t} className="p-2 text-left font-medium">{label(config.traits, t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audienceIds.map((a) => (
              <tr key={a} className="border-t">
                <th scope="row" className="p-2 text-left font-normal">{label(config.audiences, a)}</th>
                {traitIds.map((t) => {
                  const c = byKey.get(`${a}|${t}`);
                  return (
                    <td key={t} className="p-2">
                      {c ? (
                        <button
                          type="button"
                          onClick={() => setSelected(key(c))}
                          aria-pressed={selected === key(c)}
                          className={`rounded-md p-0.5 ${selected === key(c) ? "ring-2 ring-ring" : ""}`}
                        >
                          <RatingBadge rating={c.rating} />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No result</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-3">
        <h3 className="mb-2 text-sm font-medium">Your text</h3>
        {active?.missingEvidence && (
          <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
            Missing evidence: nothing in your text supports this yet.
          </p>
        )}
        <ol className="space-y-1 text-sm">
          {segments.map((s) => {
            const hit = active?.segmentIds.includes(s.id);
            return (
              <li key={s.id} className={`rounded px-1 ${hit ? "bg-yellow-200 dark:bg-yellow-800/60" : ""}`}>
                <span className="mr-1 text-xs text-muted-foreground">{s.id}</span>
                {s.text}
              </li>
            );
          })}
        </ol>
      </div>

      <ul className="space-y-2">
        {result.critiques.map((c) => (
          <li key={key(c)}>
            <button
              type="button"
              onClick={() => setSelected(key(c))}
              className={`w-full rounded-lg border p-3 text-left text-sm ${selected === key(c) ? "ring-2 ring-ring" : ""}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium">{label(config.audiences, c.audience)}</span>
                <span className="text-muted-foreground">· {label(config.traits, c.trait)}</span>
                <RatingBadge rating={c.rating} />
              </div>
              <p>{c.rationale}</p>
              {c.suggestion && <p className="mt-1 text-muted-foreground">Try: {c.suggestion}</p>}
            </button>
          </li>
        ))}
      </ul>

      <Button type="button" onClick={onRewrite}>Rewrite my profile</Button>
    </section>
  );
}
