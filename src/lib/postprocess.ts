import { checkRewrite, checkSegmentCitations } from "./fact-guard";
import { LlmError } from "./llm";
import {
  EvaluateResponseSchema,
  LIMITS,
  RewriteSchema,
  RewriteStyleSchema,
  type AudienceCritique,
  type Platform,
  type RewriteVariation,
  type EvaluateResponse,
  type GuardWarning,
  type IdentityFact,
  type Segment,
} from "./schemas";
import type { z } from "zod";
import type { ModelEvaluateSchema, ModelRewriteSchema } from "./schemas";
import { checkStyle } from "./style-check";

// Server-side cleanup of model output. The model is never trusted: ids are checked,
// strings are clamped, and unrequested audience/trait combinations are dropped.

/** Candidate facts: trimmed, deduped, never confirmed. */
export function buildCandidateFacts(raw: string[]): (IdentityFact & { confirmed: false })[] {
  const seen = new Set<string>();
  const out: (IdentityFact & { confirmed: false })[] = [];
  for (const text of raw) {
    const t = text.trim().slice(0, LIMITS.factText);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push({ id: `f${out.length + 1}`, text: t, confirmed: false, source: "extracted" });
    if (out.length >= LIMITS.maxFacts) break;
  }
  return out;
}

export function buildCritiques(
  model: z.infer<typeof ModelEvaluateSchema>,
  requested: { audienceIds: string[]; traitIds: string[] },
  segments: Segment[],
): EvaluateResponse {
  const warnings: GuardWarning[] = [];
  const seen = new Set<string>();
  const critiques: AudienceCritique[] = [];
  const known = new Set(segments.map((s) => s.id));

  for (const c of model.critiques) {
    if (!requested.audienceIds.includes(c.audience) || !requested.traitIds.includes(c.trait)) continue;
    const key = `${c.audience}|${c.trait}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cited = [...new Set(c.segmentIds)];
    warnings.push(...checkSegmentCitations(cited, segments));
    const segmentIds = cited.filter((id) => known.has(id)).slice(0, 8);
    // No verified evidence means missing evidence, whatever the model claimed.
    const missingEvidence = segmentIds.length === 0;

    critiques.push({
      audience: c.audience,
      trait: c.trait,
      rating: c.rating,
      segmentIds,
      missingEvidence,
      rationale: c.rationale.trim().slice(0, 500) || "No rationale given.",
      suggestion: c.suggestion.trim().slice(0, 500),
    });
  }

  const parsed = EvaluateResponseSchema.safeParse({ source: "live", critiques, warnings });
  if (!parsed.success) throw new LlmError("invalid_model_output", "The AI returned an unusable evaluation. Please try again.");
  return parsed.data;
}

/**
 * Clamp each model version, then run FactCheck (against the original text and confirmed
 * facts only) and the AI-cliche lint on it. The model's usedFactIds are never trusted.
 */
export function buildVariations(
  model: z.infer<typeof ModelRewriteSchema>,
  platform: Platform,
  segments: Segment[],
  confirmedFacts: IdentityFact[],
): RewriteVariation[] {
  return RewriteStyleSchema.options.map((style) => {
    const v = model[style];
    const parsed = RewriteSchema.safeParse({
      platform,
      content: v.content.trim().slice(0, LIMITS.maxRewriteChars),
      usedFactIds: v.usedFactIds.slice(0, LIMITS.maxFacts),
      changeSummary: v.changeSummary.slice(0, 8).map((s) => s.slice(0, 300)),
    });
    if (!parsed.success) {
      throw new LlmError("invalid_model_output", "The AI returned an unusable rewrite. Please try again.");
    }
    return {
      style,
      rewrite: parsed.data,
      warnings: checkRewrite({ rewrite: parsed.data, segments, facts: confirmedFacts }),
      styleWarnings: checkStyle(parsed.data.content),
    };
  });
}
