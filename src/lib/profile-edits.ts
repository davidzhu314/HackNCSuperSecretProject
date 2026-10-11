import type { HingePair } from "./persona-ui";
import { emptyLinkedInProfile, factCoverage, rewritableSections } from "./profile";
import { ENTRY_KINDS, type IdentityFact, type LinkedInProfile } from "./schemas";

// Using a rewrite: writing a section's accepted text back into the profile, undoing it, and
// reading what changed. Pure functions; the studio keeps the pre-rewrite profile as the
// "original" so FactCheck keeps checking against the user's own words.

/** The free text of a rewritable section (headline, About, or an entry's description). */
export function sectionText(p: LinkedInProfile, key: string): string | undefined {
  if (key === "headline") return p.headline;
  if (key === "about") return p.about;
  for (const kind of ENTRY_KINDS) {
    const entry = p[kind].find((e) => e.id === key);
    if (entry) return entry.description;
  }
  return undefined;
}

/** A copy of the profile with one section's free text replaced. Unknown keys change nothing. */
export function withSectionText(p: LinkedInProfile, key: string, text: string): LinkedInProfile {
  if (key === "headline") return { ...p, headline: text };
  if (key === "about") return { ...p, about: text };
  for (const kind of ENTRY_KINDS) {
    if (p[kind].some((e) => e.id === key)) {
      return { ...p, [kind]: p[kind].map((e) => (e.id === key ? { ...e, description: text } : e)) };
    }
  }
  return p;
}

/** Keys of the sections whose text differs between the original and the current profile. */
export function changedSections(original: LinkedInProfile, current: LinkedInProfile): string[] {
  const keys = new Set([...rewritableSections(original), ...rewritableSections(current)].map((s) => s.key));
  return [...keys].filter((k) => (sectionText(original, k) ?? "").trim() !== (sectionText(current, k) ?? "").trim());
}

/** The rewritable sections as plain text ("Headline\n…\n\nAbout\n…"), for copying in one go. */
export function profileAsText(p: LinkedInProfile): string {
  return rewritableSections(p)
    .map((s) => `${s.label}\n${s.text}`)
    .join("\n\n");
}

/**
 * Which confirmed facts appear in the Hinge answers, by the same deterministic word overlap as
 * the LinkedIn coverage (the answers are treated as one block of text). Real but approximate.
 */
export function hingeFactIds(pairs: HingePair[] | null, facts: IdentityFact[]): Set<string> {
  const about = (pairs ?? []).map((p) => p.answer.trim()).filter(Boolean).join("\n");
  if (!about) return new Set();
  const coverage = factCoverage({ ...emptyLinkedInProfile(), about }, facts);
  return new Set(coverage.perFact.filter((f) => f.sectionKeys.length).map((f) => f.factId));
}
