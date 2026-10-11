import { handlePost } from "@/lib/api";
import { callStructured, getRewriteModel, LlmError } from "@/lib/llm";
import { buildSectionRewrite } from "@/lib/postprocess";
import { factCheckSegments, findSection } from "@/lib/profile";
import { sectionRewritePrompt } from "@/lib/prompts";
import { resolveSelection } from "@/lib/rubrics";
import { ModelSectionRewriteSchema, RewriteSectionRequestSchema, type RewriteSectionResponse } from "@/lib/schemas";
import { formatOf, lengthIssue, styleIssues } from "@/lib/styles";

// LinkedIn: one section, one style, one length per call. The UI runs at most 3 of these at a time.

export async function POST(req: Request) {
  return handlePost(req, RewriteSectionRequestSchema, async (data): Promise<RewriteSectionResponse> => {
    // Rewrite the profile's own copy of the section, never client-supplied text.
    const section = findSection(data.profile, data.section.key);
    if (!section) throw new LlmError("invalid_request", "That section isn't in the profile or has no text to rewrite.");

    // Headline/About may draw on the whole profile; an entry only on itself. The model sees
    // exactly what FactCheck accepts as support. Entry locations are never in segments.
    const sources = factCheckSegments(data.profile, section.key)!;
    const { audiences } = resolveSelection("linkedin", data.audiences, []);
    const format = formatOf(section.kind, section.text);

    const attempt = async (retryNote?: string) => {
      const { system, user } = sectionRewritePrompt({
        section,
        sources,
        facts: data.facts, // schema guarantees every fact is confirmed
        style: data.style,
        length: data.length,
        audiences,
        goal: data.goal,
        jobDescription: data.jobDescription,
        retryNote,
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
      return buildSectionRewrite(out, { section, style: data.style, length: data.length, segments: sources, facts: data.facts });
    };

    // If the result breaks a checkable rule of its style (e.g. "I" in Professional) or misses its
    // length step by a lot, try once more with the problems spelled out, and keep the better one:
    // fewest FactCheck warnings first, then fewest style breaks, then (shorter steps only) closest
    // to the target. For longer steps closeness isn't rewarded: growing past the sources is padding.
    const problems = (r: RewriteSectionResponse) => {
      const len = lengthIssue({ step: data.length, ...r.chars });
      return [...styleIssues(data.style, r.rewrite.content, format), ...(len ? [len] : [])];
    };
    const first = await attempt();
    const firstProblems = problems(first);
    if (!firstProblems.length) return first;
    const second = await attempt(firstProblems.join("; "));
    const score = (r: RewriteSectionResponse) =>
      [
        r.warnings.length,
        styleIssues(data.style, r.rewrite.content, format).length,
        r.chars.target < r.chars.original ? Math.abs(r.chars.actual - r.chars.target) : 0,
      ];
    const [a, b] = [score(first), score(second)];
    const secondBetter = b[0] !== a[0] ? b[0] < a[0] : b[1] !== a[1] ? b[1] < a[1] : b[2] < a[2];
    return secondBetter ? second : first;
  });
}
