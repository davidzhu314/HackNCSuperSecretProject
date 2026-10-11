import type { Platform, PlatformConfig, PlatformGroup } from "./schemas";

// One engine, one config per platform. Audiences are simulated evaluation lenses,
// not real recruiters, daters, or followers, and not demographic claims.
// maxChars is each platform's own limit for the profile field (checked October 2026).

export const LINKEDIN_CONFIG: PlatformConfig = {
  id: "linkedin",
  label: "LinkedIn",
  group: "professional",
  input: "sections",
  fieldLabel: "Profile",
  jobDescription: true,
  categories: [
    { id: "recruitment", label: "Recruitment" },
    { id: "hiring_leadership", label: "Hiring & Leadership" },
    { id: "research_academia", label: "Research & Academia" },
    { id: "entrepreneurship_networking", label: "Entrepreneurship & Networking" },
  ],
  // Each lens is defined by what it looks for, never by who the reader is demographically.
  // Ids of the original three lenses are kept stable.
  audiences: [
    {
      id: "talent_acquisition",
      label: "Talent acquisition specialist",
      summary: "Screens quickly: is your role and level clear?",
      category: "recruitment",
      description:
        "Screens many profiles quickly to decide who goes to a hiring team. Looks for a clear current role and level, what the person wants next, and a headline that matches an opening's title. Moves on when it's unclear which job the person would fit.",
    },
    {
      id: "technical_recruiter",
      label: "Technical recruiter",
      summary: "Matches you to technical roles by your tools and skills.",
      category: "recruitment",
      description:
        "Matches people to technical openings. Scans for concrete languages, tools, and systems, how recently and how deeply they were used, and a plain statement of what the person does.",
    },
    {
      id: "hiring_manager",
      label: "Hiring manager",
      summary: "Would you do well on their team? Reads what you actually did.",
      category: "hiring_leadership",
      description:
        "Decides whether someone would do well on their team. Reads entries for what the person personally did, its scope, and what came of it, and whether that maps to the team's work. Discounts duties listed without outcomes.",
    },
    {
      id: "technical_lead",
      label: "Technical lead",
      summary: "Would work with you. Wants precise technical detail.",
      category: "hiring_leadership",
      description:
        "Would work with the person day to day. Checks whether technical work is described precisely enough to believe: named systems, methods, and trade-offs, and what the person built versus what the team did. Distrusts buzzwords.",
    },
    {
      id: "research_lead",
      label: "Research lead",
      summary: "Looks for research questions, methods, and rigor.",
      category: "research_academia",
      description:
        "Recruits for a lab or research team. Looks for research questions, methods, and evidence of rigor (papers, posters, experiments), and for depth in one area rather than a list of buzzwords.",
    },
    {
      id: "admissions_reviewer",
      label: "Admissions / fellowship reviewer",
      summary: "Looks for direction, curiosity, and follow-through.",
      category: "research_academia",
      description:
        "Reviews applications for an academic program or fellowship. Looks for a coherent direction across experiences, intellectual curiosity, initiative, and evidence the person follows through on what they start.",
    },
    {
      id: "startup_founder",
      label: "Startup founder",
      summary: "Looks for initiative and things you built yourself.",
      category: "entrepreneurship_networking",
      description:
        "Hiring early teammates. Looks for ownership and initiative: things the person started, shipped, or figured out with little guidance, and range across different kinds of work. Skims for what was actually built.",
    },
    {
      id: "industry_professional",
      label: "Industry professional",
      summary: "A peer in your field: credibility and something to talk about.",
      category: "entrepreneurship_networking",
      description:
        "A peer in the person's own field meeting them at a networking event or conference, not evaluating them for a job. Looks for domain credibility (do they know the field's real problems, tools, and vocabulary?) and one specific detail worth starting a conversation about.",
    },
  ],
  traits: [
    {
      id: "clarity",
      label: "Clarity",
      question: "Can they tell what you do?",
      description: "A reader quickly understands who you are and what you do.",
    },
    {
      id: "technical_specificity",
      label: "Technical specificity",
      question: "Can they see the tools and methods you use?",
      description: "Names concrete tools, methods, or technical work instead of generic claims.",
    },
    {
      id: "ownership_impact",
      label: "Ownership and impact",
      question: "Can they tell what you did?",
      description: "Shows what you personally did and what came of it, without exaggeration.",
    },
    {
      id: "relevance",
      label: "Relevance",
      question: "Does it fit what they're looking for?",
      description: "Content fits the target role or job description when one is given.",
    },
    {
      id: "approachability",
      label: "Approachability",
      question: "Would they want to reach out?",
      description: "Tone feels human and easy to start a conversation with.",
    },
  ],
};

/** Default LinkedIn lenses: one each from three categories, so the feedback actually differs. */
export const DEFAULT_LINKEDIN_AUDIENCES = ["technical_recruiter", "hiring_manager", "research_lead"] as const;

export const HINGE_CONFIG: PlatformConfig = {
  id: "hinge",
  label: "Hinge",
  group: "dating",
  input: "prompts",
  fieldLabel: "Prompt answers",
  maxChars: 150,
  jobDescription: false,
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

export const HANDSHAKE_CONFIG: PlatformConfig = {
  id: "handshake",
  label: "Handshake",
  group: "professional",
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
  // The same questions as LinkedIn, so professional feedback reads the same on both.
  traits: LINKEDIN_CONFIG.traits,
};

const SOCIAL_TRAITS: PlatformConfig["traits"] = [
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

export const INSTAGRAM_CONFIG: PlatformConfig = {
  id: "instagram",
  label: "Instagram",
  group: "social",
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
  group: "social",
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

export const TINDER_CONFIG: PlatformConfig = {
  id: "tinder",
  label: "Tinder",
  group: "dating",
  // About me (maxChars), prompt answers (LIMITS.tinderAnswer), and profile fields: tinder.ts.
  input: "tinder",
  fieldLabel: "About me",
  maxChars: 500,
  jobDescription: false,
  // Dating lenses and questions are shared with Hinge.
  audiences: HINGE_CONFIG.audiences,
  traits: HINGE_CONFIG.traits,
};

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: LINKEDIN_CONFIG,
  handshake: HANDSHAKE_CONFIG,
  instagram: INSTAGRAM_CONFIG,
  facebook: FACEBOOK_CONFIG,
  hinge: HINGE_CONFIG,
  tinder: TINDER_CONFIG,
};

/** The three groups, in display order, each listing its platforms in display order. */
export const PLATFORM_GROUPS: { group: PlatformGroup; label: string; platforms: Platform[] }[] = [
  { group: "professional", label: "Professional", platforms: ["linkedin", "handshake"] },
  { group: "social", label: "Social", platforms: ["instagram", "facebook"] },
  { group: "dating", label: "Dating", platforms: ["hinge", "tinder"] },
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
