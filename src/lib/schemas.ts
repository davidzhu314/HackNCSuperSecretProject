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
  maxAudiences: 8,
  /** Questions the user types on the lens screen, besides the built-in ones. */
  maxCustomQuestions: 3,
  customQuestion: 120,
  maxTraits: 6,
  /** 8 lenses x (5 built-in + 3 custom questions). */
  maxCritiques: 64,
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
  /** Tinder: About me is Tinder's 500. Prompt count and answer length are assumed (copied from Hinge). */
  tinderAbout: 500,
  maxTinderPrompts: 3,
  tinderAnswer: 300,
  /** Free-text Tinder fields (job title, company, school, city). */
  tinderField: 100,
  maxLanguages: 10,
} as const;

export const PlatformSchema = z.enum(["linkedin", "handshake", "instagram", "facebook", "hinge", "tinder"]);
export type Platform = z.infer<typeof PlatformSchema>;

/** The three groups platforms are shown in. The group drives prompt rules and theming. */
export const PlatformGroupSchema = z.enum(["professional", "social", "dating"]);
export type PlatformGroup = z.infer<typeof PlatformGroupSchema>;

/**
 * How the profile is entered: sections = LinkedIn's sectioned profile; prompts = prompt question +
 * answer pairs (Hinge); bio = one short text field (Handshake, Instagram, Facebook); tinder = About
 * me, prompt answers, and profile fields (TinderProfile).
 */
export type InputShape = "sections" | "prompts" | "bio" | "tinder";

