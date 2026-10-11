import { checkRewrite } from "./fact-guard";
import { factCheckSegments, findSection } from "./profile";
import type {
  AudienceCritique,
  EvaluateResponse,
  ExtractFactsResponse,
  IdentityFact,
  LinkedInProfile,
  RewriteResponse,
  RewriteSectionResponse,
  SectionStyle,
  Segment,
} from "./schemas";
import { segmentHinge, segmentLinkedIn } from "./segments";
import { checkStyle } from "./style-check";

// Fictitious persona. Nothing here describes a real person.
// Every "sample" output below must be labeled "sample result" in the UI, never shown as a live run.

export const DEMO_PERSONA = { name: "Priya Nair (fictitious demo persona)" };

// ---------- LinkedIn ----------

/** The persona's profile by sections. Organizations are invented. */
export const DEMO_LINKEDIN_PROFILE: LinkedInProfile = {
  headline: "Aspiring tech professional | Passionate about innovation",
  about:
    "I am a motivated team player who is passionate about technology. I have experience with various projects and love learning new things. Looking for opportunities to grow and make an impact.",
  experience: [
    {
      id: "exp1",
      title: "Software Engineering Intern",
      organization: "Tallowtree Analytics",
      dates: "June 2026 - August 2026 (3 months)",
      location: "Remote",
      description:
        "- Worked on data cleaning scripts in Python\n- Helped the team with various tasks\n- Attended meetings and learned a lot",
    },
    {
      id: "exp2",
      title: "Teaching Assistant",
      organization: "Calder Valley University",
      dates: "January 2025 - Present (1 year 10 months)",
      description: "- Helped students in an intro programming course\n- Held office hours and answered questions",
    },
    {
      id: "exp3",
      title: "Open-Source Contributor",
      organization: "Vizbloom",
      dates: "2024 - Present",
      description: "- Contributed bug fixes and documentation to an open-source data visualization library",
    },
  ],
  education: [
    { id: "edu1", title: "B.S. Computer Science", organization: "Calder Valley University", dates: "2023 - 2027", description: "" },
  ],
  projects: [
    {
      id: "proj1",
      title: "Course planner",
      organization: "Class project",
      description: "- Made a web app for planning courses using Python and React",
    },
  ],
  volunteering: [
    {
      id: "vol1",
      title: "Volunteer Tutor",
      organization: "Maple Street Library Coding Club",
      dates: "2024 - Present",
      description: "Teaching kids coding on weekends.",
    },
  ],
  skills: ["Python", "React", "Git", "Technical writing"],
  honors: ["Dean's List"],
};

/** Legacy one-block LinkedIn input (headline + About), used by the current flow. */
export const DEMO_LINKEDIN_INPUT = {
  headline: DEMO_LINKEDIN_PROFILE.headline,
  about: DEMO_LINKEDIN_PROFILE.about,
};

export const DEMO_LINKEDIN_SEGMENTS: Segment[] = segmentLinkedIn(DEMO_LINKEDIN_INPUT);

/** Facts the persona confirmed (4-6 for the demo). */
export const DEMO_LINKEDIN_FACTS: IdentityFact[] = [
  { id: "f1", text: "I am a senior studying computer science.", confirmed: true, source: "user" },
  {
    id: "f2",
    text: "I contributed bug fixes and documentation to an open-source data visualization library.",
    confirmed: true,
    source: "user",
  },
  {
    id: "f3",
    text: "I was a teaching assistant for an introductory programming course.",
    confirmed: true,
    source: "user",
  },
  {
    id: "f4",
    text: "I built a course-planning web app with Python and React for a class project.",
    confirmed: true,
    source: "user",
  },
  {
    id: "f5",
    text: "I enjoy explaining technical ideas to non-technical people.",
    confirmed: true,
    source: "user",
  },
];

