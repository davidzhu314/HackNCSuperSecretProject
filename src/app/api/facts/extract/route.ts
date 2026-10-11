import { handlePost } from "@/lib/api";
import { callStructured } from "@/lib/llm";
import { buildCandidateFacts } from "@/lib/postprocess";
import { extractPrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { ExtractFactsRequestSchema, ModelExtractSchema, type ExtractFactsResponse } from "@/lib/schemas";

export async function POST(req: Request) {
  return handlePost(req, ExtractFactsRequestSchema, async (data): Promise<ExtractFactsResponse> => {
    const { system, user } = extractPrompt(PLATFORM_CONFIGS[data.platform], data.segments);
    const out = await callStructured({ system, user, schemaName: "extract_facts", schema: ModelExtractSchema });
    return { source: "live", facts: buildCandidateFacts(out.facts) };
  });
}
