import { handlePost } from "@/lib/api";
import { DEMO_LINKEDIN_PROFILE, SAMPLE_SECTION_REWRITES } from "@/lib/demo-data";
import { LlmError } from "@/lib/llm";
import { findSection } from "@/lib/profile";
import { RewriteSectionRequestSchema, type RewriteSectionResponse } from "@/lib/schemas";

// Contract stub: returns the labeled sample for the demo persona's sections and refuses
// everything else. The live model call replaces this in a follow-up PR.

export async function POST(req: Request) {
  return handlePost(req, RewriteSectionRequestSchema, async (data): Promise<RewriteSectionResponse> => {
    // Rewrite the profile's own copy of the section, never client-supplied text.
    const section = findSection(data.profile, data.section.key);
    if (!section) throw new LlmError("invalid_request", "That section isn't in the profile or has no text to rewrite.");

    const demo = findSection(DEMO_LINKEDIN_PROFILE, section.key);
    const sample = SAMPLE_SECTION_REWRITES[section.key]?.[data.style];
    if (sample && demo?.text === section.text) return sample;
    throw new LlmError("upstream_error", "Live section rewrites aren't available yet.");
  });
}