/** Candidate facts as /api/facts/extract would return them: never confirmed. */
export const SAMPLE_EXTRACT: ExtractFactsResponse = {
  source: "sample",
  facts: DEMO_LINKEDIN_FACTS.map((f) => ({ ...f, confirmed: false as const, source: "extracted" as const })),
};

/** Sample critique; missingEvidence follows from having no cited segments, as on the server. */
function critique(
  audience: string,
  trait: string,
  rating: AudienceCritique["rating"],
  segmentIds: string[],
  rationale: string,
  suggestion: string,
): AudienceCritique {
  return { audience, trait, rating, segmentIds, missingEvidence: segmentIds.length === 0, rationale, suggestion };
}

/** Every audience x trait combination for LinkedIn, so the sample matrix is full whatever the user picks. */
export const SAMPLE_EVALUATE: EvaluateResponse = {
  source: "sample",
  warnings: [],
  critiques: [
    // Startup founder
    critique("startup_founder", "clarity", "weak", ["s1"],
      "\"Aspiring tech professional\" says what you hope to be, not what you do, so a founder skimming can't place you.",
      "Open with what you are now (your field and stage) and one thing you have made."),
    critique("startup_founder", "technical_specificity", "not_evident", [],
      "There is nothing a founder could check: no project, tool, or piece of technical work is named.",
      "Name a real project and the tools you used for it."),
    critique("startup_founder", "ownership_impact", "weak", ["s3"],
      "\"Experience with various projects\" does not say what was built or what the person did.",
      "Name one project and your specific part in it."),
    critique("startup_founder", "relevance", "weak", ["s4"],
      "\"Looking for opportunities\" is open-ended, so it's unclear what kind of role or team would fit.",
      "Say what kind of work you want next, if you know it."),
    critique("startup_founder", "approachability", "moderate", ["s2"],
      "The tone is friendly and positive, which makes it easy to reach out.",
      "Keep the warm tone, but pair it with one concrete detail."),
    // Technical recruiter
    critique("technical_recruiter", "clarity", "weak", ["s1"],
      "The headline doesn't state a role or level, so it's hard to match to an opening.",
      "Put your field and current stage (for example, a student year) in the headline."),
    critique("technical_recruiter", "technical_specificity", "not_evident", [],
      "No languages, tools, or technical work are mentioned anywhere in the text.",
      "Add the technologies you have actually used, drawn from your confirmed facts."),
    critique("technical_recruiter", "ownership_impact", "not_evident", [],
      "Nothing describes a responsibility or result that a recruiter could point to.",
      "Describe one thing you were responsible for, in plain terms."),
    critique("technical_recruiter", "relevance", "weak", ["s1", "s4"],
      "\"Tech professional\" and \"opportunities\" are too broad to match against a specific job.",
      "Paste a job description to see feedback against a real target."),
    critique("technical_recruiter", "approachability", "moderate", ["s2"],
      "Reads as friendly and collaborative.",
      "Fine as is; specificity matters more for this reader."),
    // Research or hiring lead
    critique("research_lead", "clarity", "weak", ["s1", "s2"],
      "The headline and opening use general phrases (\"passionate\", \"innovation\") that could describe anyone.",
      "Lead with your field and one concrete thing you have done."),
    critique("research_lead", "technical_specificity", "not_evident", [],
      "There is no method, system, or technical depth to evaluate.",
      "Describe one technical problem you worked on and how you approached it."),
    critique("research_lead", "ownership_impact", "weak", ["s3"],
      "Projects are mentioned only in general, so it's unclear what you personally contributed.",
      "Separate what you did yourself from what a group did."),
    critique("research_lead", "relevance", "not_evident", [],
      "Without a target role or area, there's nothing to judge fit against.",
      "Name the area of work you're aiming for, or paste a job description."),
    critique("research_lead", "approachability", "moderate", ["s2", "s3"],
      "Enthusiasm for learning comes through and reads as genuine.",
      "Keep it, and back it up with something you learned or built."),
  ],
};

