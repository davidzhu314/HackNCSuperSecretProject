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
  defaultAudiences: ["technical_recruiter", "hiring_manager", "research_lead"],
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
export const DEFAULT_LINKEDIN_AUDIENCES = LINKEDIN_CONFIG.defaultAudiences!;

export const HINGE_CONFIG: PlatformConfig = {
  id: "hinge",
  label: "Hinge",
  group: "dating",
  input: "prompts",
  fieldLabel: "Prompt answers",
  maxChars: 150,
  jobDescription: false,
  categories: [
    { id: "conversation", label: "Starting a conversation" },
    { id: "shared_life", label: "Shared interests" },
    { id: "depth", label: "Depth & sincerity" },
    { id: "first_impression", label: "First impression" },
  ],
  defaultAudiences: ["humor", "shared_interests", "serious_relationship"],
  audiences: [
    {
      id: "humor",
      label: "Humor-oriented",
      summary: "Responds to wit, and notices when a joke feels forced.",
      category: "conversation",
      description:
        "Responds to wit and playfulness in the answers, and notices when a joke feels forced or borrowed.",
    },
    {
      id: "conversation_starter",
      label: "Conversation starter",
      summary: "Wants one specific detail to reply to.",
      category: "conversation",
      description:
        "Reads each answer looking for one specific, easy hook to reply to. A line that closes the topic gives them nothing to say back.",
    },
    {
      id: "shared_interests",
      label: "Shared-interests-oriented",
      summary: "Looks for concrete hobbies to ask about.",
      category: "shared_life",
      description:
        "Looks for concrete hobbies and details that give them something to ask about or have in common.",
    },
    {
      id: "date_planner",
      label: "Date planner",
      summary: "Looks for things you like doing that could become plans.",
      category: "shared_life",
      description:
        "Looks for activities, places, and things the person likes doing, stated specifically enough to suggest a first plan around.",
    },
    {
      id: "serious_relationship",
      label: "Serious-relationship-oriented",
      summary: "Looks for sincerity and openness in the writing.",
      category: "depth",
      description:
        "Looks for sincerity in the writing: answers that say something real about the person rather than a performance, and signs of openness.",
    },
    {
      id: "thoughtful_reader",
      label: "Thoughtful reader",
      summary: "Reads for how you think, not just what you like.",
      category: "depth",
      description:
        "Reads slowly. Looks for self-awareness and for answers that show how the person thinks, not just a list of likes.",
    },
    {
      id: "quick_glance",
      label: "Quick first glance",
      summary: "Decides in seconds whether the answers feel genuine.",
      category: "first_impression",
      description:
        "Gives the profile a few seconds. Decides whether the answers feel genuine and distinct, or like the same lines everyone writes.",
    },
    {
      id: "detail_noticer",
      label: "Detail noticer",
      summary: "Rewards small, specific details; skips generic lines.",
      category: "first_impression",
      description:
        "Skips generic or copy-paste lines and remembers the small, specific details that make an answer belong to one person.",
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
  categories: [
    { id: "campus_recruiting", label: "Campus recruiting" },
    { id: "hiring_teams", label: "Hiring teams" },
    { id: "career_guidance", label: "Career guidance" },
    { id: "programs", label: "Programs & research" },
  ],
  defaultAudiences: ["campus_recruiter", "internship_manager", "alumni_mentor"],
  audiences: [
    {
      id: "campus_recruiter",
      label: "Campus recruiter",
      summary: "Scans for your field, stage, and the role you want.",
      category: "campus_recruiting",
      description:
        "Scans quickly for the person's field of study, their stage, and the kind of role they want.",
    },
    {
      id: "early_talent_screener",
      label: "Early-talent screener",
      summary: "Checks fit for entry-level programs, stated plainly.",
      category: "campus_recruiting",
      description:
        "Screens for internship and new-grad programs. Looks for a plain statement of field, what the person wants next, and the skills that match a program.",
    },
    {
      id: "internship_manager",
      label: "Internship hiring manager",
      summary: "Looks for projects and jobs that show what you did.",
      category: "hiring_teams",
      description:
        "Looks for projects, coursework, or jobs that show what the person did themselves.",
    },
    {
      id: "future_teammate",
      label: "Future teammate",
      summary: "Wants skills you could use on day one.",
      category: "hiring_teams",
      description:
        "Would work next to the person. Looks for named tools and skills they could actually use on the team, not a list of interests.",
    },
    {
      id: "alumni_mentor",
      label: "Alumni mentor",
      summary: "Looks for curiosity and a reason to start talking.",
      category: "career_guidance",
      description:
        "Looks for what the person is curious about and an easy reason to start a conversation.",
    },
    {
      id: "career_advisor",
      label: "Career center advisor",
      summary: "Checks the summary tells one story: studies to target role.",
      category: "career_guidance",
      description:
        "Reads whether the summary connects the person's studies, experience, and the role they want into one clear direction.",
    },
    {
      id: "research_coordinator",
      label: "Research program coordinator",
      summary: "Looks for research interest, methods, and depth.",
      category: "programs",
      description:
        "Recruits for undergraduate research. Looks for a stated research interest, methods or coursework that support it, and depth in one area.",
    },
    {
      id: "scholarship_reviewer",
      label: "Scholarship / fellowship reviewer",
      summary: "Looks for direction, initiative, and follow-through.",
      category: "programs",
      description:
        "Reviews scholarship or fellowship applicants. Looks for a clear direction, initiative, and evidence the person follows through.",
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
  categories: [
    { id: "first_impressions", label: "First impressions" },
    { id: "interests", label: "Shared interests" },
    { id: "people", label: "People who know you" },
    { id: "connections", label: "New connections" },
  ],
  defaultAudiences: ["first_visitor", "shared_interest", "friend_of_friend"],
  audiences: [
    {
      id: "first_visitor",
      label: "First-time visitor",
      summary: "Decides in one glance what you're about.",
      category: "first_impressions",
      description:
        "Lands on the profile and decides in one glance what the person is about.",
    },
    {
      id: "explore_scroller",
      label: "Explore-page scroller",
      summary: "Looks for one memorable hook before moving on.",
      category: "first_impressions",
      description:
        "Arrived from a post. Gives the bio a second and looks for one memorable, specific hook.",
    },
    {
      id: "shared_interest",
      label: "Shared-interest browser",
      summary: "Looks for hobbies or topics you have in common.",
      category: "interests",
      description:
        "Looks for the hobbies or topics the person cares about, to see if they have them in common.",
    },
    {
      id: "community_member",
      label: "Club or community member",
      summary: "Looks for the groups and activities you're part of.",
      category: "interests",
      description:
        "Looks for the clubs, teams, and activities the person is part of, as a reason to connect.",
    },
    {
      id: "friend_of_friend",
      label: "Friend of a friend",
      summary: "Checks this is really you and what you're into now.",
      category: "people",
      description:
        "Checks that this is really the person and what they're into these days.",
    },
    {
      id: "old_classmate",
      label: "Old classmate",
      summary: "Wants to recognize you and see what's new.",
      category: "people",
      description:
        "Knew the person a while ago. Wants to recognize them and see what they're doing now.",
    },
    {
      id: "potential_collaborator",
      label: "Potential collaborator",
      summary: "Looks for what you make, do, or post about.",
      category: "connections",
      description:
        "Looking for someone to make or do something with. Looks for what the person creates, does, or posts about.",
    },
    {
      id: "professional_contact",
      label: "Professional contact",
      summary: "Checks your bio matches how you present at school or work.",
      category: "connections",
      description:
        "Met the person through school or work and looked them up. Checks the bio is consistent with that and has nothing confusing.",
    },
  ],
  traits: SOCIAL_TRAITS,
};

export const GITHUB_CONFIG: PlatformConfig = {
  id: "github",
  label: "GitHub",
  group: "social",
  input: "bio",
  fieldLabel: "Bio",
  maxChars: 160,
  jobDescription: false,
  categories: [
    { id: "developers", label: "Developers" },
    { id: "open_source", label: "Open source" },
    { id: "hiring", label: "Hiring" },
    { id: "community", label: "Community" },
  ],
  defaultAudiences: ["fellow_developer", "maintainer", "tech_recruiter"],
  audiences: [
    {
      id: "fellow_developer",
      label: "Fellow developer",
      summary: "Wants to know what you build and with what.",
      category: "developers",
      description:
        "Lands on the profile from a repo or a pull request and wants to know what the person builds and with what.",
    },
    {
      id: "code_reviewer",
      label: "Code reviewer",
      summary: "Looks for context on your work before reviewing it.",
      category: "developers",
      description:
        "About to review the person's pull request. Looks for what they work on and which languages, to calibrate the review.",
    },
    {
      id: "maintainer",
      label: "Open-source maintainer",
      summary: "Looks for the projects and areas you actually work in.",
      category: "open_source",
      description:
        "Deciding whether to work with the person: looks for the projects, languages, and areas they actually work in.",
    },
    {
      id: "project_visitor",
      label: "Visitor to your projects",
      summary: "Wants to know what your projects are and what you focus on.",
      category: "open_source",
      description:
        "Found one of the person's repositories. Wants to know what their projects are about and what they're focused on now.",
    },
    {
      id: "tech_recruiter",
      label: "Recruiter browsing GitHub",
      summary: "Skims for what you do and the work you'd want next.",
      category: "hiring",
      description:
        "Skims the bio for what the person studies or does and the kind of work they'd want next.",
    },
    {
      id: "engineering_manager",
      label: "Engineering manager",
      summary: "Looks for areas of depth and what you've shipped.",
      category: "hiring",
      description:
        "Looks for the areas where the person has depth and for things they've built or shipped, named specifically.",
    },
    {
      id: "hackathon_teammate",
      label: "Hackathon teammate",
      summary: "Looks for skills to split work and what you like building.",
      category: "community",
      description:
        "Forming a team. Looks for the person's skills, to split the work, and what they like building.",
    },
    {
      id: "meetup_organizer",
      label: "Meetup organizer",
      summary: "Looks for topics you could talk or teach about.",
      category: "community",
      description:
        "Looking for speakers or helpers. Looks for the topics, tools, and projects the person could talk or teach about.",
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
  categories: [
    { id: "swipe", label: "Swipe decision" },
    { id: "opener", label: "Opening line" },
    { id: "shared", label: "Shared interests" },
    { id: "sincerity", label: "Sincerity" },
  ],
  defaultAudiences: ["quick_swiper", "opener_seeker", "shared_interests"],
  audiences: [
    {
      id: "quick_swiper",
      label: "Quick swiper",
      summary: "Reads About me in two seconds: is there one clear hook?",
      category: "swipe",
      description:
        "Reads the About me in about two seconds. Swipes on a clear, specific first line; passes on a wall of text or a list of adjectives.",
    },
    {
      id: "bio_reader",
      label: "Full-profile reader",
      summary: "Reads About me and every prompt for a consistent voice.",
      category: "swipe",
      description:
        "Reads the whole About me and every prompt answer. Notices whether they sound like the same person and whether anything repeats.",
    },
    {
      id: "opener_seeker",
      label: "Looking for an opener",
      summary: "Wants a specific detail to message you about.",
      category: "opener",
      description:
        "Wants to send a first message that isn't 'hey'. Looks for one specific, askable detail in the About or an answer.",
    },
    {
      id: "humor",
      label: "Humor-oriented",
      summary: "Responds to wit, and notices when a joke feels forced.",
      category: "opener",
      description:
        "Responds to wit and playfulness, and notices when a joke feels forced or borrowed.",
    },
    {
      id: "shared_interests",
      label: "Shared-interests-oriented",
      summary: "Looks for concrete hobbies to ask about.",
      category: "shared",
      description:
        "Looks for concrete hobbies and details that give them something to ask about or have in common.",
    },
    {
      id: "activity_partner",
      label: "Activity partner",
      summary: "Looks for things you do that could become plans.",
      category: "shared",
      description:
        "Looks for things the person actually does (places, activities, routines), specific enough to turn into plans.",
    },
    {
      id: "serious_relationship",
      label: "Serious-relationship-oriented",
      summary: "Looks for sincerity and openness in the writing.",
      category: "sincerity",
      description:
        "Looks for sincerity in the writing: lines that say something real about the person rather than a performance, and signs of openness.",
    },
    {
      id: "authenticity_checker",
      label: "Authenticity checker",
      summary: "Notices lines that sound copied or AI-written.",
      category: "sincerity",
      description:
        "Notices lines that sound copied, templated, or AI-written, and trusts the plain, specific ones.",
    },
  ],
  // Dating questions are shared with Hinge.
  traits: HINGE_CONFIG.traits,
};

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: LINKEDIN_CONFIG,
  handshake: HANDSHAKE_CONFIG,
  instagram: INSTAGRAM_CONFIG,
  github: GITHUB_CONFIG,
  hinge: HINGE_CONFIG,
  tinder: TINDER_CONFIG,
};

/** The three groups, in display order, each listing its platforms in display order. */
export const PLATFORM_GROUPS: { group: PlatformGroup; label: string; platforms: Platform[] }[] = [
  { group: "professional", label: "Professional", platforms: ["linkedin", "handshake"] },
  { group: "social", label: "Social", platforms: ["instagram", "github"] },
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
