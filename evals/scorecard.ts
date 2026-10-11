import { z } from "zod";
import type { EvalCase } from "./schema";
import { caseSegments } from "./schema";
import { checkRewrite } from "../src/lib/fact-guard";

export const HumanRatingsSchema = z.object({
  concision: z.number().int().min(1).max(5),
  naturalness: z.number().int().min(1).max(5),
  platformFit: z.number().int().min(1).max(5),
  critiqueUsefulness: z.number().int().min(1).max(5),
  notes: z.string().max(1000),
});

export type DeterministicScore = { overLimit: boolean; factWarnings: number; unsupportedClaims: number; wordCount: number };

/** Mechanical checks are scored by code; voice and usefulness require a human rating. */
export function scoreRewrite(caseData: EvalCase, output: string, limit: number): DeterministicScore {
  const warnings = checkRewrite({ rewrite: { content: output, usedFactIds: [] }, segments: caseSegments(caseData), facts: [] });
  return {
    overLimit: [...output].length > limit,
    factWarnings: warnings.length,
    unsupportedClaims: warnings.filter((warning) => warning.kind === "unsupported_claim" || warning.kind === "unsupported_number" || warning.kind === "unsupported_entity" || warning.kind === "inflated_verb").length,
    wordCount: (output.match(/[\p{L}\p{N}]+/gu) ?? []).length,
  };
}
