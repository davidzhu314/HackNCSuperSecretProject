import type { HingePair } from "./persona-ui";
import { PLATFORM_CONFIGS } from "./rubrics";
import type { LinkedInProfile, Platform } from "./schemas";
import { splitSentences } from "./segments";

// Consistency across platforms: deterministic checks that your profiles don't contradict each
// other. It compares a few claims that have one true value (your role at an organization, your
// school, graduation year, year in school, years of experience) wherever they appear. Patterns
// only, no model calls: a clean result means "no contradictions detected", not "consistent".

export type ConsistencyTopic = "role" | "school" | "graduation" | "year_in_school" | "experience";

export type Mention = { platform: Platform; value: string; quote: string };

export type Contradiction = { topic: ConsistencyTopic; label: string; mentions: Mention[] };

export const TOPIC_LABEL: Record<ConsistencyTopic, string> = {
  role: "Role",
  school: "School",
  graduation: "Graduation year",
  year_in_school: "Year in school",
  experience: "Years of experience",
};

export type ProfileTexts = {
  linkedin: LinkedInProfile | null;
  hinge: HingePair[] | null;
  bios: Partial<Record<Platform, string>>;
};

type Claim = { topic: ConsistencyTopic; key: string; value: string; quote: string; platform: Platform };

const NAME = "[A-Z][\\w&.'’-]*(?:\\s+(?:of\\s+)?[A-Z][\\w&.'’-]*){0,4}";
const ROLE_AT = new RegExp(`\\b((?:[A-Za-z][\\w-]*\\s+){0,3}[A-Za-z][\\w-]*)\\s+(?:at|@)\\s+(${NAME})`, "g");
const SCHOOL_AT = new RegExp(
  `\\b(?:student|studying|study|majoring|major|senior|junior|sophomore|freshman|graduate|alum(?:nus|na)?)\\b[^.!?\\n]*?\\b(?:at|from)\\s+(${NAME})`,
  "gi",
);
const GRAD_YEAR = /\b(?:class of|graduating(?: in)?|graduate in|grad(?:uating)? in|graduation(?: in)?)\s+(?:[A-Z][a-z]+\s+)?(20\d\d)\b/gi;
const YEAR_IN_SCHOOL = /\b(freshman|sophomore|junior|senior)\b(?!\s+(?:engineer|developer|designer|analyst|manager|scientist|associate|consultant))/gi;
const EXPERIENCE = /\b(\d{1,2})\+?\s+years?\s+(?:of\s+)?(?:professional\s+|work\s+|industry\s+)?experience\b/gi;

/** Role words that tell two titles apart ("intern" vs "engineer"). */
const ROLE_WORDS = [
  "intern", "engineer", "developer", "designer", "analyst", "manager", "scientist", "researcher", "founder",
  "assistant", "ta", "consultant", "lead", "director", "teacher", "tutor", "contributor", "volunteer",
  "president", "officer", "coordinator", "student", "professor",
];
const roleWordsOf = (title: string) => {
  const t = title.toLowerCase().replace(/teaching assistant/g, "ta");
  return ROLE_WORDS.filter((w) => new RegExp(`\\b${w}s?\\b`).test(t));
};

/** Words that start a capitalized phrase but aren't part of an organization's name. */
const LEADING_NOISE = /^(?:the|a|an)\s+/i;
const normName = (s: string) =>
  s.replace(LEADING_NOISE, "").replace(/[.,;:!?)]+$/, "").replace(/\s+/g, " ").trim().toLowerCase();

const quoteOf = (sentence: string) => (sentence.length > 110 ? sentence.slice(0, 107) + "…" : sentence);

/** Each platform's own text, as sentences. LinkedIn also contributes its structured entries. */
function textsOf(p: ProfileTexts): { platform: Platform; sentences: string[] }[] {
  const out: { platform: Platform; sentences: string[] }[] = [];
  if (p.linkedin) {
    const li = p.linkedin;
    const free = [li.headline, li.about, ...[...li.experience, ...li.education, ...li.projects, ...li.volunteering].map((e) => e.description)];
    out.push({ platform: "linkedin", sentences: free.flatMap((t) => splitSentences(t ?? "")) });
  }
  if (p.hinge) out.push({ platform: "hinge", sentences: p.hinge.flatMap((h) => splitSentences(h.answer)) });
  for (const [platform, bio] of Object.entries(p.bios) as [Platform, string | undefined][]) {
    if (bio?.trim() && platform !== "linkedin" && platform !== "hinge") out.push({ platform, sentences: splitSentences(bio) });
  }
  return out;
}