/** Sectioned sample for all 8 LinkedIn lenses, citing DEMO_LINKEDIN_PROFILE segment ids. */
export const SAMPLE_PROFILE_EVALUATE: EvaluateResponse = {
  source: "sample",
  warnings: [],
  critiques: [
    // Technical recruiter
    critique("technical_recruiter", "clarity", "weak", ["headline-s1"],
      "\"Aspiring tech professional\" doesn't say a role or level, so it's hard to match to an opening.",
      "Put your field and stage in the headline, e.g. computer science student and the tools you use."),
    critique("technical_recruiter", "technical_specificity", "strong", ["skills-s1", "exp1-s2", "proj1-s2"],
      "Python and React show up in your skills, internship, and project, so the stack is easy to find.",
      "Mention the same tools in your headline too, since that's what shows in search."),
    critique("technical_recruiter", "ownership_impact", "weak", ["exp1-s3"],
      "\"Helped the team with various tasks\" doesn't say what you were responsible for.",
      "Replace it with the specific task you did, or drop it."),
    critique("technical_recruiter", "relevance", "weak", ["about-s3"],
      "\"Looking for opportunities\" doesn't say which roles you want, so there's nothing to match against.",
      "Name the kind of role you want next, or paste a job description."),
    critique("technical_recruiter", "approachability", "moderate", ["about-s1"],
      "Friendly and positive, though generic.",
      "Fine as is; specificity matters more for this reader."),
    // Hiring manager
    critique("hiring_manager", "clarity", "moderate", ["exp1-s1", "exp2-s1"],
      "Your entries make your roles clear even though the headline and About don't.",
      "Bring the internship and TA role up into your About."),
    critique("hiring_manager", "technical_specificity", "moderate", ["exp1-s2"],
      "Data-cleaning scripts in Python is real work, but it's the only technical detail in the internship.",
      "Say what the scripts cleaned or who used them, if you know."),
    critique("hiring_manager", "ownership_impact", "weak", ["exp1-s3", "exp1-s4"],
      "Two of three internship bullets describe being present rather than what you did.",
      "Keep the bullet about the scripts and cut or replace the other two."),
    critique("hiring_manager", "relevance", "not_evident", [],
      "Without a target role or job description, there's nothing to judge fit against.",
      "Paste a job description to get feedback against a real team's needs."),
    critique("hiring_manager", "approachability", "strong", ["exp2-s3", "vol1-s2"],
      "Office hours and weekend tutoring suggest you're patient and good with people.",
      "Keep both; they say more than \"team player\" does."),
    // Research lead
    critique("research_lead", "clarity", "weak", ["headline-s1", "about-s1"],
      "The headline and opening use general phrases (\"passionate\", \"innovation\") that could describe anyone.",
      "Lead with your field and one concrete thing you have done."),
    critique("research_lead", "technical_specificity", "weak", ["exp1-s2", "proj1-s2"],
      "Tools are named but not the problems: what data, what the app had to handle.",
      "Describe one technical problem you worked on and how you approached it."),
    critique("research_lead", "ownership_impact", "moderate", ["exp3-s2"],
      "Bug fixes and documentation for an open-source library are concrete and checkable.",
      "Keep it; this is the most verifiable item on the profile."),
    critique("research_lead", "relevance", "not_evident", [],
      "Nothing points to a research area or question you care about.",
      "If you have an area of interest, name it."),
    critique("research_lead", "approachability", "moderate", ["about-s2"],
      "Enthusiasm for learning comes through and reads as genuine.",
      "Keep it, and back it up with something you learned or built."),
    // Talent acquisition specialist
    critique("talent_acquisition", "clarity", "weak", ["headline-s1"],
      "\"Aspiring tech professional\" doesn't match any job title, so it's hard to route you to an opening.",
      "Use a headline that names your field and stage, such as the degree you're studying for."),
    critique("talent_acquisition", "technical_specificity", "moderate", ["skills-s1"],
      "The skills list gives searchable terms, though the headline and About don't repeat them.",
      "Mention your main tools near the top, not only in Skills."),
    critique("talent_acquisition", "ownership_impact", "weak", ["exp1-s3", "exp1-s4"],
      "The internship reads as attending and helping, which is hard to summarize for a hiring team.",
      "Lead the internship with the work you did yourself."),
    critique("talent_acquisition", "relevance", "weak", ["about-s3"],
      "It's not clear what role or start date you're looking for.",
      "Say what kind of role you want next and when, if you know."),
    critique("talent_acquisition", "approachability", "moderate", ["about-s1"],
      "Friendly and easy to contact, though generic.",
      "Fine as is."),
    // Technical lead
    critique("technical_lead", "clarity", "moderate", ["exp1-s1", "proj1-s1"],
      "The entries make your roles clear: an internship, a TA role, open source, a class project.",
      "Keep this structure; the headline is what needs work."),
    critique("technical_lead", "technical_specificity", "weak", ["exp1-s2", "proj1-s2"],
      "Python and React are named, but not what the scripts or the app had to handle.",
      "Add one detail about a technical problem you solved, if it's true."),
    critique("technical_lead", "ownership_impact", "strong", ["exp3-s2"],
      "Bug fixes and documentation for a public library are concrete and checkable.",
      "Name the library so a reviewer can look at your work."),
    critique("technical_lead", "relevance", "not_evident", [],
      "Without a target role, there's nothing to compare your stack against.",
      "Paste a job description to compare against a real team."),
    critique("technical_lead", "approachability", "moderate", ["exp2-s3"],
      "Holding office hours suggests you can explain your work to others.",
      "Keep it."),
    // Admissions / fellowship reviewer
    critique("admissions_reviewer", "clarity", "weak", ["about-s1", "about-s2"],
      "The About doesn't say what you study or what draws you to it.",
      "Open with your field and one reason you chose it, in your own words."),
    critique("admissions_reviewer", "technical_specificity", "not_evident", [],
      "There's no question or topic you've explored in depth.",
      "If a project or course went deeper than required, describe it."),
    critique("admissions_reviewer", "ownership_impact", "moderate", ["exp2-s2", "vol1-s2"],
      "Teaching and weekend tutoring show steady commitment to helping others learn.",
      "Say how long you've done each, using the dates you already list."),
    critique("admissions_reviewer", "relevance", "weak", ["about-s3"],
      "There's no stated direction, so the experiences read as a list rather than a path.",
      "Connect your entries with one sentence about where you're heading."),
    critique("admissions_reviewer", "approachability", "strong", ["vol1-s2", "about-s2"],
      "Volunteering with kids and enjoying learning come across as sincere.",
      "Keep both."),
    // Startup founder
    critique("startup_founder", "clarity", "weak", ["headline-s1", "about-s1"],
      "\"Aspiring\" and \"passionate\" say what you hope to be, not what you do.",
      "Open with what you are now and one thing you have made."),
    critique("startup_founder", "technical_specificity", "moderate", ["proj1-s2"],
      "A web app in Python and React is real building work.",
      "Say what the app does for its users."),
    critique("startup_founder", "ownership_impact", "moderate", ["proj1-s2", "exp3-s2"],
      "The project and the open-source fixes are things you built on your own initiative.",
      "Lead with these; they show initiative more than the internship bullets do."),
    critique("startup_founder", "relevance", "weak", ["about-s3"],
      "\"Looking for opportunities\" doesn't say whether early-stage work interests you.",
      "Say what kind of team or problem you'd like to work on, if you know."),
    critique("startup_founder", "approachability", "moderate", ["about-s2"],
      "Positive and open.",
      "Pair the tone with one concrete detail."),
    // Industry professional
    critique("industry_professional", "clarity", "weak", ["headline-s1"],
      "A peer can't tell which part of tech you work in.",
      "Name your area in the headline."),
    critique("industry_professional", "technical_specificity", "moderate", ["exp3-s2", "skills-s1"],
      "Open-source data visualization work gives a peer something specific to ask about.",
      "Name the library; it's the easiest conversation starter you have."),
    critique("industry_professional", "ownership_impact", "moderate", ["exp3-s2"],
      "Contributing to a public library signals you know how real projects are maintained.",
      "Keep it near the top."),
    critique("industry_professional", "relevance", "not_evident", [],
      "Nothing says which problems in the field you care about.",
      "Mention a topic you'd enjoy talking about with someone in your field."),
    critique("industry_professional", "approachability", "strong", ["exp2-s3", "vol1-s2"],
      "Teaching and tutoring suggest you're easy to talk to.",
      "Keep them visible."),
  ],
};

