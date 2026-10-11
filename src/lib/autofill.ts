import type { IdentitySession } from "./identity-session";
import { emptyHingePairs, MAX_HINGE_ANSWER, type HingePair } from "./persona-ui";
import { emptyLinkedInProfile, nextEntryId, segmentProfile } from "./profile";
import { PLATFORM_CONFIGS } from "./rubrics";
import {
  LIMITS,
  type Draft,
  type DraftSlot,
  type IdentityFact,
  type LinkedInProfile,
  type Platform,
  type PlatformGroup,
  type Segment,
  type TinderProfile,
} from "./schemas";
import { segmentBio, segmentHinge, splitSentences } from "./segments";
import { carryOverFromLinkedIn, emptyTinderProfile, segmentTinder, tinderFieldFacts, type TinderAiField } from "./tinder";

// Write once, fill in everywhere: one platform's empty spots filled from what the user entered on
// the others. No AI here: only the user's own sentences, confirmed facts, and shared fields (job,
// company, school, languages), each kept whole and fitted to the platform's limit. Nothing the user
// typed is ever overwritten. The AI version ("Draft with AI") lives in /api/draft and uses
// `draftSources` below, which sends nothing the studio wouldn't send anyway.

/** What the other platforms hold, as the session stores it. */
export type ProfileSources = Pick<IdentitySession, "linkedin" | "hinge" | "tinder" | "bios">;

/** One sentence of the user's own, and where it came from. */
/** `identity`: a line built from the user's own role or school entry ("Teaching Assistant at Calder Valley University."). */
export type SourceSentence = {
  text: string;
  from: Platform | "facts";
  group: PlatformGroup | "facts";
  kind: "text" | "answer" | "identity";
};

export type Fill<T> = { value: T; notes: string[] };

const LABEL = (from: Platform | "facts") => (from === "facts" ? "your facts" : PLATFORM_CONFIGS[from].label);

/** Every sentence the user wrote on the other platforms, plus confirmed facts shared with `target`. */
export function sourceSentences(s: ProfileSources, target: Platform, facts: IdentityFact[]): SourceSentence[] {
  const out: SourceSentence[] = [];
  const add = (from: Platform, texts: string[], kind: SourceSentence["kind"] = "text") => {
    if (from === target) return;
    // Identity lines stay whole: "B.S. Computer Science, ..." isn't two sentences.
    // One-word pieces ("B.S." split off a degree) aren't sentences.
    const pieces = kind === "identity" ? texts.filter((t) => t.trim()) : texts.flatMap(splitSentences).filter((t) => /\S\s+\S/.test(t));
    for (const t of pieces) out.push({ text: t, from, group: PLATFORM_CONFIGS[from].group, kind });
  };
  if (s.linkedin) {
    add("linkedin", [s.linkedin.headline, s.linkedin.about]);
    const role = s.linkedin.experience[0];
    const school = s.linkedin.education[0];
    add("linkedin", [roleLine(role?.title, role?.organization), roleLine(school?.title, school?.organization, ", ")], "identity");
  }
  for (const [p, bio] of Object.entries(s.bios) as [Platform, string | undefined][]) if (bio?.trim()) add(p, [bio]);
  if (s.tinder) {
    const f = s.tinder.fields;
    add("tinder", [roleLine(f.jobTitle, f.company), roleLine("", f.school)], "identity");
    add("tinder", [s.tinder.about]);
    add("tinder", s.tinder.prompts.map((p) => p.answer), "answer");
  }
  if (s.hinge) add("hinge", s.hinge.map((p) => p.answer), "answer");
  for (const f of facts) if (f.confirmed && f.text.trim()) out.push({ text: f.text.trim(), from: "facts", group: "facts", kind: "text" });
  return out;
}

const normalize = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** "Title at Organization." from the user's own entry; empty when there's no title or organization. */
function roleLine(title = "", organization = "", joiner = " at "): string {
  const t = title.trim();
  const o = organization.trim();
  if (!t && !o) return "";
  const line = t && o ? `${t}${joiner}${o}` : t || o;
  return /[.!?]$/.test(line) ? line : `${line}.`;
}

/**
 * Which sentences suit a platform, best first. A professional profile takes only professional text
 * and facts (no pancakes on LinkedIn); social and dating ones share casual text, but a prompt
 * answer only makes sense on another prompt platform. Duplicates and sentences already in the
 * target are dropped.
 */
