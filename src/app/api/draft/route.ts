import { handlePost } from "@/lib/api";
import { callStructured, getRewriteModel } from "@/lib/llm";
import { buildDrafts } from "@/lib/postprocess";
import { draftPrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS } from "@/lib/rubrics";
import { DraftRequestSchema, ModelDraftSchema, type DraftResponse } from "@/lib/schemas";
import { fieldFactsAsFacts } from "@/lib/tinder";

// Draft a platform's empty spots from the user's own text on their other platforms. Every sentence
// is FactChecked against those sources; untraceable ones are removed before anything is returned.
export async function POST(req: Request) {
  return handlePost(req, DraftRequestSchema, async (data): Promise<DraftResponse> => {
    const config = PLATFORM_CONFIGS[data.platform];
    const fieldFacts = data.fieldFacts ?? [];
    const { system, user } = draftPrompt({ config, slots: data.slots, sources: data.sources, facts: data.facts, fieldFacts });
    const out = await callStructured({ system, user, model: getRewriteModel(), maxTokens: 3000, schemaName: "draft", schema: ModelDraftSchema });
    const facts = [...data.facts, ...fieldFactsAsFacts(fieldFacts)];
    return { source: "live", drafts: buildDrafts(out, data.slots, data.sources, facts) };
  });
}
