import { contentStems, extractNumbers } from "./fact-guard";
import {
  ENTRY_ID_PREFIX,
  ENTRY_KINDS,
  LIMITS,
  profileCharCount,
  type EntrySectionKind,
  type IdentityFact,
  type LinkedInProfile,
  type ProfileEntry,
  type RewritableSection,
  type Segment,
} from "./schemas";
import { chunkText, splitSentences } from "./segments";

// A LinkedIn profile as sections. Pure functions shared by the UI and the API routes.
// Titles, organizations, and dates are kept verbatim; only free text is rewritten.
// Entry locations are never part of segments, so they never reach the AI.

export { profileCharCount };

const KIND_LABEL: Record<EntrySectionKind, string> = {
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  volunteering: "Volunteering",
};

export function emptyLinkedInProfile(): LinkedInProfile {
  return { headline: "", about: "", experience: [], education: [], projects: [], volunteering: [], skills: [], honors: [] };
}

/** Next free id for a new entry of this kind, e.g. "proj2". */
export function nextEntryId(p: LinkedInProfile, kind: EntrySectionKind): string {
  const prefix = ENTRY_ID_PREFIX[kind];
  const used = p[kind].map((e) => Number(e.id.slice(prefix.length))).filter(Number.isFinite);
  return `${prefix}${Math.max(0, ...used) + 1}`;
}

/** Entries in LinkedIn order: experience, education, projects, volunteering. */
function allEntries(p: LinkedInProfile): { kind: EntrySectionKind; entry: ProfileEntry }[] {
  return ENTRY_KINDS.flatMap((kind) => p[kind].map((entry) => ({ kind, entry })));
}

/** "Title · Organization · dates", whatever parts exist. Never includes location. */
function entryHeader(e: ProfileEntry): string {
  return [e.title, e.organization, e.dates].map((x) => x?.trim()).filter(Boolean).join(" · ");
}

/** "Experience · Agxes · Machine Learning Intern". */
function entryLabel(kind: EntrySectionKind, e: ProfileEntry): string {
  return [KIND_LABEL[kind], e.organization.trim(), e.title.trim()].filter(Boolean).join(" · ");
}

/** The parts a user can rewrite, in LinkedIn order. Empty ones are skipped. */
export function rewritableSections(p: LinkedInProfile): RewritableSection[] {
  const out: RewritableSection[] = [];
  if (p.headline.trim()) out.push({ key: "headline", kind: "headline", label: "Headline", text: p.headline.trim() });
  if (p.about.trim()) out.push({ key: "about", kind: "about", label: "About", text: p.about.trim() });
  for (const { kind, entry } of allEntries(p)) {
    if (entry.description.trim()) {
      out.push({ key: entry.id, kind, label: entryLabel(kind, entry), text: entry.description.trim() });
    }
  }
  return out;
}

/** Look up a rewritable section by key, using the profile's own text. */
export function findSection(p: LinkedInProfile, key: string): RewritableSection | undefined {
  return rewritableSections(p).find((s) => s.key === key);
}

const BULLET = /^\s*[-•·*–]\s*/;

/** Description lines and sentences, with bullet markers removed. */
function splitDescription(text: string): string[] {
  return splitSentences(text)
    .map((s) => s.replace(BULLET, "").trim())
    .filter(Boolean);
}

/** Section key -> the text pieces that become its segments, in order. */
function sectionPieces(p: LinkedInProfile): { key: string; pieces: string[] }[] {
  const out: { key: string; pieces: string[] }[] = [
    { key: "headline", pieces: p.headline.trim() ? [p.headline.trim()] : [] },
    { key: "about", pieces: splitSentences(p.about) },
  ];
  for (const { entry } of allEntries(p)) {
    const header = entryHeader(entry);
    // The header is always the entry's first segment, so entries without a description can be cited.
    out.push({ key: entry.id, pieces: [...(header ? [header] : []), ...splitDescription(entry.description)] });
  }
  out.push({ key: "skills", pieces: p.skills.length ? [p.skills.join(", ")] : [] });
  out.push({ key: "honors", pieces: p.honors.length ? [p.honors.join("; ")] : [] });
  return out;
}

/**
 * Number the profile's text for the model to cite. Ids are `${sectionKey}-s${n}`:
 * "headline-s1", "about-s3", "exp2-s1" (an entry's s1 is its title line). Skills and
 * honors are citable as "skills-s1" / "honors-s1" but are never rewritten.
 */
export function segmentProfile(p: LinkedInProfile): Segment[] {
  const segments: Segment[] = [];
  for (const { key, pieces } of sectionPieces(p)) {
    const chunks = pieces.flatMap(chunkText);
    chunks.forEach((text, i) => segments.push({ id: `${key}-s${i + 1}`, text }));
  }
  return segments.slice(0, LIMITS.maxSegments);
}

const SEGMENT_ID = /^(headline|about|skills|honors|(?:exp|edu|proj|vol)\d{1,3})-s\d+$/;

/** "exp2-s1" -> "exp2". Null for ids that aren't profile segment ids (e.g. legacy "s1"). */
export function sectionOfSegment(segmentId: string): string | null {
  return SEGMENT_ID.exec(segmentId)?.[1] ?? null;
}

/**
 * The original text FactCheck may accept as support for a rewrite of this section
 * (confirmed facts are added by FactCheck itself). Headline and About may summarize the
 * whole profile; an entry may only use its own text, so numbers and names can't hop
 * between jobs. Undefined for an unknown key.
 */
export function factCheckSegments(p: LinkedInProfile, sectionKey: string): Segment[] | undefined {
  const all = segmentProfile(p);
  if (sectionKey === "headline" || sectionKey === "about") return all;
  if (!allEntries(p).some(({ entry }) => entry.id === sectionKey)) return undefined;
  return all.filter((s) => sectionOfSegment(s.id) === sectionKey);
}

// ---------- fact coverage (for the hub) ----------

/** Share of a fact's content words that must appear in a section for it to count as covered. */
const COVERAGE_THRESHOLD = 0.6;

function covers(factText: string, sectionText: string, sectionStems: Set<string>): boolean {
  const stems = [...new Set(contentStems(factText))];
  if (!stems.length) return false;
  const numbers = extractNumbers(factText).map((n) => n.key);
  const sectionNumbers = new Set(extractNumbers(sectionText).map((n) => n.key));
  if (!numbers.every((n) => sectionNumbers.has(n))) return false;
  return stems.filter((s) => sectionStems.has(s)).length / stems.length >= COVERAGE_THRESHOLD;
}

/**
 * Where each confirmed fact shows up on the profile. Deterministic word overlap
 * (stemmed content words, plus every number in the fact), so the counts are real
 * but approximate: a fact phrased very differently on the profile is not counted.
 */
export function factCoverage(
  p: LinkedInProfile,
  facts: IdentityFact[],
): { perFact: { factId: string; sectionKeys: string[] }[]; summary: { confirmed: number; covered: number } } {
  const sections = sectionPieces(p)
    .filter((s) => s.pieces.length)
    .map(({ key, pieces }) => {
      const text = pieces.join("\n");
      return { key, text, stems: new Set(contentStems(text)) };
    });
  const perFact = facts
    .filter((f) => f.confirmed)
    .map((f) => ({
      factId: f.id,
      sectionKeys: sections.filter((s) => covers(f.text, s.text, s.stems)).map((s) => s.key),
    }));
  return {
    perFact,
    summary: { confirmed: perFact.length, covered: perFact.filter((f) => f.sectionKeys.length).length },
  };
}
