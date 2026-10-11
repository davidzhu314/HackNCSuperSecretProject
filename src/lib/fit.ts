import { PLATFORM_CONFIGS, PLATFORM_GROUPS } from "./rubrics";
import { LIMITS, type Platform } from "./schemas";

// "Where it fits": the same text measured against every platform's own character limit, and
// where it would be cut. Real limits only (rubrics.ts maxChars; LinkedIn's About from LIMITS).
// Counted in characters as people see them (code points), like the bio editor's counter.

export type PlatformFit = {
  platform: Platform;
  label: string;
  field: string;
  limit: number;
  length: number;
  fits: boolean;
  /** What survives the cut (to the last whole word under the limit), when it doesn't fit. */
  kept?: string;
  /** What gets cut. */
  cut?: string;
};

/** The field and limit compared for each platform. Hinge's limit is per prompt answer. */
export function fieldLimit(platform: Platform): { field: string; limit: number } {
  if (platform === "linkedin") return { field: "About", limit: LIMITS.sectionText };
  const config = PLATFORM_CONFIGS[platform];
  return { field: platform === "hinge" ? "One answer" : config.fieldLabel, limit: config.maxChars ?? LIMITS.sectionText };
}

export function fitText(text: string, platform: Platform): PlatformFit {
  const { field, limit } = fieldLimit(platform);
  const chars = [...text.trim()];
  const base = { platform, label: PLATFORM_CONFIGS[platform].label, field, limit, length: chars.length };
  if (chars.length <= limit) return { ...base, fits: true };
  const head = chars.slice(0, limit).join("");
  const space = head.lastIndexOf(" ");
  const keptRaw = space > limit * 0.6 ? head.slice(0, space) : head;
  const kept = keptRaw.trimEnd();
  return { ...base, fits: false, kept, cut: chars.join("").slice(kept.length).trimStart() };
}

/** Every platform, in the home page's order. */
export function fitAcross(text: string): PlatformFit[] {
  return PLATFORM_GROUPS.flatMap((g) => g.platforms).map((p) => fitText(text, p));
}
