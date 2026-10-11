import type { IdentitySession } from "./identity-session";
import { PLATFORM_CONFIGS, PLATFORM_GROUPS } from "./rubrics";
import { LIMITS, type Platform, type TinderFields } from "./schemas";
import { TINDER_AI_FIELDS } from "./tinder";

// The Hub's "Your digital identity": how much of each profile is filled in, as a checklist counted
// by code from what the user entered. Real counts only (done of total), never a quality score or a
// prediction: a part is done when it has text (and, for one-field bios, fits the platform's limit).

export type ChecklistItem = { label: string; done: boolean };

/** What's missing, in words: "Experience, Skills", with prompt answers grouped ("2 prompt answers"). */
export function missingSummary(items: ChecklistItem[]): string {
  const missing = items.filter((i) => !i.done).map((i) => i.label);
  const answers = missing.filter((l) => l.startsWith("Prompt answer")).length;
  const rest = missing.filter((l) => !l.startsWith("Prompt answer"));
  return [...(answers ? [`${answers} prompt ${answers === 1 ? "answer" : "answers"}`] : []), ...rest].join(", ");
}
export type PlatformProgress = { platform: Platform; items: ChecklistItem[]; done: number; total: number };
export type IdentityProgress = { platforms: PlatformProgress[]; done: number; total: number };

type Sources = Pick<IdentitySession, "linkedin" | "hinge" | "tinder" | "bios">;

const has = (text: string | undefined | null) => !!text?.trim();

/** A Tinder pick other than the work fields: relationship, basics, lifestyle, or location. */
const hasPick = (f: TinderFields) =>
  Object.entries(f).some(
    ([key, value]) =>
      !(TINDER_AI_FIELDS as readonly string[]).includes(key) &&
      (Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim() !== "" : value !== null),
  );

function itemsFor(platform: Platform, s: Sources): ChecklistItem[] {
  const config = PLATFORM_CONFIGS[platform];
  switch (config.input) {
    case "sections": {
      const p = s.linkedin;
      return [
        { label: "Headline", done: has(p?.headline) },
        { label: "About", done: has(p?.about) },
        { label: "Experience", done: !!p?.experience.some((e) => has(e.title) || has(e.organization)) },
        { label: "Education", done: !!p?.education.some((e) => has(e.organization)) },
        { label: "Skills", done: !!p?.skills.some(has) },
      ];
    }
    case "prompts": {
      const answered = s.hinge?.filter((p) => has(p.answer)).length ?? 0;
      return [1, 2, 3].map((n) => ({ label: `Prompt answer ${n}`, done: answered >= n }));
    }
    case "tinder": {
      const t = s.tinder;
      const answered = t?.prompts.filter((p) => has(p.answer)).length ?? 0;
      const f = t?.fields;
      return [
        { label: "About me", done: has(t?.about) && [...(t?.about ?? "")].length <= LIMITS.tinderAbout },
        ...Array.from({ length: LIMITS.maxTinderPrompts }, (_, i) => ({ label: `Prompt answer ${i + 1}`, done: answered > i })),
        { label: "Job or school", done: !!f && (has(f.jobTitle) || has(f.company) || has(f.school)) },
        // Any pick beyond the work fields counts; which ones (if any) is the user's call.
        { label: "Profile fields", done: !!f && hasPick(f) },
      ];
    }
    case "bio": {
      const bio = s.bios[platform];
      const limit = config.maxChars;
      // One part: written, and within the limit (an over-long bio says so).
      const over = !!limit && has(bio) && [...bio!.trim()].length > limit;
      return [{ label: over ? `${config.fieldLabel} under ${limit} characters` : config.fieldLabel, done: has(bio) && !over }];
    }
  }
}

/** Every platform, in the Hub's order, with what's done and what's missing. */
export function identityProgress(s: Sources): IdentityProgress {
  const platforms = PLATFORM_GROUPS.flatMap((g) => g.platforms).map((platform) => {
    const items = itemsFor(platform, s);
    return { platform, items, done: items.filter((i) => i.done).length, total: items.length };
  });
  return {
    platforms,
    done: platforms.reduce((n, p) => n + p.done, 0),
    total: platforms.reduce((n, p) => n + p.total, 0),
  };
}
