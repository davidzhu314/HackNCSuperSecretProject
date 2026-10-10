import { checkSegmentCitations } from "./fact-guard";
import { LlmError } from "./llm";
import {
  EvaluateResponseSchema,
  LIMITS,
  type AudienceCritique,
  type EvaluateResponse,
  type GuardWarning,
  type HingeAnswer,
  type IdentityFact,
  type Segment,
} from "./schemas";
import type { z } from "zod";
import type { ModelEvaluateSchema, ModelHingeRewriteSchema } from "./schemas";

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
 * Hinge rewrite: exactly one answer per original segment, in original order. A missing answer
 * keeps the user's original text (and says so); answers for unknown segment ids are dropped and flagged.
 */
export function buildHingeAnswers(
  model: Pick<z.infer<typeof ModelHingeRewriteSchema>, "answers">,
  segments: Segment[],
): { answers: HingeAnswer[]; content: string; warnings: GuardWarning[]; keptOriginal: Segment[] } {
  const byId = new Map<string, string>();
  for (const a of model.answers) {
    const text = a.text.trim().slice(0, LIMITS.segmentText);
    if (text && !byId.has(a.segmentId)) byId.set(a.segmentId, text);
  }
  const warnings = checkSegmentCitations([...byId.keys()], segments);
  const keptOriginal: Segment[] = [];
  const answers = segments.map((seg) => {
    const text = byId.get(seg.id);
    if (!text) keptOriginal.push(seg);
    return { segmentId: seg.id, ...(seg.prompt ? { prompt: seg.prompt } : {}), text: text ?? seg.text };
  });
  return { answers, content: answers.map((a) => a.text).join("\n\n"), warnings, keptOriginal };
}
