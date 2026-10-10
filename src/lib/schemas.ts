import { z } from "zod";

// Contract shared by UI, API routes, LLM client, and FactCheck.
// Every request and response crossing a boundary is validated against these.

export const LIMITS = {
  profileText: 4000,
  jobDescription: 6000,
  factText: 300,
  maxFacts: 12,
  maxSegments: 40,
  segmentText: 600,
  maxAudiences: 3,
  maxTraits: 6,
  maxCritiques: 24,
  maxRewriteChars: 3000,
} as const;

export const PlatformSchema = z.enum(["linkedin", "hinge"]);
export type Platform = z.infer<typeof PlatformSchema>;

/** Input split into numbered pieces server-side. The model cites ids, never quotes. */
export const SegmentSchema = z.object({
  id: z.string().min(1).max(16), // e.g. "s1"
  text: z.string().min(1).max(LIMITS.segmentText),
  /** Hinge only: the prompt question this answer responds to. */
  prompt: z.string().max(200).optional(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const IdentityFactSchema = z.object({
  id: z.string().min(1).max(16), // e.g. "f1"
  text: z.string().min(1).max(LIMITS.factText),
  confirmed: z.boolean(),
  source: z.enum(["extracted", "user"]),
});
export type IdentityFact = z.infer<typeof IdentityFactSchema>;

export const RatingSchema = z.enum(["not_evident", "weak", "moderate", "strong"]);
export type Rating = z.infer<typeof RatingSchema>;

export const AudienceCritiqueSchema = z.object({
  audience: z.string().min(1).max(60),
  trait: z.string().min(1).max(60),
  rating: RatingSchema,
  segmentIds: z.array(z.string().max(16)).max(8),
  missingEvidence: z.boolean(),
  rationale: z.string().min(1).max(500),
  suggestion: z.string().max(500),
});
export type AudienceCritique = z.infer<typeof AudienceCritiqueSchema>;

/** Hinge: one rewritten answer per original answer, keyed by the original segment id. */
export const HingeAnswerSchema = z.object({
  segmentId: z.string().min(1).max(16),
  prompt: z.string().max(200).optional(),
  text: z.string().min(1).max(LIMITS.segmentText),
});
export type HingeAnswer = z.infer<typeof HingeAnswerSchema>;

export const RewriteSchema = z.object({
  platform: PlatformSchema,
  /** LinkedIn: headline, blank line, About. Hinge: the answers joined by blank lines, in original order. */
  content: z.string().min(1).max(LIMITS.maxRewriteChars),
  /** Hinge only: the same answers as `content`, one per original segment, in order. */
  answers: z.array(HingeAnswerSchema).max(LIMITS.maxSegments).optional(),
  /** Advisory only. FactCheck never trusts this. */
  usedFactIds: z.array(z.string().max(16)).max(LIMITS.maxFacts),
  changeSummary: z.array(z.string().max(300)).max(8),
});
export type Rewrite = z.infer<typeof RewriteSchema>;

export const GuardWarningKindSchema = z.enum([
  "unsupported_number",
  "unsupported_entity",
  "inflated_verb",
  "invalid_fact_id",
  "unsupported_claim",
  "unverified_segment",
]);
export type GuardWarningKind = z.infer<typeof GuardWarningKindSchema>;

export const GuardWarningSchema = z.object({
  kind: GuardWarningKindSchema,
  text: z.string().max(500),
  explanation: z.string().max(500),
});
export type GuardWarning = z.infer<typeof GuardWarningSchema>;

/** "live" = produced by a real model call now; "sample" = cached demo data. UI must label sample. */
export const ResultSourceSchema = z.enum(["live", "sample"]);
export type ResultSource = z.infer<typeof ResultSourceSchema>;

// ---------- API: POST /api/facts/extract ----------

export const ExtractFactsRequestSchema = z.object({
  consent: z.literal(true),
  platform: PlatformSchema,
  segments: z.array(SegmentSchema).min(1).max(LIMITS.maxSegments),
});
export type ExtractFactsRequest = z.infer<typeof ExtractFactsRequestSchema>;

/** Candidates are never confirmed; the user ticks them. */
export const ExtractFactsResponseSchema = z.object({
  source: ResultSourceSchema,
  facts: z.array(IdentityFactSchema.extend({ confirmed: z.literal(false) })).max(LIMITS.maxFacts),
});
export type ExtractFactsResponse = z.infer<typeof ExtractFactsResponseSchema>;

// ---------- API: POST /api/evaluate ----------

export const EvaluateRequestSchema = z.object({
  consent: z.literal(true),
  platform: PlatformSchema,
  segments: z.array(SegmentSchema).min(1).max(LIMITS.maxSegments),
  audiences: z.array(z.string().min(1).max(60)).min(1).max(LIMITS.maxAudiences),
  traits: z.array(z.string().min(1).max(60)).min(1).max(LIMITS.maxTraits),
  jobDescription: z.string().max(LIMITS.jobDescription).optional(),
});
export type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

export const EvaluateResponseSchema = z.object({
  source: ResultSourceSchema,
  critiques: z.array(AudienceCritiqueSchema).max(LIMITS.maxCritiques),
  /** Segment ids the model cited that don't exist; flagged, never highlighted. */
  warnings: z.array(GuardWarningSchema),
});
export type EvaluateResponse = z.infer<typeof EvaluateResponseSchema>;

// ---------- API: POST /api/rewrite ----------

export const RewriteToneSchema = z.enum(["closer_to_my_words", "balanced", "more_playful"]);
export type RewriteTone = z.infer<typeof RewriteToneSchema>;

export const RewriteRequestSchema = z.object({
  consent: z.literal(true),
  platform: PlatformSchema,
  segments: z.array(SegmentSchema).min(1).max(LIMITS.maxSegments),
  /** Only confirmed facts are accepted; the route rejects anything else. */
  facts: z.array(IdentityFactSchema.extend({ confirmed: z.literal(true) })).max(LIMITS.maxFacts),
  audiences: z.array(z.string().min(1).max(60)).max(LIMITS.maxAudiences),
  goal: z.string().max(300).optional(),
  tone: RewriteToneSchema.default("balanced"),
  jobDescription: z.string().max(LIMITS.jobDescription).optional(),
});
export type RewriteRequest = z.infer<typeof RewriteRequestSchema>;

export const RewriteResponseSchema = z.object({
  source: ResultSourceSchema,
  rewrite: RewriteSchema,
  /** Output of deterministic FactCheck. Empty means "no unsupported concrete claims detected". */
  warnings: z.array(GuardWarningSchema),
});
export type RewriteResponse = z.infer<typeof RewriteResponseSchema>;

// ---------- Errors ----------

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "invalid_request",
      "consent_required",
      "missing_api_key",
      "rate_limited",
      "invalid_model_output",
      "upstream_error",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------- Platform config (one engine, two configs) ----------

export type PlatformConfig = {
  id: Platform;
  label: string;
  audiences: { id: string; label: string; description: string }[];
  traits: { id: string; label: string; description: string }[];
};

// ---------- What the model returns (before server-side checks) ----------
// Kept free of length bounds because strict JSON-schema mode doesn't support every keyword.
// Server code validates and clamps against the bounded schemas above afterwards.

export const ModelExtractSchema = z.object({
  facts: z.array(z.string()),
});

export const ModelEvaluateSchema = z.object({
  critiques: z.array(
    z.object({
      audience: z.string(),
      trait: z.string(),
      rating: RatingSchema,
      segmentIds: z.array(z.string()),
      missingEvidence: z.boolean(),
      rationale: z.string(),
      suggestion: z.string(),
    }),
  ),
});

export const ModelRewriteSchema = z.object({
  content: z.string(),
  usedFactIds: z.array(z.string()),
  changeSummary: z.array(z.string()),
});

export const ModelHingeRewriteSchema = z.object({
  answers: z.array(z.object({ segmentId: z.string(), text: z.string() })),
  usedFactIds: z.array(z.string()),
  changeSummary: z.array(z.string()),
});
