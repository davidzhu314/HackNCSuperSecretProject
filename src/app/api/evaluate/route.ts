import { handlePost } from "@/lib/api";
import { callStructured, LlmError } from "@/lib/llm";
import { buildCritiques, mergeEvaluations } from "@/lib/postprocess";
import { evaluatePrompt } from "@/lib/prompts";
import { PLATFORM_CONFIGS, resolveSelection } from "@/lib/rubrics";
import { runLimited } from "@/lib/run-limited";
import { EvaluateRequestSchema, ModelEvaluateSchema, type EvaluateResponse } from "@/lib/schemas";

/** Lenses evaluated at the same time: one model call each, so 8 lenses take about as long as 2. */
const PARALLEL_LENSES = 4;

export async function POST(req: Request) {
  return handlePost(req, EvaluateRequestSchema, async (data) => {
    const sel = resolveSelection(data.platform, data.audiences, data.traits);
    const custom = data.customQuestions ?? [];
    if (!sel.audiences.length || (!sel.traits.length && !custom.length)) {
      throw new LlmError("invalid_request", "Unknown audience or trait for this platform.");
    }
    const traitIds = [...sel.traits.map((t) => t.id), ...custom.map((q) => q.id)];
    const results: EvaluateResponse[] = [];
    const failures: unknown[] = [];
    await runLimited(sel.audiences, PARALLEL_LENSES, async (audience) => {
      try {
        results.push(await evaluateLens(audience));
      } catch (err) {
        failures.push(err);
      }
    });
    // A lens that failed must not silently vanish from the results: fail the request instead.
    if (failures.length) throw failures[0];
    // Keep the lenses in the order the user picked them, whatever order the calls finished in.
    return mergeEvaluations(results, sel.audiences.map((a) => a.id));

    async function evaluateLens(audience: (typeof sel.audiences)[number]) {
      const { system, user } = evaluatePrompt({
        config: PLATFORM_CONFIGS[data.platform],
        audiences: [audience],
        traits: sel.traits,
        customQuestions: custom,
        segments: data.segments,
        jobDescription: data.platform === "linkedin" ? data.jobDescription : undefined,
      });
      const out = await callStructured({ system, user, schemaName: "evaluate", schema: ModelEvaluateSchema, maxTokens: 3000 });
      return buildCritiques(out, { audienceIds: [audience.id], traitIds }, data.segments);
    }
  });
}
