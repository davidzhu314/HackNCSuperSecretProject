import {
  LIMITS,
  TINDER_OPTIONS,
  type FieldFact,
  type IdentityFact,
  type LinkedInProfile,
  type Segment,
  type TinderChoiceField,
  type TinderFields,
  type TinderProfile,
} from "./schemas";
import { segmentHinge } from "./segments";
import { checkLength } from "./style-check";

// Tinder: About me, prompt answers, and profile fields. The user picks every field; the AI never
// fills, infers, or sees most of them. What reaches the AI is limited by construction:
// segmentTinder only carries About and the answers, and tinderFieldFacts only TINDER_AI_FIELDS.

/** Tinder's prompts, as the user gave them, with the dictation slips they confirmed fixed. */
export const TINDER_PROMPTS = [
  "Trust me on this…",
  "My friends would say I'm…",
  "I think it's super cringe when…",
  "If I'm not home, you can find me…",
  "Best first date in the city…",
  "My unhinged success story…",
  "I will cancel plans for…",
  "Where I go to feel like myself…",
  "My biggest red flag is…",
  "In my friend group, I'm the one who always…",
  "We're the same type of weirdo…",
  "I can't go a day without…",
  "I go crazy for…",
  "My sense of humor is basically just…",
  "When we meet, I'll tell you about the time I…",
  "Perks of dating me…",
  "On vacation I'm…",
  "My greatest hyperfixation is…",
  "I have the same energy as…",
  "On a night out, I'm the one who…",
  "The vibe I'm bringing to our first thing is…",
  "My villain story…",
  "The most authentic thing you can do for me is…",
  "I want to get more into…",
  "I can beat you in a game of…",
  "A hill I'll die on is…",
  "My biggest green flag is…",
  "I hype myself up by…",
  "I feel most like myself when…",
  "My ideal weekend includes…",
  "You should know I…",
  "I feel happiest when…",
  "A surprising thing about me is…",
  "Let's debate…",
  "Do you agree or disagree that…?",
  "My most chaotic daily habit is…",
  "My guilty pleasure is…",
  "My siblings tease me because…",
  "I'm the person my friends call when…",
  "My butterfly effect moment…",
  "My go-to karaoke song is…",
  "My hottest take is…",
] as const;

/** The About segment's "prompt", so the model and the receipts can tell it from the answers. */
export const TINDER_ABOUT_PROMPT = "About me";

/** The only profile fields that may reach the AI (rewrites only, never the evaluator). */
export const TINDER_AI_FIELDS = ["jobTitle", "company", "school", "languages"] as const;
export type TinderAiField = (typeof TINDER_AI_FIELDS)[number];

type FieldSpec =
  | { key: "jobTitle" | "company" | "school" | "livingIn"; label: string; kind: "text"; placeholder: string }
  | { key: "languages"; label: string; kind: "languages" }
  | { key: TinderChoiceField; label: string; kind: "one" | "many" };

