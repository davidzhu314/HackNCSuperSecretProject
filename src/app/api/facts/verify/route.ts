import { handlePost } from "@/lib/api";
import { callStructured } from "@/lib/llm";
import { buildFactVerdict } from "@/lib/postprocess";
import { verifyFactPrompt } from "@/lib/prompts";
import { ModelVerifyFactSchema, VerifyFactRequestSchema, type VerifyFactResponse } from "@/lib/schemas";

// Lie Checker: one fact against the user's own profile and other facts. Consistency, not truth.
export async function POST(req: Request) {
  return handlePost(req, VerifyFactRequestSchema, async (data): Promise<VerifyFactResponse> => {
    const otherFacts = data.otherFacts.filter((f) => f.id !== data.fact.id);
    const { system, user } = verifyFactPrompt({ ...data, otherFacts });
    const out = await callStructured({ system, user, schemaName: "verify_fact", schema: ModelVerifyFactSchema, maxTokens: 600 });
    return buildFactVerdict(out, { factId: data.fact.id, segments: data.segments, otherFacts });
  });
}
