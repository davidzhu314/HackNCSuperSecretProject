import type {
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

export const SAMPLE_EVALUATE: EvaluateResponse = {
  source: "sample",
  warnings: [],
  critiques: [
    {
      audience: "startup_founder",
      trait: "ownership_impact",
      rating: "weak",
      segmentIds: ["s3"],
      missingEvidence: false,
      rationale: "\"Experience with various projects\" does not say what was built or what the person did.",
      suggestion: "Name one project and your specific part in it.",
    },
    {
      audience: "technical_recruiter",
      trait: "technical_specificity",
      rating: "not_evident",
      segmentIds: [],
      missingEvidence: true,
      rationale: "No languages, tools, or technical work are mentioned anywhere in the text.",
      suggestion: "Add the technologies you have actually used, drawn from your confirmed facts.",
    },
    {
      audience: "research_lead",
      trait: "clarity",
      rating: "weak",
      segmentIds: ["s1", "s2"],
      missingEvidence: false,
      rationale: "The headline and opening use general phrases (\"passionate\", \"innovation\") that could describe anyone.",
      suggestion: "Lead with your field and one concrete thing you have done.",
    },
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
