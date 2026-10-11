import { handlePost } from "@/lib/api";
import { callStructured, LlmError } from "@/lib/llm";
import { buildCritiques } from "@/lib/postprocess";
import { evaluatePrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS, resolveSelection } from "@/lib/rubrics";
import { EvaluateRequestSchema, ModelEvaluateSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  return handlePost(req, EvaluateRequestSchema, async (data) => {
    const sel = resolveSelection(data.platform, data.audiences, data.traits);
    if (!sel.audiences.length || !sel.traits.length) {
      throw new LlmError("invalid_request", "Unknown audience or trait for this platform.");
    }
    const config = PLATFORM_CONFIGS[data.platform];
    const { system, user } = evaluatePrompt({
      config,
      audiences: sel.audiences,
      traits: sel.traits,
      segments: data.segments,
      jobDescription: config.jobDescription ? data.jobDescription : undefined,
    });
    const out = await callStructured({
      system,
      user,
      schemaName: "evaluate",
      schema: ModelEvaluateSchema,
      maxTokens: 4000,
    });
    return buildCritiques(
      out,
      { audienceIds: sel.audiences.map((a) => a.id), traitIds: sel.traits.map((t) => t.id) },
      data.segments,
    );
  });
}
