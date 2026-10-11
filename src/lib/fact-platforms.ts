import { MAX_HINGE_ANSWER, type HingePair } from "./persona-ui";
import type { IdentityFact, LinkedInProfile, Platform } from "./schemas";

// Write once, show up everywhere: one pool of confirmed facts, each shared with the platforms
// the user chooses. Kept outside the IdentityFact schema (UI state, never sent as such): the
// studio filters facts by platform before any rewrite or FactCheck, so a fact that isn't shared
// with a platform can't support a claim there.

export const PLATFORMS: Platform[] = ["linkedin", "hinge"];

/** fact id -> the platforms it's used on. Facts without an entry use `defaultPlatforms`. */
export type FactPlatforms = Record<string, Platform[]>;

/** Facts you typed are yours everywhere; anything else defaults to everywhere until recorded. */
export function platformsOf(fact: IdentityFact, map: FactPlatforms): Platform[] {
  return map[fact.id] ?? PLATFORMS;
}

/**
 * Record where newly found facts came from: an AI suggestion (or demo fact) found in your
 * LinkedIn is used on LinkedIn only, until you share it. Facts you typed stay on every platform.
 * Existing entries are kept.
 */
export function recordFoundOn(map: FactPlatforms, facts: IdentityFact[], platform: Platform, all = false): FactPlatforms {
  const next = { ...map };
  for (const f of facts) {
    if (next[f.id]) continue;
    if (all || f.source === "extracted") next[f.id] = [platform];
  }
  return next;
}

export function togglePlatform(map: FactPlatforms, fact: IdentityFact, platform: Platform): FactPlatforms {
  const current = platformsOf(fact, map);
  const on = current.includes(platform);
  return { ...map, [fact.id]: PLATFORMS.filter((p) => (p === platform ? !on : current.includes(p))) };
}

/** The confirmed facts shared with this platform: the only ones its rewrites and FactCheck may use. */
export function factsFor(platform: Platform, facts: IdentityFact[], map: FactPlatforms): IdentityFact[] {
  return facts.filter((f) => f.confirmed && f.text.trim() && platformsOf(f, map).includes(platform));
}

/**
 * "Start from my facts" on Hinge: fill empty answers with your own confirmed sentences, one per
 * prompt, as a first draft to edit. Answers you wrote are untouched; nothing new is written.
 */
export function seedHinge(pairs: HingePair[], facts: IdentityFact[]): HingePair[] {
  const written = new Set(pairs.map((p) => p.answer.trim().toLowerCase()));
  const queue = facts.map((f) => f.text.trim()).filter((t) => t && !written.has(t.toLowerCase()));
  return pairs.map((p) => (p.answer.trim() || !queue.length ? p : { ...p, answer: queue.shift()!.slice(0, MAX_HINGE_ANSWER) }));
}

/** "Start from my facts" on LinkedIn: an empty About becomes your confirmed sentences. */
export function seedLinkedIn(profile: LinkedInProfile, facts: IdentityFact[]): LinkedInProfile {
  if (profile.about.trim()) return profile;
  return { ...profile, about: facts.map((f) => f.text.trim()).filter(Boolean).join(" ") };
}
