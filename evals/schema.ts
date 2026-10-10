import { z } from "zod";
import { PlatformSchema, type IdentityFact, type Segment } from "../src/lib/schemas";
import { segmentHinge, segmentLinkedIn } from "../src/lib/segments";

// Eval cases: a profile plus the ground truth needed to grade model output.
// Cases hold RAW input (headline/about or prompt/answer pairs), not segments, so they
// always go through the same segmenter production uses.

export const EvalTagSchema = z.enum([
  "average",
  "sparse", // very little text; models are tempted to pad
  "numbers_heavy", // stresses unsupported_number
  "already_good", // the right critique is mostly "leave it alone"
  "awkward", // non-native English, wrong register for the platform, rambling
]);
export type EvalTag = z.infer<typeof EvalTagSchema>;

/**
 * A plausible invention a rewrite must NOT make.
 * `expect` says which FactCheck warning should catch it if it appears verbatim,
 * or "semantic" when only the LLM judge / a human can catch it (FactCheck's known blind spot).
 */
export const TrapSchema = z.object({
  text: z.string().min(1).max(300),
  expect: z.enum(["unsupported_number", "unsupported_entity", "inflated_verb", "semantic"]),
});
export type Trap = z.infer<typeof TrapSchema>;

const LinkedInInputSchema = z.object({
  platform: z.literal("linkedin"),
  headline: z.string().max(220),
  about: z.string().max(2600),
});
const HingeInputSchema = z.object({
  platform: z.literal("hinge"),
  answers: z
    .array(z.object({ prompt: z.string().min(1).max(200), answer: z.string().min(1).max(300) }))
    .min(1)
    .max(3),
});

export const EvalCaseSchema = z.object({
  id: z.string().regex(/^(li|hg)-\d{3}$/), // "li-001", "hg-001"
  platform: PlatformSchema,
  origin: z.enum(["synthetic", "consented"]),
  /** "draft" = proposed by Claude, not yet reviewed. Flip to "reviewed" after a human checks gold + traps. */
  status: z.enum(["draft", "reviewed"]),
  tags: z.array(EvalTagSchema).min(1),
  input: z.discriminatedUnion("platform", [LinkedInInputSchema, HingeInputSchema]),
  /** Facts a correct extraction should find. Also used as the user's confirmed facts for rewrite. */
  goldFacts: z.array(z.string().min(1).max(300)).min(1).max(12),
  traps: z.array(TrapSchema).min(2).max(6),
  audiences: z.array(z.string().min(1).max(60)).min(1).max(3),
  traits: z.array(z.string().min(1).max(60)).min(1).max(6),
  goal: z.string().max(300).optional(),
  jobDescription: z.string().max(6000).optional(),
  /** Free-form note for the human reviewer: what this case is testing. */
  notes: z.string().max(500).optional(),
});
export type EvalCase = z.infer<typeof EvalCaseSchema>;

/** Segments exactly as production would build them. */
export function caseSegments(c: EvalCase): Segment[] {
  return c.input.platform === "linkedin"
    ? segmentLinkedIn({ headline: c.input.headline, about: c.input.about })
    : segmentHinge(c.input.answers);
}

/** Gold facts as confirmed, user-sourced facts (what the rewrite step receives). */
export function caseConfirmedFacts(c: EvalCase): IdentityFact[] {
  const prefix = c.platform === "linkedin" ? "f" : "h";
  return c.goldFacts.map((text, i) => ({
    id: `${prefix}${i + 1}`,
    text,
    confirmed: true,
    source: "user" as const,
  }));
}
