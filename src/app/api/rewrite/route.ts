import { handlePost } from "@/lib/api";
import { checkRewrite } from "@/lib/fact-guard";
import { callStructured, getRewriteModel, LlmError } from "@/lib/llm";
import { buildHingeAnswers } from "@/lib/postprocess";
import { rewritePrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS, resolveSelection } from "@/lib/rubrics";
import {
  LIMITS,
  ModelHingeRewriteSchema,
  ModelRewriteSchema,
  RewriteRequestSchema,
  RewriteSchema,
  type GuardWarning,
  type RewriteResponse,
} from "@/lib/schemas";

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
    const common = { system, user, model: getRewriteModel(), maxTokens: 2500 };

    let draft: { content: string; answers?: unknown; usedFactIds: string[]; changeSummary: string[] };
    const citationWarnings: GuardWarning[] = [];
    if (data.platform === "hinge") {
      const out = await callStructured({ ...common, schemaName: "rewrite_hinge", schema: ModelHingeRewriteSchema });
      const built = buildHingeAnswers(out, data.segments);
      citationWarnings.push(...built.warnings);
      draft = {
        content: built.content,
        answers: built.answers,
        usedFactIds: out.usedFactIds,
        changeSummary: [
          ...built.keptOriginal.map((s) => `Kept your answer to "${s.prompt ?? s.id}" as written (the AI returned no rewrite for it).`),
          ...out.changeSummary,
        ],
      };
    } else {
      const out = await callStructured({ ...common, schemaName: "rewrite", schema: ModelRewriteSchema });
      draft = { content: out.content.trim(), usedFactIds: out.usedFactIds, changeSummary: out.changeSummary };
    }

    const parsed = RewriteSchema.safeParse({
      platform: data.platform,
      content: draft.content.slice(0, LIMITS.maxRewriteChars),
      ...(draft.answers ? { answers: draft.answers } : {}),
      usedFactIds: draft.usedFactIds.slice(0, LIMITS.maxFacts),
      changeSummary: draft.changeSummary.slice(0, 8).map((s) => s.slice(0, 300)),
    });
    if (!parsed.success) {
      throw new LlmError("invalid_model_output", "The AI returned an unusable rewrite. Please try again.");
    }

    // Deterministic FactCheck against the original text and confirmed facts. Warnings are
    // returned with the rewrite; the UI decides whether it may be shown as publish-ready.
    const warnings = [
      ...citationWarnings,
      ...checkRewrite({ rewrite: parsed.data, segments: data.segments, facts: data.facts }),
    ];
    return { source: "live", rewrite: parsed.data, warnings };
  });
}
