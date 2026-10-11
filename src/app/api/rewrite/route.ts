import { handlePost } from "@/lib/api";
import { callStructured, getRewriteModel } from "@/lib/llm";
import { buildHingeVariations, buildOneHingeVariation, buildOneVariation, buildVariations } from "@/lib/postprocess";
import { rewritePrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS, resolveSelection } from "@/lib/rubrics";
import { fieldFactsAsFacts } from "@/lib/tinder";
import {
  ModelHingeRewriteOneSchema,
  ModelHingeRewriteSchema,
  ModelRewriteOneSchema,
  ModelRewriteSchema,
  RewriteRequestSchema,
  type RewriteResponse,
} from "@/lib/schemas";

export async function POST(req: Request) {
  return handlePost(req, RewriteRequestSchema, async (data): Promise<RewriteResponse> => {
    const config = PLATFORM_CONFIGS[data.platform];
    // Profile fields are Tinder's only; on any other platform they are ignored.
    const fieldFacts = config.input === "tinder" ? (data.fieldFacts ?? []) : [];
    const { audiences } = resolveSelection(data.platform, data.audiences, []);
    const { system, user } = rewritePrompt({
      config,
      segments: data.segments,
      facts: data.facts, // schema guarantees every fact is confirmed
      fieldFacts,
      audiences,
      goal: data.goal,
      tone: data.tone,
      jobDescription: config.jobDescription ? data.jobDescription : undefined,
      single: data.single,
      length: data.length,
    });
    const common = { system, user, model: getRewriteModel(), maxTokens: 4000 };
    // Each version gets deterministic FactCheck and the AI-cliche lint. Warnings are returned
    // with the text; the UI decides whether it may be shown as publish-ready.
    if (config.input === "prompts" || config.input === "tinder") {
      // Prompt answers (and Tinder's About me) come back per segment id, so they can't be merged or dropped.
      // FactCheck counts the profile fields the user typed as their own words.
      const sources = [...data.facts, ...fieldFactsAsFacts(fieldFacts)];
      if (data.single) {
        const one = await callStructured({ ...common, schemaName: "rewrite_answers_one", schema: ModelHingeRewriteOneSchema });
        return { source: "live", variations: buildOneHingeVariation(one, data.segments, sources, data.platform) };
      }
      const out = await callStructured({ ...common, schemaName: "rewrite_hinge", schema: ModelHingeRewriteSchema });
      return { source: "live", variations: buildHingeVariations(out, data.segments, sources, data.platform) };
    }
    if (data.single) {
      const one = await callStructured({ ...common, schemaName: "rewrite_one", schema: ModelRewriteOneSchema });
      return { source: "live", variations: buildOneVariation(one, data.platform, data.segments, data.facts) };
    }
    const out = await callStructured({ ...common, schemaName: "rewrite", schema: ModelRewriteSchema });
    return { source: "live", variations: buildVariations(out, data.platform, data.segments, data.facts) };
  });
}