/** Both sample versions use only the demo facts and pass FactCheck and the cliche lint (tested). */
export const SAMPLE_REWRITE: RewriteResponse = {
  source: "sample",
  variations: [
    {
      style: "direct",
      warnings: [],
      styleWarnings: [],
      rewrite: {
        platform: "linkedin",
        content:
          "Computer science senior | Python and React | Teaching assistant\n\nComputer science senior who enjoys explaining technical ideas clearly.\n\n- Built a course-planning web app with Python and React for a class project\n- Contributed bug fixes and documentation to an open-source data visualization library\n- Teaching assistant for an introductory programming course\n\nI enjoy explaining technical ideas to non-technical people, and I'm looking for opportunities to grow.",
        usedFactIds: ["f1", "f2", "f3", "f4", "f5"],
        changeSummary: [
          "Headline now states your field, tools, and role instead of \"aspiring\" and \"passionate\".",
          "Listed your confirmed projects and roles as bullets.",
          "No numbers, employers, or dates were added.",
        ],
      },
    },
    {
      style: "narrative",
      warnings: [],
      styleWarnings: [],
      rewrite: {
        platform: "linkedin",
        content:
          "Computer science senior | Teaching assistant | Open-source contributor\n\nI'm a computer science senior, and I enjoy explaining technical ideas to non-technical people.\n\nI was a teaching assistant for an introductory programming course. For a class project, I built a course-planning web app with Python and React.\n\nI've also contributed bug fixes and documentation to an open-source data visualization library.\n\nI love learning new things, and I'm looking for opportunities to grow.",
        usedFactIds: ["f1", "f2", "f3", "f4", "f5"],
        changeSummary: [
          "Opened with what you enjoy, in your own first-person voice.",
          "Told your experience as a short sequence: teaching, building, open source.",
          "Kept \"love learning new things\" from your original text; added nothing new.",
        ],
      },
    },
  ],
};