/** Input split into numbered pieces server-side. The model cites ids, never quotes. */
export const SegmentSchema = z.object({
  id: z.string().min(1).max(16), // e.g. "s1"
  text: z.string().min(1).max(LIMITS.segmentText),
  /** Prompt platforms (Hinge) only: the prompt question this answer responds to. */
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
  /** LinkedIn: headline, blank line, About. Bio platforms: the bio. Hinge: the answers joined by blank lines, in original order. */
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
  "over_limit",
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
  /** From the PDF's Languages sidebar, names only. Not part of any LinkedIn rewrite; Tinder carries it over. */
  languages: z.array(z.string().max(LIMITS.listItem)).max(LIMITS.maxLanguages).optional(),
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

// ---------- Tinder: About me, prompt answers, and profile fields ----------

/**
 * Profile field options, stored as their labels. Taken from Tinder's app as best known (unverified;
 * Tinder changes them), except Going out, which is a neutral list. The user picks every value; the
 * AI never fills, infers, or sees them (only TINDER_AI_FIELDS in tinder.ts reach a rewrite).
 */
export const TINDER_OPTIONS = {
  openTo: ["Long-term partner", "Long-term, open to short", "Short-term, open to long", "Short-term fun", "New friends", "Still figuring it out"],
  relationshipType: ["Monogamy", "Ethical non-monogamy", "Open relationship", "Polyamory", "Open to exploring"],
  zodiac: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"],
  educationLevel: ["High school", "Trade school", "In college", "Bachelor's", "In grad school", "Master's", "PhD"],
  children: ["I want children", "I don't want children", "I have children and want more", "I have children and don't want more", "Not sure yet"],
  communicationStyle: ["Big-time texter", "Phone caller", "Video chatter", "Bad texter", "Better in person"],
  loveStyle: ["Thoughtful gestures", "Presents", "Touch", "Compliments", "Time together"],
  pets: ["Dog", "Cat", "Reptile", "Amphibian", "Bird", "Fish", "Turtle", "Hamster", "Rabbit", "Other", "Don't have but love", "Pet-free", "All the pets", "Want a pet", "Allergic to pets"],
  drinking: ["Not for me", "Sober", "Sober curious", "On special occasions", "Socially on weekends", "Most nights"],
  smoking: ["Non-smoker", "Social smoker", "Smoker when drinking", "Smoker", "Trying to quit"],
  cannabis: ["Yes", "Occasionally", "Socially", "Never"],
  workout: ["Every day", "Often", "Sometimes", "Never"],
  socialMedia: ["Influencer status", "Socially active", "Passive scroller", "Off the grid"],
  goingOut: ["Most weekends", "Now and then", "Rarely", "Staying in"],
} as const;
export type TinderChoiceField = keyof typeof TINDER_OPTIONS;

const one = <T extends readonly [string, ...string[]]>(options: T) => z.enum(options).nullable();
const many = <T extends readonly [string, ...string[]]>(options: T) => z.array(z.enum(options)).max(options.length);
const freeText = z.string().max(LIMITS.tinderField);

/** null (or an empty list) means left blank: nothing is shown for it. */
export const TinderFieldsSchema = z.object({
  // Work & education: typed or carried over from LinkedIn. The only fields a rewrite may use.
  jobTitle: freeText,
  company: freeText,
  school: freeText,
  languages: z.array(z.string().trim().min(1).max(LIMITS.listItem)).max(LIMITS.maxLanguages),
  // Location: never sent.
  livingIn: freeText,
  // Everything below is never sent.
  openTo: one(TINDER_OPTIONS.openTo),
  relationshipType: many(TINDER_OPTIONS.relationshipType),
  zodiac: one(TINDER_OPTIONS.zodiac),
  educationLevel: one(TINDER_OPTIONS.educationLevel),
  children: one(TINDER_OPTIONS.children),
  communicationStyle: one(TINDER_OPTIONS.communicationStyle),
  loveStyle: one(TINDER_OPTIONS.loveStyle),
  pets: many(TINDER_OPTIONS.pets),
  drinking: one(TINDER_OPTIONS.drinking),
  smoking: one(TINDER_OPTIONS.smoking),
  cannabis: one(TINDER_OPTIONS.cannabis),
  workout: one(TINDER_OPTIONS.workout),
  socialMedia: one(TINDER_OPTIONS.socialMedia),
  goingOut: one(TINDER_OPTIONS.goingOut),
});
export type TinderFields = z.infer<typeof TinderFieldsSchema>;

export const TinderPromptSchema = z.object({
  prompt: z.string().min(1).max(200),
  answer: z.string().max(LIMITS.tinderAnswer),
});
export type TinderPrompt = z.infer<typeof TinderPromptSchema>;

export const TinderProfileSchema = z.object({
  about: z.string().max(LIMITS.tinderAbout),
  prompts: z.array(TinderPromptSchema).max(LIMITS.maxTinderPrompts),
  fields: TinderFieldsSchema,
});
export type TinderProfile = z.infer<typeof TinderProfileSchema>;

/**
 * A Tinder profile field the user typed (job title, company, school, languages), sent with a rewrite
 * as source text: the rewrite may mention it, and FactCheck counts it as the user's own words.
 */
export const FieldFactSchema = z.object({
  id: z.string().regex(/^p[1-9]$/),
  field: z.enum(["jobTitle", "company", "school", "languages"]),
  text: z.string().min(1).max(LIMITS.factText),
});
export type FieldFact = z.infer<typeof FieldFactSchema>;

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

// ---------- API: POST /api/facts/verify (Lie Checker) ----------
// Checks one fact for consistency with the user's own profile and other facts. It can't know what's
// true: "consistent" means nothing contradicts it, never "verified true".

export const FactVerdictSchema = z.enum(["consistent", "not_mentioned", "exaggerated", "contradicts"]);
export type FactVerdict = z.infer<typeof FactVerdictSchema>;

const FactRefSchema = IdentityFactSchema.pick({ id: true, text: true });

export const VerifyFactRequestSchema = z.object({
  consent: z.literal(true),
  platform: PlatformSchema,
  fact: FactRefSchema,
  /** May be empty: a fact can be checked against the other facts alone. */
  segments: z.array(SegmentSchema).max(LIMITS.maxSegments),
  otherFacts: z.array(FactRefSchema).max(LIMITS.maxFacts),
});
export type VerifyFactRequest = z.infer<typeof VerifyFactRequestSchema>;

export const VerifyFactResponseSchema = z.object({
  source: ResultSourceSchema,
  verdict: FactVerdictSchema,
  reason: z.string().max(500),
  /** How to make the fact match the user's own words. Empty unless the verdict is a flag. */
  suggestion: z.string().max(300),
  /** Cited profile segments or facts, resolved server-side. Quotes never come from the model. */
  evidence: z.array(z.object({ id: z.string(), text: z.string() })),
  /** Cited ids that don't exist (dropped from `evidence`). */
  warnings: z.array(GuardWarningSchema),
});
export type VerifyFactResponse = z.infer<typeof VerifyFactResponseSchema>;

// ---------- API: POST /api/evaluate ----------

/** A question the user typed ("Can they tell I lead teams?"). Untrusted text; critiques cite its id. */
export const CustomQuestionSchema = z.object({
  id: z.string().regex(/^q[1-9]$/),
  text: z.string().trim().min(1).max(LIMITS.customQuestion),
});
export type CustomQuestion = z.infer<typeof CustomQuestionSchema>;

export const EvaluateRequestSchema = z
  .object({
    consent: z.literal(true),
    platform: PlatformSchema,
    segments: z.array(SegmentSchema).min(1).max(LIMITS.maxSegments),
    audiences: z.array(z.string().min(1).max(60)).min(1).max(LIMITS.maxAudiences),
    traits: z.array(z.string().min(1).max(60)).max(LIMITS.maxTraits),
    customQuestions: z.array(CustomQuestionSchema).max(LIMITS.maxCustomQuestions).optional(),
    jobDescription: z.string().max(LIMITS.jobDescription).optional(),
  })
  .refine((r) => r.traits.length + (r.customQuestions?.length ?? 0) > 0, {
    message: "Choose at least one question.",
    path: ["traits"],
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
  /** Tinder only: the profile fields a rewrite may mention. Location and lifestyle answers have no slot here. */
  fieldFacts: z.array(FieldFactSchema).max(4).optional(),
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
  /** Banned AI-cliche words/phrases (kind "ai_cliche") and platform length overruns (kind "over_limit"). Style only; separate from FactCheck. */
  styleWarnings: z.array(GuardWarningSchema),
});
export type RewriteVariation = z.infer<typeof RewriteVariationSchema>;

export const RewriteResponseSchema = z.object({
  source: ResultSourceSchema,
  variations: z.array(RewriteVariationSchema).min(1).max(2),
});
export type RewriteResponse = z.infer<typeof RewriteResponseSchema>;

// ---------- API: POST /api/draft (fill a platform from the user's other profiles) ----------

/** One empty spot to draft: an About, a headline, a bio, or one prompt's answer. */
export const DraftSlotSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,15}$/),
  label: z.string().min(1).max(60),
  /** Prompt platforms: the question this answer responds to. */
  prompt: z.string().max(200).optional(),
  maxChars: z.number().int().min(20).max(LIMITS.sectionText),
});
export type DraftSlot = z.infer<typeof DraftSlotSchema>;