export function rankFor(target: Platform, sentences: SourceSentence[], existing = ""): SourceSentence[] {
  const group = PLATFORM_CONFIGS[target].group;
  const prompts = PLATFORM_CONFIGS[target].input === "prompts" || PLATFORM_CONFIGS[target].input === "tinder";
  const rank = (s: SourceSentence): number => {
    if (s.kind === "answer" && !prompts) return -1;
    // A role or school line is plain identity: fine on any platform, after the platform's own kind of text.
    if (s.kind === "identity") return s.group === group ? 0 : 1;
    if (s.group === group) return 0;
    if (s.group === "facts") return 1;
    if (group !== "professional" && s.group !== "professional") return 2;
    return -1;
  };
  // Skip anything already said: the same sentence, or one contained in a sentence already there or picked.
  const seen = splitSentences(existing).map(normalize);
  return sentences
    .map((s, i) => ({ s, r: rank(s), i }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s)
    .filter((s) => {
      const key = normalize(s.text);
      if (!key || seen.some((k) => k.includes(key))) return false;
      seen.push(key);
      return true;
    });
}

/** Take whole sentences, in order, while they fit `limit` characters. Removes the used ones from `pool`. */
function take(pool: SourceSentence[], limit: number): SourceSentence[] {
  const used: SourceSentence[] = [];
  let length = 0;
  for (let i = 0; i < pool.length; ) {
    const add = [...pool[i].text].length + (used.length ? 1 : 0);
    if (length + add <= limit) {
      used.push(pool[i]);
      length += add;
      pool.splice(i, 1);
    } else i++;
  }
  return used;
}

/** What can answer a prompt: another prompt's answer first, then a confirmed fact. Never a role line or bio text. */
const answerPool = (pool: SourceSentence[]) => {
  const answers = pool.filter((x) => x.kind === "answer");
  return answers.length ? answers : pool.filter((x) => x.from === "facts");
};

const join = (used: SourceSentence[]) => used.map((s) => s.text).join(" ");
const fromNote = (what: string, used: SourceSentence[]) =>
  `${what}: from ${[...new Set(used.map((s) => LABEL(s.from)))].join(", ")}`;

/** A bio platform (Handshake, Instagram, Facebook): an empty bio becomes whole sentences that fit its limit. */
export function fillBio(target: Platform, bio: string, sentences: SourceSentence[]): Fill<string> {
  if (bio.trim()) return { value: bio, notes: [] };
  const config = PLATFORM_CONFIGS[target];
  const used = take(rankFor(target, sentences), config.maxChars ?? LIMITS.sectionText);
  return used.length ? { value: join(used), notes: [fromNote(config.fieldLabel, used)] } : { value: bio, notes: [] };
}

/** Hinge: each empty answer gets one sentence that fits. Prompts stay as chosen. */
export function fillHinge(pairs: HingePair[], sentences: SourceSentence[]): Fill<HingePair[]> {
  const pool = rankFor("hinge", sentences, pairs.map((p) => p.answer).join("\n"));
  const used: SourceSentence[] = [];
  const value = pairs.map((p) => {
    if (p.answer.trim()) return p;
    const s = answerPool(pool).find((x) => [...x.text].length <= MAX_HINGE_ANSWER);
    if (!s) return p;
    pool.splice(pool.indexOf(s), 1);
    used.push(s);
    return { ...p, answer: s.text };
  });
  return { value, notes: used.length ? [fromNote(`${used.length} ${used.length === 1 ? "answer" : "answers"}`, used)] : [] };
}

/** Tinder: blank work fields from LinkedIn, an empty About me, then empty prompt answers. */
export function fillTinder(
  t: TinderProfile,
  sentences: SourceSentence[],
  linkedin: LinkedInProfile | null,
): Fill<TinderProfile> & { fromLinkedIn: TinderAiField[] } {
  const notes: string[] = [];
  let fields = t.fields;
  let fromLinkedIn: TinderAiField[] = [];
  if (linkedin) {
    const carried = carryOverFromLinkedIn(t.fields, linkedin);
    fields = carried.fields;
    fromLinkedIn = carried.filled;
    if (fromLinkedIn.length) notes.push(`${fromLinkedIn.length} work ${fromLinkedIn.length === 1 ? "field" : "fields"}: from LinkedIn`);
  }
  const pool = rankFor("tinder", sentences, [t.about, ...t.prompts.map((p) => p.answer)].join("\n"));
  // Answers first, from other prompt answers where there are any, so About doesn't use them all up.
  const answered: SourceSentence[] = [];
  const prompts = t.prompts.map((p) => {
    if (p.answer.trim()) return p;
    const s = answerPool(pool).find((x) => [...x.text].length <= LIMITS.tinderAnswer);
    if (!s) return p;
    pool.splice(pool.indexOf(s), 1);
    answered.push(s);
    return { ...p, answer: s.text };
  });
  let about = t.about;
  if (!about.trim()) {
    const used = take(pool.filter((x) => x.kind !== "answer"), LIMITS.tinderAbout);
    if (used.length) {
      about = join(used);
      notes.push(fromNote("About me", used));
    }
  }
  if (answered.length) notes.push(fromNote(`${answered.length} ${answered.length === 1 ? "answer" : "answers"}`, answered));
  return { value: { about, prompts, fields }, notes, fromLinkedIn };
}

/**
 * LinkedIn: an empty About from professional text and facts; a missing role, school, or languages
 * from Tinder's work fields (the user's own entries); a headline from the role ("Title at Company").
 */
export function fillLinkedIn(p: LinkedInProfile, sentences: SourceSentence[], tinder: TinderProfile | null): Fill<LinkedInProfile> {
  const notes: string[] = [];
  let next = p;
  const f = tinder?.fields;
  if (f && !next.experience.length && f.jobTitle.trim()) {
    const entry = { id: nextEntryId(next, "experience"), title: f.jobTitle.trim(), organization: f.company.trim(), description: "" };
    next = { ...next, experience: [entry] };
    notes.push("Experience: your role from Tinder");
  }
  if (f && !next.education.length && f.school.trim()) {
    next = { ...next, education: [{ id: nextEntryId(next, "education"), title: "", organization: f.school.trim(), description: "" }] };
    notes.push("Education: your school from Tinder");
  }
  if (f && !next.languages?.length && f.languages.length) {
    next = { ...next, languages: [...f.languages] };
    notes.push("Languages: from Tinder");
  }
  const role = next.experience[0];
  if (!next.headline.trim() && role?.title.trim()) {
    const headline = role.organization.trim() ? `${role.title.trim()} at ${role.organization.trim()}` : role.title.trim();
    next = { ...next, headline: headline.slice(0, LIMITS.headlineChars) };
    notes.push("Headline: your role");
  }
  if (!next.about.trim()) {
    // A first draft for About, not all 2,600 characters: a few sentences to edit.
    const used = take(rankFor("linkedin", sentences, next.headline), 600);
    if (used.length) {
      next = { ...next, about: join(used) };
      notes.push(fromNote("About", used));
    }
  }
  return { value: next, notes };
}

/** Has the user entered anything on this platform? (Tinder counts its fields.) */
export function hasProfile(platform: Platform, s: ProfileSources): boolean {
  switch (platform) {
    case "linkedin":
      return !!s.linkedin && segmentProfile(s.linkedin).length > 0;
    case "hinge":
      return !!s.hinge?.some((p) => p.answer.trim());
    case "tinder":
      return !!s.tinder && (segmentTinder(s.tinder).length > 0 || tinderFieldFacts(s.tinder.fields).length > 0);
    default:
      return !!s.bios[platform]?.trim();
  }
}

/** How many empty spots "Fill from my other profiles" could fill now; 0 hides the button. */
export function canFill(target: Platform, s: ProfileSources, facts: IdentityFact[]): boolean {
  const sentences = sourceSentences(s, target, facts);
  switch (target) {
    case "linkedin":
      return fillLinkedIn(s.linkedin ?? emptyLinkedInProfile(), sentences, s.tinder).notes.length > 0;
    case "hinge":
      return fillHinge(s.hinge ?? emptyHingePairs(), sentences).notes.length > 0;
    case "tinder":
      return fillTinder(s.tinder ?? emptyTinderProfile(), sentences, s.linkedin).notes.length > 0;
    default:
      return fillBio(target, s.bios[target] ?? "", sentences).notes.length > 0;
  }
}

// ---------- For "Draft with AI": what the model may read ----------

const SOURCE_PREFIX: Record<Platform, string> = { linkedin: "li", handshake: "hs", instagram: "ig", facebook: "fb", hinge: "hi", tinder: "ti" };

/**
 * The user's text on every platform as segments, labeled by platform: the same text the studio
 * already sends for that platform (LinkedIn without locations, Tinder without its profile fields).
 */
export function draftSources(s: ProfileSources): Segment[] {
  const label = (p: Platform, seg: Segment): Segment => ({
    ...seg,
    id: `${SOURCE_PREFIX[p]}-${seg.id}`.slice(0, 16),
    prompt: (seg.prompt ? `${PLATFORM_CONFIGS[p].label}: ${seg.prompt}` : PLATFORM_CONFIGS[p].label).slice(0, 200),
  });
  const out: Segment[] = [];
  if (s.linkedin) out.push(...segmentProfile(s.linkedin).map((x) => label("linkedin", x)));
  for (const [p, bio] of Object.entries(s.bios) as [Platform, string | undefined][]) {
    if (bio?.trim() && PLATFORM_CONFIGS[p].input === "bio") out.push(...segmentBio(bio).map((x) => label(p, x)));
  }
  if (s.hinge) out.push(...segmentHinge(s.hinge).map((x) => label("hinge", x)));
  if (s.tinder) out.push(...segmentTinder(s.tinder).map((x) => label("tinder", x)));
  return out.slice(0, LIMITS.maxSegments);
}

/** Tinder's work fields, the only profile fields a draft may use. */
export function draftFieldFacts(s: ProfileSources) {
  return s.tinder ? tinderFieldFacts(s.tinder.fields) : [];
}

// ---------- One entry point per platform's state ----------

export type TargetState =
  | { kind: "linkedin"; value: LinkedInProfile }
  | { kind: "bio"; platform: Platform; value: string }
  | { kind: "hinge"; value: HingePair[] }
  | { kind: "tinder"; value: TinderProfile };

/** "Fill from my other profiles" (no AI) for whichever platform is open. */
export function fillTarget(
  t: TargetState,
  s: ProfileSources,
  facts: IdentityFact[],
): { state: TargetState; notes: string[]; fromLinkedIn: TinderAiField[] } {
  const target: Platform = t.kind === "bio" ? t.platform : t.kind;
  const sentences = sourceSentences(s, target, facts);
  switch (t.kind) {
    case "linkedin": {
      const r = fillLinkedIn(t.value, sentences, s.tinder);
      return { state: { ...t, value: r.value }, notes: r.notes, fromLinkedIn: [] };
    }
    case "bio": {
      const r = fillBio(t.platform, t.value, sentences);
      return { state: { ...t, value: r.value }, notes: r.notes, fromLinkedIn: [] };
    }
    case "hinge": {
      const r = fillHinge(t.value, sentences);
      return { state: { ...t, value: r.value }, notes: r.notes, fromLinkedIn: [] };
    }
    case "tinder": {
      const r = fillTinder(t.value, sentences, s.linkedin);
      return { state: { ...t, value: r.value }, notes: r.notes, fromLinkedIn: r.fromLinkedIn };
    }
  }
}

/** The empty spots an AI draft may fill. LinkedIn entries are structure, not drafts, so only headline and About. */
export function draftSlots(t: TargetState): DraftSlot[] {
  switch (t.kind) {
    case "linkedin":
      return [
        ...(t.value.headline.trim() ? [] : [{ id: "headline", label: "Headline", maxChars: LIMITS.headlineChars }]),
        ...(t.value.about.trim() ? [] : [{ id: "about", label: "About", maxChars: 1000 }]),
      ];
    case "bio": {
      const config = PLATFORM_CONFIGS[t.platform];
      return t.value.trim() ? [] : [{ id: "bio", label: config.fieldLabel, maxChars: config.maxChars ?? 1000 }];
    }
    case "hinge":
      return t.value.flatMap((p, i) => (p.answer.trim() ? [] : [{ id: `a${i}`, label: `Answer ${i + 1}`, prompt: p.prompt, maxChars: MAX_HINGE_ANSWER }]));
    case "tinder":
      return [
        ...(t.value.about.trim() ? [] : [{ id: "about", label: "About me", maxChars: LIMITS.tinderAbout }]),
        ...t.value.prompts.flatMap((p, i) =>
          p.answer.trim() ? [] : [{ id: `a${i}`, label: `Answer ${i + 1}`, prompt: p.prompt, maxChars: LIMITS.tinderAnswer }],
        ),
      ];
  }
}

/** Put drafts into the spots that are still empty (the user may have typed while it ran). */
export function applyDrafts(t: TargetState, drafts: Draft[]): TargetState {
  const text = (id: string) => drafts.find((d) => d.slotId === id)?.text.trim() ?? "";
  const or = (current: string, id: string) => (current.trim() ? current : text(id) || current);
  switch (t.kind) {
    case "linkedin":
      return { ...t, value: { ...t.value, headline: or(t.value.headline, "headline"), about: or(t.value.about, "about") } };
    case "bio":
      return { ...t, value: or(t.value, "bio") };
    case "hinge":
      return { ...t, value: t.value.map((p, i) => ({ ...p, answer: or(p.answer, `a${i}`) })) };
    case "tinder":
      return {
        ...t,
        value: { ...t.value, about: or(t.value.about, "about"), prompts: t.value.prompts.map((p, i) => ({ ...p, answer: or(p.answer, `a${i}`) })) },
      };
  }
}
