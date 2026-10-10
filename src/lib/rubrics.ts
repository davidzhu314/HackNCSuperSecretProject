import type { Platform, PlatformConfig } from "./schemas";

// One engine, two configs. Audiences are simulated evaluation lenses,
// not real recruiters or daters, and not demographic claims.

export const LINKEDIN_CONFIG: PlatformConfig = {
  id: "linkedin",
  label: "LinkedIn",
  audiences: [
    {
      id: "startup_founder",
      label: "Startup founder",
      description:
        "Looks for evidence of ownership, initiative, and working with little guidance. Skims for what you actually built or did.",
    },
    {
      id: "technical_recruiter",
      label: "Technical recruiter",
      description:
        "Scans quickly for role fit, concrete skills and tools, and a clear statement of what you do.",
    },
    {
      id: "research_lead",
      label: "Research or hiring lead",
      description:
        "Looks for depth, precision, and evidence of rigorous technical work rather than buzzwords.",
    },
  ],
  traits: [
    { id: "clarity", label: "Clarity", description: "A reader quickly understands who you are and what you do." },
    {
      id: "technical_specificity",
      label: "Technical specificity",
      description: "Names concrete tools, methods, or technical work instead of generic claims.",
    },
    {
      id: "ownership_impact",
      label: "Ownership and impact",
      description: "Shows what you personally did and what came of it, without exaggeration.",
    },
    {
      id: "relevance",
      label: "Relevance",
      description: "Content fits the target role or job description when one is given.",
    },
    {
      id: "approachability",
      label: "Approachability",
      description: "Tone feels human and easy to start a conversation with.",
    },
  ],
};

export const HINGE_CONFIG: PlatformConfig = {
  id: "hinge",
  label: "Hinge",
  audiences: [
    {
      id: "humor",
      label: "Humor-oriented",
      description: "Responds to wit and playfulness, and notices when a joke feels forced.",
    },
    {
      id: "shared_interests",
      label: "Shared-interests-oriented",
      description: "Looks for concrete hobbies and details that give them something to ask about.",
    },
    {
      id: "serious_relationship",
      label: "Serious-relationship-oriented",
      description: "Looks for sincerity, clarity about values, and signs of emotional openness.",
    },
  ],
  traits: [
    { id: "specificity", label: "Specificity", description: "Concrete details instead of generic lines." },
    { id: "warmth", label: "Warmth", description: "Comes across as friendly and open." },
    { id: "authenticity", label: "Authenticity", description: "Sounds like a real person, not a template." },
    {
      id: "conversational_tone",
      label: "Conversational tone",
      description: "Gives the reader an easy hook to reply to.",
    },
    { id: "distinctiveness", label: "Distinctiveness", description: "Stands out from common profile answers." },
  ],
};

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: LINKEDIN_CONFIG,
  hinge: HINGE_CONFIG,
};

export const RATING_GUIDE = `Rating scale (categorical only, never numeric):
- not_evident: the text gives no evidence for this trait from this audience's point of view
- weak: some hint, but vague or generic
- moderate: clear but could be sharper or more specific
- strong: clear and specific evidence`;

/** Keep only requested ids that exist in the platform config; returns the config entries in request order. */
export function resolveSelection(platform: Platform, audienceIds: string[], traitIds: string[]) {
  const config = PLATFORM_CONFIGS[platform];
  const audiences = audienceIds
    .map((id) => config.audiences.find((a) => a.id === id))
    .filter((a): a is PlatformConfig["audiences"][number] => Boolean(a));
  const traits = traitIds
    .map((id) => config.traits.find((t) => t.id === id))
    .filter((t): t is PlatformConfig["traits"][number] => Boolean(t));
  return { audiences, traits, unknownAudiences: audienceIds.length - audiences.length, unknownTraits: traitIds.length - traits.length };
}
