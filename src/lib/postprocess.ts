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
  type LengthStep,
  type RewritableSection,
  type SectionStyle,
  type RewriteSectionResponse,
  RewriteSectionResponseSchema,
} from "./schemas";
import type { z } from "zod";
import type { ModelEvaluateSchema, ModelHingeRewriteSchema, ModelRewriteSchema, ModelSectionRewriteSchema } from "./schemas";
import { splitSentences } from "./segments";
import { PLATFORM_CONFIGS } from "./rubrics";
import { checkLength, checkStyle } from "./style-check";
import { countBullets, sectionCap, targetChars } from "./styles";

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

/** Clamp one version, then run FactCheck and the AI-cliche lint on it. */
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
  // Prompt platforms limit each answer; bio platforms limit the whole text.
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

/** Both Hinge versions, each with per-answer cleanup, FactCheck, and the AI-cliche lint. */
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

// ---------- LinkedIn by sections ----------


/** Cut at a word boundary so LinkedIn accepts it; the caller says so in changeSummary. */
function cutToCap(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const cut = text.slice(0, cap);
  const boundary = cut.lastIndexOf(" ");
  return (boundary > cap * 0.8 ? cut.slice(0, boundary) : cut).trim();
}

/**
 * One section rewrite: normalize its format, keep it within LinkedIn's limit, then run
 * FactCheck against `factCheckSegments` (the section's own corpus) and the cliche lint.
 * More bullets than the original is flagged for review: a new bullet is usually a new claim.
 */
export function buildSectionRewrite(
  model: z.infer<typeof ModelSectionRewriteSchema>,
  args: {
    section: RewritableSection;
    style: SectionStyle;
    length?: LengthStep;
    segments: Segment[];
    facts: IdentityFact[];
  },
): RewriteSectionResponse {
  const { section, style, length = "same", segments, facts } = args;
  const notes: string[] = [];
  let content = model.content.trim();
  if (section.kind === "headline") content = content.replace(/\s*\n+\s*/g, " | ").replace(/\s+/g, " ");
  else content = content.replace(/^[ \t]*[•·*–][ \t]+/gm, "- ").replace(/\n{3,}/g, "\n\n");

  // The original had bullets but the model returned plain lines or one paragraph: restore
  // bullets, one per line, or one per sentence for a paragraph. The words are unchanged.
  if (section.kind !== "headline" && countBullets(section.text) > 0 && countBullets(content) === 0) {
    const lines = content.split("\n").filter((l) => l.trim());
    const pieces = lines.length > 1 ? lines : splitSentences(content);
    if (pieces.length > 1) {
      content = pieces.map((l) => `- ${l.trim()}`).join("\n");
      notes.push("Restored your bullet format.");
    }
  }

  const cap = sectionCap(section.kind);
  if (content.length > cap) {
    content = cutToCap(content, cap);
    notes.push(`Cut to LinkedIn's ${cap.toLocaleString("en-US")}-character limit; check the ending.`);
  }
  if (!content) throw new LlmError("invalid_model_output", "The AI returned an empty rewrite. Please try again.");

  const rewrite = RewriteSchema.safeParse({
    platform: "linkedin",
    content,
    usedFactIds: model.usedFactIds.slice(0, LIMITS.maxFacts),
    changeSummary: [...notes, ...model.changeSummary].slice(0, 8).map((s) => s.slice(0, 300)),
  });
  if (!rewrite.success) throw new LlmError("invalid_model_output", "The AI returned an unusable rewrite. Please try again.");

  const extra: GuardWarning[] = [];
  const before = countBullets(section.text);
  const after = countBullets(content);
  if (before > 0 && after > before) {
    extra.push({
      kind: "unsupported_claim",
      text: `${after} bullets (your original has ${before})`,
      explanation: "This version adds bullets. Check that none of them describes something you didn't do.",
    });
  }

  const out = RewriteSectionResponseSchema.safeParse({
    source: "live",
    sectionKey: section.key,
    style,
    length,
    chars: { original: section.text.length, target: targetChars(section.kind, section.text.length, length), actual: content.length },
    rewrite: rewrite.data,
    warnings: [...extra, ...checkRewrite({ rewrite: rewrite.data, segments, facts })],
    styleWarnings: checkStyle(content),
  });
  if (!out.success) throw new LlmError("invalid_model_output", "The AI returned an unusable rewrite. Please try again.");
  return out.data;
}

/** Combine per-lens evaluations: critiques in the given audience order, warnings deduplicated. */
export function mergeEvaluations(parts: EvaluateResponse[], audienceOrder: string[]): EvaluateResponse {
  const rank = (id: string) => {
    const i = audienceOrder.indexOf(id);
    return i < 0 ? audienceOrder.length : i;
  };
  const critiques = parts.flatMap((p) => p.critiques).sort((a, b) => rank(a.audience) - rank(b.audience));
  const seen = new Set<string>();
  const warnings = parts
    .flatMap((p) => p.warnings)
    .filter((w) => {
      const key = `${w.kind}|${w.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return EvaluateResponseSchema.parse({ source: "live", critiques: critiques.slice(0, LIMITS.maxCritiques), warnings });
}