function claimsFromText(platform: Platform, sentence: string): Claim[] {
  const claims: Claim[] = [];
  const quote = quoteOf(sentence);
  for (const m of sentence.matchAll(ROLE_AT)) {
    const roles = roleWordsOf(m[1]);
    const org = normName(m[2]);
    if (roles.length && org) claims.push({ topic: "role", key: org, value: roles.join("/"), quote, platform });
  }
  for (const m of sentence.matchAll(SCHOOL_AT)) {
    const school = normName(m[1]);
    if (/universit|college|institute|school|academy/i.test(school))
      claims.push({ topic: "school", key: "school", value: school, quote, platform });
  }
  for (const m of sentence.matchAll(GRAD_YEAR)) claims.push({ topic: "graduation", key: "graduation", value: m[1], quote, platform });
  for (const m of sentence.matchAll(YEAR_IN_SCHOOL))
    claims.push({ topic: "year_in_school", key: "year", value: m[1].toLowerCase(), quote, platform });
  for (const m of sentence.matchAll(EXPERIENCE)) claims.push({ topic: "experience", key: "experience", value: m[1], quote, platform });
  return claims;
}

/** LinkedIn's structured entries: titles at organizations, schools, and graduation years. */
function claimsFromLinkedIn(li: LinkedInProfile): Claim[] {
  const claims: Claim[] = [];
  for (const e of [...li.experience, ...li.volunteering]) {
    const roles = roleWordsOf(e.title);
    if (roles.length && e.organization.trim())
      claims.push({ topic: "role", key: normName(e.organization), value: roles.join("/"), quote: `${e.title}, ${e.organization}`, platform: "linkedin" });
  }
  for (const e of li.education) {
    if (e.organization.trim())
      claims.push({ topic: "school", key: "school", value: normName(e.organization), quote: `${e.title}, ${e.organization}`, platform: "linkedin" });
    const years = (e.dates ?? "").match(/20\d\d/g);
    if (years && years.length > 1)
      claims.push({ topic: "graduation", key: "graduation", value: years[years.length - 1], quote: `${e.organization} · ${e.dates}`, platform: "linkedin" });
  }
  return claims;
}

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/**
 * Find claims that disagree across platforms. Disagreements within one platform aren't flagged
 * (a profile can list two roles at one place over time); only different platforms saying
 * different things about the same thing.
 */
export function findContradictions(p: ProfileTexts): Contradiction[] {
  const claims = [
    ...(p.linkedin ? claimsFromLinkedIn(p.linkedin) : []),
    ...textsOf(p).flatMap(({ platform, sentences }) => sentences.flatMap((s) => claimsFromText(platform, s))),
  ];
  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const k = `${c.topic}|${c.key}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }

  const out: Contradiction[] = [];
  for (const group of groups.values()) {
    const { topic, key } = group[0];
    const values = new Set(group.map((c) => c.value));
    const platforms = new Set(group.map((c) => c.platform));
    if (values.size < 2 || platforms.size < 2) continue;
    // Two platforms must disagree with each other, not just one platform with itself.
    const byPlatform = new Map<Platform, Set<string>>();
    for (const c of group) byPlatform.set(c.platform, new Set([...(byPlatform.get(c.platform) ?? []), c.value]));
    const sets = [...byPlatform.values()];
    const disagree = sets.some((a, i) => sets.slice(i + 1).some((b) => ![...a].some((v) => b.has(v))));
    if (!disagree) continue;
    // Role words that share any word ("TA" vs "TA/Assistant") are compatible.
    if (topic === "role") {
      const roleSets = sets.map((s) => new Set([...s].flatMap((v) => v.split("/"))));
      const compatible = roleSets.every((a, i) => roleSets.slice(i + 1).every((b) => [...a].some((r) => b.has(r))));
      if (compatible) continue;
    }
    const seen = new Set<string>();
    const mentions = group
      .filter((c) => {
        const k = `${c.platform}|${c.value}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map(({ platform, value, quote }) => ({ platform, value: topic === "school" || topic === "role" ? titleCase(value) : value, quote }));
    const label = topic === "role" ? `Your role at ${titleCase(key)}` : TOPIC_LABEL[topic];
    out.push({ topic, label, mentions });
  }
  return out;
}

/** Platforms with any text to compare, for "checked N platforms". */
export function platformsWithText(p: ProfileTexts): Platform[] {
  return textsOf(p)
    .filter((t) => t.sentences.length)
    .map((t) => t.platform)
    .filter((pl) => PLATFORM_CONFIGS[pl]);
}
