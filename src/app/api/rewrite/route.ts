import { handlePost } from "@/lib/api";
import { callStructured, getRewriteModel } from "@/lib/llm";
import { buildVariations } from "@/lib/postprocess";
import { rewritePrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS, resolveSelection } from "@/lib/rubrics";
import { ModelRewriteSchema, RewriteRequestSchema, type RewriteResponse } from "@/lib/schemas";

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
      model: getRewriteModel(),
      maxTokens: 4000,
    });
    // Each version gets deterministic FactCheck and the AI-cliche lint. Warnings are returned
    // with the text; the UI decides whether it may be shown as publish-ready.
    return { source: "live", variations: buildVariations(out, data.platform, data.segments, data.facts) };
  });
}
