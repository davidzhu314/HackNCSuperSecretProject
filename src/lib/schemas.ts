import { z } from "zod";

// Contract shared by UI, API routes, LLM client, and FactCheck.
// Every request and response crossing a boundary is validated against these.

export const LIMITS = {
  /** A whole profile, counted with profileCharCount (LinkedIn) or headline + About (legacy flow). */
  profileText: 10_000,
  jobDescription: 6000,
  factText: 300,
  maxFacts: 12,
  maxSegments: 250,
  segmentText: 600,
  maxAudiences: 3,
  maxTraits: 6,
  maxCritiques: 40,
  maxRewriteChars: 3000,
  /** LinkedIn's own field caps. */
  headlineChars: 220,
  sectionText: 2600,
  entryField: 200,
  maxEntries: 15,
  maxListItems: 50,
  listItem: 120,
  /** Per-section rewrite output caps, by section type. */
  sectionRewriteChars: { headline: 220, about: 2600, entry: 2000 },
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
  "ai_cliche",
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

// ---------- LinkedIn profile by sections ----------

export const LinkedInSectionKindSchema = z.enum(["headline", "about", "experience", "education", "projects", "volunteering"]);
export type LinkedInSectionKind = z.infer<typeof LinkedInSectionKindSchema>;
export type EntrySectionKind = Exclude<LinkedInSectionKind, "headline" | "about">;

/** Entry id prefix per section; ids look like "exp1", "edu2", "proj1", "vol1". */
export const ENTRY_ID_PREFIX: Record<EntrySectionKind, string> = {
  experience: "exp",
  education: "edu",
  projects: "proj",
  volunteering: "vol",
};
export const ENTRY_KINDS = Object.keys(ENTRY_ID_PREFIX) as EntrySectionKind[];

export const ProfileEntrySchema = z.object({
  id: z.string().regex(/^(exp|edu|proj|vol)\d{1,3}$/),
  /** Role / degree / project name. Kept verbatim, never rewritten. */
  title: z.string().max(LIMITS.entryField),
  /** Company / school. Kept verbatim, never rewritten. */
  organization: z.string().max(LIMITS.entryField),
  /** Verbatim, e.g. "July 2026 - Present (4 months)". */
  dates: z.string().max(100).optional(),
  /** Verbatim. Never sent to the AI. */
  location: z.string().max(LIMITS.entryField).optional(),
  /** The only rewritable part. Bullets keep their "-" lines. */
  description: z.string().max(LIMITS.sectionText),
});
export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;

const entries = z.array(ProfileEntrySchema).max(LIMITS.maxEntries);
const listItems = z.array(z.string().max(LIMITS.listItem)).max(LIMITS.maxListItems);

const LinkedInProfileFieldsSchema = z.object({
  headline: z.string().max(LIMITS.headlineChars),
  about: z.string().max(LIMITS.sectionText),
  experience: entries,
  education: entries,
  projects: entries,
  volunteering: entries,
  skills: listItems,
  honors: listItems,
});
export type LinkedInProfile = z.infer<typeof LinkedInProfileFieldsSchema>;

/** Characters that count toward LIMITS.profileText. Locations don't count: they are never sent. */
export function profileCharCount(p: LinkedInProfile): number {
  const entryChars = ENTRY_KINDS.flatMap((k) => p[k]).reduce(
    (n, e) => n + e.title.length + e.organization.length + (e.dates?.length ?? 0) + e.description.length,
    0,
  );
  return (
    p.headline.length +
    p.about.length +
    entryChars +
    [...p.skills, ...p.honors].reduce((n, x) => n + x.length, 0)
  );
}

/** Name, email, URLs, and the person's location are stripped at parse time and never stored. */
export const LinkedInProfileSchema = LinkedInProfileFieldsSchema
  .refine((p) => profileCharCount(p) <= LIMITS.profileText, {
    message: `Profile must be at most ${LIMITS.profileText} characters.`,
  })
  .refine(
    (p) => {
      const ids = ENTRY_KINDS.flatMap((k) => p[k].map((e) => e.id));
      return new Set(ids).size === ids.length;
    },
    { message: "Entry ids must be unique." },
  );

/** One rewritable piece of a profile: the headline, About, or one entry's description. */
export const RewritableSectionSchema = z.object({
  /** "headline" | "about" | an entry id ("exp2"). */
  key: z.string().min(1).max(8),
  kind: LinkedInSectionKindSchema,
  /** e.g. "Experience · Acme Labs · Machine Learning Intern". */
  label: z.string().max(500),
  text: z.string().min(1).max(LIMITS.sectionText),
});
export type RewritableSection = z.infer<typeof RewritableSectionSchema>;

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

/** Two voices from the same confirmed facts. */
export const RewriteStyleSchema = z.enum(["direct", "narrative"]);
export type RewriteStyle = z.infer<typeof RewriteStyleSchema>;

export const RewriteVariationSchema = z.object({
  style: RewriteStyleSchema,
  rewrite: RewriteSchema,
  /** Output of deterministic FactCheck. Empty means "no unsupported concrete claims detected". */
  warnings: z.array(GuardWarningSchema),
  /** Banned AI-cliche words/phrases found (kind "ai_cliche"). Style only; separate from FactCheck. */
  styleWarnings: z.array(GuardWarningSchema),
});
export type RewriteVariation = z.infer<typeof RewriteVariationSchema>;

export const RewriteResponseSchema = z.object({
  source: ResultSourceSchema,
  variations: z.array(RewriteVariationSchema).min(1).max(2),
});
export type RewriteResponse = z.infer<typeof RewriteResponseSchema>;

// ---------- API: POST /api/rewrite-section (LinkedIn) ----------

/** Section rewrite styles (LinkedIn and future professional platforms). Hinge keeps RewriteStyle. */
export const SectionStyleSchema = z.enum(["direct", "narrative", "professional"]);
export type SectionStyle = z.infer<typeof SectionStyleSchema>;

/** Length slider stops, relative to the original section (see LENGTH_STEPS in styles.ts). */
export const LengthStepSchema = z.enum(["much_shorter", "shorter", "same", "longer", "much_longer"]);
export type LengthStep = z.infer<typeof LengthStepSchema>;

export const RewriteSectionRequestSchema = z.object({
  consent: z.literal(true),
  platform: z.literal("linkedin"),
  /** The server looks up section.key in `profile` and rewrites the profile's copy of that text. */
  section: RewritableSectionSchema,
  profile: LinkedInProfileSchema,
  /** Only confirmed facts are accepted. */
  facts: z.array(IdentityFactSchema.extend({ confirmed: z.literal(true) })).max(LIMITS.maxFacts),
  style: SectionStyleSchema,
  /** Optional; "same" keeps about the original's length. */
  length: LengthStepSchema.default("same"),
  audiences: z.array(z.string().min(1).max(60)).max(LIMITS.maxAudiences),
  goal: z.string().max(300).optional(),
  jobDescription: z.string().max(LIMITS.jobDescription).optional(),
});
export type RewriteSectionRequest = z.input<typeof RewriteSectionRequestSchema>;

export const RewriteSectionResponseSchema = z.object({
  source: ResultSourceSchema,
  sectionKey: z.string().min(1).max(8),
  style: SectionStyleSchema,
  length: LengthStepSchema,
  /** Character counts: the original section, the length the slider asked for, and what came back. */
  chars: z.object({ original: z.number().int().min(0), target: z.number().int().min(0), actual: z.number().int().min(0) }),
  rewrite: RewriteSchema,
  /** Deterministic FactCheck against this section's corpus. Empty means "no unsupported concrete claims detected". */
  warnings: z.array(GuardWarningSchema),
  /** AI-cliche lint. Style only; separate from FactCheck. */
  styleWarnings: z.array(GuardWarningSchema),
});
export type RewriteSectionResponse = z.infer<typeof RewriteSectionResponseSchema>;

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
  /** LinkedIn only: lens categories, in display order. */
  categories?: { id: string; label: string }[];
  /**
   * `category` is a categories[].id (LinkedIn only). `description` is the full lens definition the
   * model reads; `summary` is a one-line version for the picker (falls back to `description`).
   */
  audiences: { id: string; label: string; description: string; summary?: string; category?: string }[];
  /** `question` is the plain-language label, e.g. "Can they tell what you do?" (LinkedIn only). */
  traits: { id: string; label: string; description: string; question?: string }[];
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

const ModelRewriteVariantSchema = z.object({
  content: z.string(),
  usedFactIds: z.array(z.string()),
  changeSummary: z.array(z.string()),
});

/** Fixed keys (not an array) so strict JSON-schema mode guarantees exactly one of each. */
export const ModelRewriteSchema = z.object({
  direct: ModelRewriteVariantSchema,
  narrative: ModelRewriteVariantSchema,
});

/** LinkedIn by sections: one section, one style per call. */
export const ModelSectionRewriteSchema = ModelRewriteVariantSchema;

/** Hinge: each variant returns one answer per original answer, keyed by segment id. */
const ModelHingeRewriteVariantSchema = z.object({
  answers: z.array(z.object({ segmentId: z.string(), text: z.string() })),
  usedFactIds: z.array(z.string()),
  changeSummary: z.array(z.string()),
});

export const ModelHingeRewriteSchema = z.object({
  direct: ModelHingeRewriteVariantSchema,
  narrative: ModelHingeRewriteVariantSchema,
});
