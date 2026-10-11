import { checkRewrite, checkSegmentCitations } from "./fact-guard";
import { LlmError } from "./llm";
import {
  EvaluateResponseSchema,
  LIMITS,
  RewriteSchema,
  RewriteStyleSchema,
  type AudienceCritique,
  type Platform,
  type RewriteStyle,
  type RewriteVariation,
  type EvaluateResponse,
  type GuardWarning,
  type HingeAnswer,
  type IdentityFact,
  type Segment,
} from "./schemas";
import type { z } from "zod";
import type { ModelEvaluateSchema, ModelHingeRewriteSchema, ModelRewriteSchema } from "./schemas";
import { PLATFORM_CONFIGS } from "./rubrics";
import { checkLength, checkStyle } from "./style-check";

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

type VariationDraft = {
  content: string;
  answers?: HingeAnswer[];
  usedFactIds: string[];
  changeSummary: string[];
};

/** Clamp one version, then run FactCheck, the AI-cliche lint, and the platform length check on it. */
function finishVariation(
  style: RewriteStyle,
  platform: Platform,
  draft: VariationDraft,
  extraWarnings: GuardWarning[],
  segments: Segment[],
  confirmedFacts: IdentityFact[],
): RewriteVariation {
  const parsed = RewriteSchema.safeParse({
    platform,
    content: draft.content.trim().slice(0, LIMITS.maxRewriteChars),
    ...(draft.answers ? { answers: draft.answers } : {}),
    usedFactIds: draft.usedFactIds.slice(0, LIMITS.maxFacts),
    changeSummary: draft.changeSummary.slice(0, 8).map((s) => s.slice(0, 300)),
  });
  if (!parsed.success) {
    throw new LlmError("invalid_model_output", "The AI returned an unusable rewrite. Please try again.");
  }
  const config = PLATFORM_CONFIGS[platform];
  // Prompt platforms limit each answer; the others limit the whole text.
  const pieces = parsed.data.answers ? parsed.data.answers.map((a) => a.text) : [parsed.data.content];
  return {
    style,
    rewrite: parsed.data,
    warnings: [...extraWarnings, ...checkRewrite({ rewrite: parsed.data, segments, facts: confirmedFacts })],
    styleWarnings: [...checkStyle(parsed.data.content), ...checkLength(pieces, config.maxChars, config.label)],
  };
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
  return RewriteStyleSchema.options.map((style) =>
    finishVariation(style, platform, model[style], [], segments, confirmedFacts),
  );
}

/**
 * Hinge rewrite: exactly one answer per original segment, in original order. A missing answer
 * keeps the user's original text (and says so); answers for unknown segment ids are dropped and flagged.
 */
export function buildHingeAnswers(
  model: { answers: { segmentId: string; text: string }[] },
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

/** Both versions for a prompt platform (Hinge), each with per-answer cleanup, FactCheck, and the style checks. */
export function buildHingeVariations(
  model: z.infer<typeof ModelHingeRewriteSchema>,
  segments: Segment[],
  confirmedFacts: IdentityFact[],
  platform: Platform = "hinge",
): RewriteVariation[] {
  return RewriteStyleSchema.options.map((style) => {
    const v = model[style];
    const built = buildHingeAnswers(v, segments);
    const draft: VariationDraft = {
      content: built.content,
      answers: built.answers,
      usedFactIds: v.usedFactIds,
      changeSummary: [
        ...built.keptOriginal.map(
          (s) => `Kept your answer to "${s.prompt ?? s.id}" as written (the AI returned no rewrite for it).`,
        ),
        ...v.changeSummary,
      ],
    };
    return finishVariation(style, platform, draft, built.warnings, segments, confirmedFacts);
  });
}
