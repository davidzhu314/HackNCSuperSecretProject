import type { Platform, PlatformCategory, PlatformConfig } from "./schemas";

// One engine, one config per platform. Audiences are simulated evaluation lenses,
// not real recruiters, daters, or followers, and not demographic claims.
// maxChars is each platform's own limit for the profile field (checked October 2026).

type Trait = PlatformConfig["traits"][number];

const PROFESSIONAL_TRAITS: Trait[] = [
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
];

const SOCIAL_TRAITS: Trait[] = [
  {
    id: "clarity",
    label: "At-a-glance clarity",
    description: "A visitor gets who you are and what you're about in one read.",
  },
  { id: "specificity", label: "Specificity", description: "Concrete interests and details instead of generic lines." },
  { id: "authenticity", label: "Authenticity", description: "Sounds like a real person, not a template." },
  { id: "voice", label: "Voice", description: "Your personality comes through in the wording." },
  { id: "economy", label: "Economy", description: "Uses the short space well, without filler." },
];

const DATING_TRAITS: Trait[] = [
  { id: "specificity", label: "Specificity", description: "Concrete details instead of generic lines." },
  { id: "warmth", label: "Warmth", description: "Comes across as friendly and open." },
  { id: "authenticity", label: "Authenticity", description: "Sounds like a real person, not a template." },
  {
    id: "conversational_tone",
    label: "Conversational tone",
    description: "Gives the reader an easy hook to reply to.",
  },
  { id: "distinctiveness", label: "Distinctiveness", description: "Stands out from common profile answers." },
];

const DATING_AUDIENCES: PlatformConfig["audiences"] = [
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
];

export const LINKEDIN_CONFIG: PlatformConfig = {
  id: "linkedin",
  label: "LinkedIn",
  category: "professional",
  input: "headline_about",
  fieldLabel: "About",
  jobDescription: true,
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
  traits: PROFESSIONAL_TRAITS,
};

export const HANDSHAKE_CONFIG: PlatformConfig = {
  id: "handshake",
  label: "Handshake",
  category: "professional",
  input: "bio",
  fieldLabel: "Summary",
  maxChars: 300,
  jobDescription: true,
  audiences: [
    {
      id: "campus_recruiter",
      label: "Campus recruiter",
      description: "Scans quickly for your field of study, your stage, and the kind of role you want.",
    },
    {
      id: "internship_manager",
      label: "Internship hiring manager",
      description: "Looks for projects, coursework, or jobs that show what you did yourself.",
    },
    {
      id: "alumni_mentor",
      label: "Alumni mentor",
      description: "Looks for what you're curious about and an easy reason to start a conversation.",
    },
  ],
  traits: PROFESSIONAL_TRAITS,
};

export const INSTAGRAM_CONFIG: PlatformConfig = {
  id: "instagram",
  label: "Instagram",
  category: "social",
  input: "bio",
  fieldLabel: "Bio",
  maxChars: 150,
  jobDescription: false,
  audiences: [
    {
      id: "first_visitor",
      label: "First-time visitor",
      description: "Lands on your profile and decides in one glance what you're about.",
    },
    {
      id: "shared_interest",
      label: "Shared-interest browser",
      description: "Looks for the hobbies or topics you care about, to see if you have them in common.",
    },
    {
      id: "friend_of_friend",
      label: "Friend of a friend",
      description: "Checks that this is really you and what you're into these days.",
    },
  ],
  traits: SOCIAL_TRAITS,
};

export const FACEBOOK_CONFIG: PlatformConfig = {
  id: "facebook",
  label: "Facebook",
  category: "social",
  input: "bio",
  fieldLabel: "Intro",
  maxChars: 101,
  jobDescription: false,
  audiences: [
    {
      id: "old_friend",
      label: "Old friend reconnecting",
      description: "Wants to know what you're up to now, in plain words.",
    },
    {
      id: "community_member",
      label: "Group or community member",
      description: "Looks for a shared interest, school, or local connection.",
    },
    {
      id: "new_acquaintance",
      label: "New acquaintance",
      description: "Met you once and wants a quick, friendly sense of who you are.",
    },
  ],
  traits: SOCIAL_TRAITS,
};

export const TWITTER_CONFIG: PlatformConfig = {
  id: "twitter",
  label: "X (Twitter)",
  category: "social",
  input: "bio",
  fieldLabel: "Bio",
  maxChars: 160,
  jobDescription: false,
  audiences: [
    {
      id: "potential_follower",
      label: "Potential follower",
      description: "Reads the bio to work out what you post about.",
    },
    {
      id: "field_peer",
      label: "Peer in your field",
      description: "Looks for specific, credible topics rather than broad labels.",
    },
    {
      id: "casual_browser",
      label: "Casual browser",
      description: "Notices voice and personality more than credentials.",
    },
  ],
  traits: SOCIAL_TRAITS,
};

export const HINGE_CONFIG: PlatformConfig = {
  id: "hinge",
  label: "Hinge",
  category: "dating",
  input: "prompts",
  fieldLabel: "Prompt answers",
  maxChars: 150,
  jobDescription: false,
  audiences: DATING_AUDIENCES,
  traits: DATING_TRAITS,
};

export const TINDER_CONFIG: PlatformConfig = {
  id: "tinder",
  label: "Tinder",
  category: "dating",
  input: "bio",
  fieldLabel: "About me",
  maxChars: 500,
  jobDescription: false,
  audiences: DATING_AUDIENCES,
  traits: DATING_TRAITS,
};

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: LINKEDIN_CONFIG,
  handshake: HANDSHAKE_CONFIG,
  instagram: INSTAGRAM_CONFIG,
  facebook: FACEBOOK_CONFIG,
  twitter: TWITTER_CONFIG,
  hinge: HINGE_CONFIG,
  tinder: TINDER_CONFIG,
};

/** The three sections, in display order, each listing its platforms in display order. */
export const PLATFORM_SECTIONS: { category: PlatformCategory; label: string; platforms: Platform[] }[] = [
  { category: "professional", label: "Professional", platforms: ["linkedin", "handshake"] },
  { category: "social", label: "Social", platforms: ["instagram", "facebook", "twitter"] },
  { category: "dating", label: "Dating", platforms: ["hinge", "tinder"] },
];

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