/** The editor's groups, in display order. `many` fields allow several picks. */
export const TINDER_FIELD_GROUPS: { id: string; label: string; note: string; fields: FieldSpec[] }[] = [
  {
    id: "work",
    label: "Work & education",
    note: "Rewrites may mention these.",
    fields: [
      { key: "jobTitle", label: "Job title", kind: "text", placeholder: "e.g. Software engineer" },
      { key: "company", label: "Company", kind: "text", placeholder: "e.g. Tallowtree" },
      { key: "school", label: "School", kind: "text", placeholder: "e.g. Cedar Valley University" },
      { key: "languages", label: "Languages I know", kind: "languages" },
    ],
  },
  {
    id: "relationship",
    label: "Relationship",
    note: "Never sent to the AI.",
    fields: [
      { key: "openTo", label: "Open to", kind: "one" },
      { key: "relationshipType", label: "Relationship type", kind: "many" },
    ],
  },
  {
    id: "basics",
    label: "Basics",
    note: "Never sent to the AI.",
    fields: [
      { key: "zodiac", label: "Zodiac", kind: "one" },
      { key: "educationLevel", label: "Education", kind: "one" },
      { key: "children", label: "Children", kind: "one" },
      { key: "communicationStyle", label: "Communication style", kind: "one" },
      { key: "loveStyle", label: "How I receive love", kind: "one" },
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    note: "Never sent to the AI.",
    fields: [
      { key: "pets", label: "Pets", kind: "many" },
      { key: "drinking", label: "Drinking", kind: "one" },
      { key: "smoking", label: "Smoking", kind: "one" },
      { key: "cannabis", label: "420-friendly", kind: "one" },
      { key: "workout", label: "Workout", kind: "one" },
      { key: "socialMedia", label: "Social media", kind: "one" },
      { key: "goingOut", label: "Going out", kind: "one" },
    ],
  },
  {
    id: "location",
    label: "Location",
    note: "Never sent to the AI.",
    fields: [{ key: "livingIn", label: "Living in", kind: "text", placeholder: "City" }],
  },
];

export function tinderOptions(key: TinderChoiceField): readonly string[] {
  return TINDER_OPTIONS[key];
}

export function emptyTinderFields(): TinderFields {
  return {
    jobTitle: "",
    company: "",
    school: "",
    languages: [],
    livingIn: "",
    openTo: null,
    relationshipType: [],
    zodiac: null,
    educationLevel: null,
    children: null,
    communicationStyle: null,
    loveStyle: null,
    pets: [],
    drinking: null,
    smoking: null,
    cannabis: null,
    workout: null,
    socialMedia: null,
    goingOut: null,
  };
}

/** One empty prompt to start from, so the form always has something to fill in. */
export function emptyTinderProfile(): TinderProfile {
  return { about: "", prompts: [{ prompt: TINDER_PROMPTS[0], answer: "" }], fields: emptyTinderFields() };
}

/** "From your LinkedIn": the latest role, the latest school, and languages. Blank where LinkedIn has nothing. */
export function tinderFromLinkedIn(p: LinkedInProfile): Pick<TinderFields, TinderAiField> {
  const clip = (s: string | undefined) => (s ?? "").trim().slice(0, LIMITS.tinderField);
  const role = p.experience[0];
  return {
    jobTitle: clip(role?.title),
    company: clip(role?.organization),
    school: clip(p.education[0]?.organization),
    languages: (p.languages ?? []).map((l) => l.trim()).filter(Boolean).slice(0, LIMITS.maxLanguages),
  };
}

/**
 * Fill blank work fields from LinkedIn; never overwrite what the user typed. Returns the new fields
 * and which ones came from LinkedIn.
 */
export function carryOverFromLinkedIn(
  fields: TinderFields,
  p: LinkedInProfile,
): { fields: TinderFields; filled: TinderAiField[] } {
  const from = tinderFromLinkedIn(p);
  const next = { ...fields };
  const filled: TinderAiField[] = [];
  for (const key of TINDER_AI_FIELDS) {
    if (key === "languages") {
      if (!next.languages.length && from.languages.length) {
        next.languages = from.languages;
        filled.push(key);
      }
    } else if (!next[key].trim() && from[key]) {
      next[key] = from[key];
      filled.push(key);
    }
  }
  return { fields: next, filled };
}

/** Blank lines separate pieces in a rewrite, so the About keeps single line breaks only. */
const singleBreaks = (text: string) => text.replace(/\n\s*\n+/g, "\n").trim();

/**
 * What the AI reads: About me (one segment, prompt "About me") and each answered prompt (one
 * segment each, with its prompt). Profile fields and location are never segments.
 */
export function segmentTinder(t: TinderProfile): Segment[] {
  const about = singleBreaks(t.about);
  return segmentHinge([
    ...(about ? [{ prompt: TINDER_ABOUT_PROMPT, answer: about }] : []),
    ...t.prompts.map((p) => ({ prompt: p.prompt, answer: singleBreaks(p.answer) })),
  ]);
}

const FIELD_FACT_LABEL: Record<TinderAiField, string> = {
  jobTitle: "Job title",
  company: "Company",
  school: "School",
  languages: "Languages I know",
};

/** The work fields the user filled in, as source text for a rewrite and FactCheck. Nothing else. */
export function tinderFieldFacts(f: TinderFields): FieldFact[] {
  const out: FieldFact[] = [];
  for (const key of TINDER_AI_FIELDS) {
    const value = key === "languages" ? f.languages.map((l) => l.trim()).filter(Boolean).join(", ") : f[key].trim();
    if (value) out.push({ id: `p${out.length + 1}`, field: key, text: `${FIELD_FACT_LABEL[key]}: ${value}`.slice(0, LIMITS.factText) });
  }
  return out;
}

/** Field facts in the shape FactCheck and the receipts take. They are the user's own words. */
export function fieldFactsAsFacts(facts: FieldFact[]): IdentityFact[] {
  return facts.map((f) => ({ id: f.id, text: f.text, confirmed: true, source: "user" }));
}

/** Each piece's limit: About me has Tinder's 500; an answer has the (assumed) answer limit. */
export function tinderLimitFor(prompt: string | undefined): number {
  return prompt === TINDER_ABOUT_PROMPT ? LIMITS.tinderAbout : LIMITS.tinderAnswer;
}

/** Over-limit warnings for a Tinder rewrite: pieces in segment order, each against its own limit. */
export function checkTinderLength(pieces: string[], segments: Segment[]): ReturnType<typeof checkLength> {
  return pieces.flatMap((piece, i) => checkLength([piece], tinderLimitFor(segments[i]?.prompt), "Tinder"));
}

/** A rewrite edited as one text, one piece per blank-line block, back onto the segments it came from. */
export function piecesOntoSegments(text: string, segments: Segment[]): Segment[] {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim());
  return segments.map((s, i) => ({ ...s, text: blocks[i] || s.text }));
}

/** How many fields the user filled in (for the hub). */
export function filledFieldCount(f: TinderFields): number {
  return Object.values(f).filter((v) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== null)).length;
}
