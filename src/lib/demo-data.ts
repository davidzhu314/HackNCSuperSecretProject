import type {
  AudienceCritique,
  EvaluateResponse,
  ExtractFactsResponse,
  IdentityFact,
  RewriteResponse,
  Segment,
} from "./schemas";
import { segmentHinge, segmentLinkedIn } from "./segments";

// Fictitious persona. Nothing here describes a real person.
// Every "sample" output below must be labeled "sample result" in the UI, never shown as a live run.

export const DEMO_PERSONA = { name: "Priya Nair (fictitious demo persona)" };

// ---------- LinkedIn ----------

export const DEMO_LINKEDIN_INPUT = {
  headline: "Aspiring tech professional | Passionate about innovation",
  about:
    "I am a motivated team player who is passionate about technology. I have experience with various projects and love learning new things. Looking for opportunities to grow and make an impact.",
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

export const SAMPLE_REWRITE: RewriteResponse = {
  source: "sample",
  warnings: [],
  rewrite: {
    platform: "linkedin",
    content:
      "Computer science senior | Python and React | Teaching assistant and open-source contributor\n\nI am a computer science senior who builds practical tools and enjoys explaining technical ideas to non-technical people. I built a course-planning web app with Python and React, contributed bug fixes and documentation to an open-source data visualization library, and was a teaching assistant for an introductory programming course.",
    usedFactIds: ["f1", "f2", "f3", "f4", "f5"],
    changeSummary: [
      "Replaced generic phrases with your confirmed projects and roles.",
      "Headline now states your field and tools instead of \"aspiring\" and \"passionate\".",
      "No numbers, employers, or dates were added.",
    ],
  },
};

/**
 * Intentional adversarial test: what a model might write when told to "sound more impressive".
 * Shown as a labeled fallback in the demo; the warnings match what FactCheck should flag.
 */
export const SAMPLE_ADVERSARIAL_REWRITE: RewriteResponse = {
  source: "sample",
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