/** Build a sample section response; warnings come from running the real checks, never typed by hand. */
function sampleSection(sectionKey: string, style: SectionStyle, content: string, changeSummary: string[]): RewriteSectionResponse {
  const usedFactIds = DEMO_LINKEDIN_FACTS.map((f) => f.id);
  const original = findSection(DEMO_LINKEDIN_PROFILE, sectionKey)?.text ?? "";
  return {
    source: "sample",
    sectionKey,
    style,
    length: "same",
    chars: { original: original.length, target: original.length, actual: content.length },
    rewrite: { platform: "linkedin", content, usedFactIds, changeSummary },
    warnings: checkRewrite({
      rewrite: { content, usedFactIds },
      segments: factCheckSegments(DEMO_LINKEDIN_PROFILE, sectionKey) ?? [],
      facts: DEMO_LINKEDIN_FACTS,
    }),
    styleWarnings: checkStyle(content),
  };
}

/**
 * One sample rewrite per rewritable section per style, at "same" length only (the length slider
 * needs live AI). Tests require empty warnings and no style-rule breaks on all of them.
 */
export const SAMPLE_SECTION_REWRITES: Record<string, Record<SectionStyle, RewriteSectionResponse>> = {
  headline: {
    direct: sampleSection("headline", "direct", "Computer science senior | Python and React | Teaching assistant", [
      "States your field, tools, and role instead of \"aspiring\" and \"passionate\".",
    ]),
    narrative: sampleSection(
      "headline",
      "narrative",
      "Computer science senior who enjoys explaining technical ideas to non-technical people",
      ["Leads with what you study and what you enjoy, in a sentence."],
    ),
    professional: sampleSection("headline", "professional", "Computer Science Senior | Python and React | Teaching Assistant | Open-Source Contributor", ["Title-style summary of your field, tools, and roles."]),
  },
  about: {
    direct: sampleSection(
      "about",
      "direct",
      "Computer science senior at Calder Valley University. I work in Python and React, and I enjoy explaining technical ideas to non-technical people.\n\nI'm looking for opportunities to grow.",
      ["Replaced \"motivated team player\" with your field and tools.", "No numbers, employers, or dates were added."],
    ),
    narrative: sampleSection(
      "about",
      "narrative",
      "I'm a computer science senior at Calder Valley University, and I enjoy explaining technical ideas to non-technical people.\n\nI've been a teaching assistant for an introductory programming course, contributed bug fixes and documentation to an open-source data visualization library, and wrote data-cleaning scripts in Python as a software engineering intern.\n\nI love learning new things, and I'm looking for opportunities to grow.",
      ["Told your experience as a short sequence: teaching, open source, internship.", "Kept \"love learning new things\" from your original text."],
    ),
    professional: sampleSection("about", "professional", "Computer science senior at Calder Valley University working in Python and React.\n\nExperience includes a software engineering internship writing data-cleaning scripts in Python, a teaching assistant role for an introductory programming course, and bug fixes and documentation for an open-source data visualization library.\n\nInterested in explaining technical ideas to non-technical people and in opportunities to grow.", ["A compact summary without first person: profile, experience, interests."]),
  },
  exp1: {
    direct: sampleSection("exp1", "direct", "- Wrote data-cleaning scripts in Python\n- Helped the team with day-to-day tasks\n- Attended team meetings", [
      "Led with the concrete work.",
      "Kept the same three bullets; added no results.",
    ]),
    narrative: sampleSection(
      "exp1",
      "narrative",
      "- Wrote data-cleaning scripts in Python for the team\n- Helped with other tasks and learned a lot from the meetings I attended",
      ["Merged the two vaguer bullets into one."],
    ),
    professional: sampleSection("exp1", "professional", "- Wrote data-cleaning scripts in Python\n- Assisted the team with various tasks\n- Participated in team meetings", ["Parallel bullets in past tense, no first person."]),
  },
  exp2: {
    direct: sampleSection(
      "exp2",
      "direct",
      "- Teaching assistant for an introductory programming course\n- Held office hours and answered student questions",
      ["Spelled out \"intro\" and named the role."],
    ),
    narrative: sampleSection(
      "exp2",
      "narrative",
      "- Helped students work through an introductory programming course\n- Held office hours and answered their questions",
      ["Kept your wording, slightly more personal."],
    ),
    professional: sampleSection("exp2", "professional", "- Supported students in an introductory programming course\n- Held office hours to answer student questions", ["Formal, parallel bullets."]),
  },
  exp3: {
    direct: sampleSection(
      "exp3",
      "direct",
      "- Contributed bug fixes and documentation to Vizbloom, an open-source data visualization library",
      ["Named the library."],
    ),
    narrative: sampleSection(
      "exp3",
      "narrative",
      "- Contributed bug fixes and documentation to Vizbloom, an open-source library for data visualization",
      ["Named the library; kept \"contributed\"."],
    ),
    professional: sampleSection("exp3", "professional", "- Contributed bug fixes and documentation to an open-source data visualization library (Vizbloom)", ["Formal wording; kept \"contributed\"."]),
  },
  proj1: {
    direct: sampleSection("proj1", "direct", "- Built a course-planning web app with Python and React for a class project", [
      "Said what it is and what it's built with.",
    ]),
    narrative: sampleSection(
      "proj1",
      "narrative",
      "- For a class project, built a web app for planning courses with Python and React",
      ["Opened with the context, then what you built."],
    ),
    professional: sampleSection("proj1", "professional", "- Developed a course-planning web application in Python and React as part of a class project", ["Formal wording for the same project."]),
  },
  vol1: {
    direct: sampleSection("vol1", "direct", "Volunteer tutor at a library coding club, teaching kids to code on weekends.", [
      "Said where you tutor.",
    ]),
    narrative: sampleSection(
      "vol1",
      "narrative",
      "On weekends, I volunteer as a tutor at a library coding club and teach kids to code.",
      ["First person, same facts."],
    ),
    professional: sampleSection("vol1", "professional", "Volunteer tutor at a library coding club, teaching coding to children on weekends.", ["Implied-subject sentence, no first person."]),
  },
};

