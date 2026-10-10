import { handlePost } from "@/lib/api";
import { callStructured, getRewriteModel, LlmError } from "@/lib/llm";
import { buildSectionRewrite } from "@/lib/postprocess";
import { factCheckSegments, findSection } from "@/lib/profile";
import { sectionRewritePrompt } from "@/lib/prompts";
import { resolveSelection } from "@/lib/rubrics";
import { ModelSectionRewriteSchema, RewriteSectionRequestSchema, type RewriteSectionResponse } from "@/lib/schemas";

// LinkedIn: one section, one style per call. The UI runs at most 3 of these at a time.

export async function POST(req: Request) {
  return handlePost(req, RewriteSectionRequestSchema, async (data): Promise<RewriteSectionResponse> => {
    // Rewrite the profile's own copy of the section, never client-supplied text.
    const section = findSection(data.profile, data.section.key);
    if (!section) throw new LlmError("invalid_request", "That section isn't in the profile or has no text to rewrite.");

    // Headline/About may draw on the whole profile; an entry only on itself. The model sees
    // exactly what FactCheck accepts as support. Entry locations are never in segments.
    const sources = factCheckSegments(data.profile, section.key)!;
    const { audiences } = resolveSelection("linkedin", data.audiences, []);
    const { system, user } = sectionRewritePrompt({
      section,
      sources,
      facts: data.facts, // schema guarantees every fact is confirmed
      style: data.style,
      audiences,
      goal: data.goal,
      jobDescription: data.jobDescription,
    });
    const out = await callStructured({
      system,
      user,
      schemaName: "rewrite_section",
      schema: ModelSectionRewriteSchema,
      model: getRewriteModel(),
      // Room for the longest section (About, 2,600 characters) plus the JSON around it.
      maxTokens: section.kind === "headline" ? 600 : section.kind === "about" ? 3000 : 2000,
    });
    return buildSectionRewrite(out, { section, style: data.style, segments: sources, facts: data.facts });
  });
}
