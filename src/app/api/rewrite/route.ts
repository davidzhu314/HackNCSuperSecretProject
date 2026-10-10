import { handlePost } from "@/lib/api";
import { checkRewrite } from "@/lib/fact-guard";
import { callStructured } from "@/lib/llm";
import { rewritePrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS, resolveSelection } from "@/lib/rubrics";
import {
  LIMITS,
  ModelRewriteSchema,
  RewriteRequestSchema,
  RewriteSchema,
  type RewriteResponse,
} from "@/lib/schemas";
import { LlmError } from "@/lib/llm";

export async function POST(req: Request) {
  return handlePost(req, RewriteRequestSchema, async (data): Promise<RewriteResponse> => {
    const config = PLATFORM_CONFIGS[data.platform];
    const { audiences } = resolveSelection(data.platform, data.audiences, []);
    const { system, user } = rewritePrompt({
      config,
      segments: data.segments,
      facts: data.facts, // schema guarantees every fact is confirmed
      audiences,
      goal: data.goal,
      tone: data.tone,
      jobDescription: data.platform === "linkedin" ? data.jobDescription : undefined,
    });
    const out = await callStructured({
      system,
      user,
      schemaName: "rewrite",
      schema: ModelRewriteSchema,
      maxTokens: 2500,
    });

    const parsed = RewriteSchema.safeParse({
      platform: data.platform,
      content: out.content.trim().slice(0, LIMITS.maxRewriteChars),
      usedFactIds: out.usedFactIds.slice(0, LIMITS.maxFacts),
      changeSummary: out.changeSummary.slice(0, 8).map((s) => s.slice(0, 300)),
    });
    if (!parsed.success) {
      throw new LlmError("invalid_model_output", "The AI returned an unusable rewrite. Please try again.");
    }

    // Deterministic FactCheck against the original text and confirmed facts. Warnings are
    // returned with the rewrite; the UI decides whether it may be shown as publish-ready.
    const warnings = checkRewrite({ rewrite: parsed.data, segments: data.segments, facts: data.facts });
    return { source: "live", rewrite: parsed.data, warnings };
  });
}