/**
 * Intentional adversarial test: what a model might write when told to "sound more impressive".
 * Shown as a labeled fallback in the demo; the warnings match what FactCheck should flag.
 */
export const SAMPLE_ADVERSARIAL_REWRITE: RewriteResponse = {
  source: "sample",
  variations: [
    {
      style: "direct",
      styleWarnings: [],
      rewrite: {
        platform: "linkedin",
        content:
          "Software engineer who led the open-source data visualization library and improved model accuracy by 95% at Google. Led a team of 200 students as head teaching assistant.",
        usedFactIds: ["f2", "f3", "f9"],
        changeSummary: ["Intentionally embellished test case."],
      },
      warnings: [
        {
          kind: "unsupported_number",
          text: "95%",
          explanation: "This number does not appear in your original text or confirmed facts.",
        },
        {
          kind: "unsupported_number",
          text: "200",
          explanation: "This number does not appear in your original text or confirmed facts.",
        },
        {
          kind: "unsupported_entity",
          text: "Google",
          explanation: "This name does not appear in your original text or confirmed facts. (Heuristic check.)",
        },
        {
          kind: "inflated_verb",
          text: "led",
          explanation: "Your confirmed fact says \"contributed\"; \"led\" claims a stronger role.",
        },
        {
          kind: "invalid_fact_id",
          text: "f9",
          explanation: "The model cited a fact ID that does not exist.",
        },
        {
          kind: "unsupported_claim",
          text: "Software engineer who led the open-source data visualization library and improved model accuracy by 95% at Google",
          explanation:
            "Most of this sentence isn't traceable to your original text or confirmed facts. Review it before using it.",
        },
      ],
    },
  ],
};

// ---------- Hinge ----------

export const DEMO_HINGE_INPUT = [
  { prompt: "I'm weirdly good at", answer: "Finding the best food truck in any city." },
  { prompt: "A perfect Sunday", answer: "Making pancakes and then a long walk with no plan." },
];

export const DEMO_HINGE_SEGMENTS: Segment[] = segmentHinge(DEMO_HINGE_INPUT);

export const DEMO_HINGE_FACTS: IdentityFact[] = [
  { id: "h1", text: "I like finding good food trucks when I travel.", confirmed: true, source: "user" },
  { id: "h2", text: "I enjoy making pancakes on weekends.", confirmed: true, source: "user" },
  { id: "h3", text: "I like walking without a set plan.", confirmed: true, source: "user" },
];

/**
 * Intentional adversarial test for Hinge: what a model might write when told to "sound more impressive".
 * The UI shows it as a labeled sample; its warnings come from running the real FactCheck on it.
 */
export const SAMPLE_HINGE_ADVERSARIAL_CONTENT =
  "I have reviewed 50 food trucks across Europe as a professional food critic.\n\nI won a national pancake championship and led a hiking club every Sunday.";