export const DraftRequestSchema = z.object({
  consent: z.literal(true),
  /** The platform being filled. */
  platform: PlatformSchema,
  /** The user's text on their platforms (draftSources in autofill.ts). The only material a draft may use. */
  sources: z.array(SegmentSchema).min(1).max(LIMITS.maxSegments),
  facts: z.array(IdentityFactSchema.extend({ confirmed: z.literal(true) })).max(LIMITS.maxFacts),
  fieldFacts: z.array(FieldFactSchema).max(4).optional(),
  slots: z.array(DraftSlotSchema).min(1).max(6),
});
export type DraftRequest = z.infer<typeof DraftRequestSchema>;

export const DraftSchema = z.object({
  slotId: z.string().max(16),
  text: z.string().max(LIMITS.sectionText),
  /** Sentences FactCheck couldn't trace to the sources, removed before the draft is shown. */
  dropped: z.array(z.string().max(LIMITS.segmentText)).max(20),
  /** FactCheck on the kept text (normally empty), and the AI-cliche lint. */
  warnings: z.array(GuardWarningSchema),
  styleWarnings: z.array(GuardWarningSchema),
});
export type Draft = z.infer<typeof DraftSchema>;

export const DraftResponseSchema = z.object({
  source: ResultSourceSchema,
  drafts: z.array(DraftSchema).max(6),
});
export type DraftResponse = z.infer<typeof DraftResponseSchema>;

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

// ---------- Platform config (one engine, one config per platform) ----------

export type PlatformConfig = {
  id: Platform;
  label: string;
  group: PlatformGroup;
  input: InputShape;
  /** The platform's name for the profile field, e.g. "About", "Bio", "Summary". */
  fieldLabel: string;
  /**
   * The platform's own character limit for the profile text (per answer for prompts). Rewrites
   * over it get an "over_limit" style warning. Undefined = no single limit (LinkedIn's are per section).
   */
  maxChars?: number;
  /** Professional platforms accept an optional job description to target. */
  jobDescription: boolean;
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

export const ModelVerifyFactSchema = z.object({
  verdict: FactVerdictSchema,
  sourceIds: z.array(z.string()),
  reason: z.string(),
  suggestion: z.string(),
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

export const ModelDraftSchema = z.object({
  drafts: z.array(z.object({ slotId: z.string(), text: z.string() })),
});

export const ModelHingeRewriteSchema = z.object({
  direct: ModelHingeRewriteVariantSchema,
  narrative: ModelHingeRewriteVariantSchema,
});
