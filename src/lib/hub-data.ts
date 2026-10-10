import { contentWords, stem } from "./fact-guard";
import type { IdentityFact } from "./schemas";

// TEMPORARY local stand-in for Person 1's contract (HANDOFF-PERSON-1.md), so the hub can be
// built now. When the contract PR lands, replace these types with the ones in schemas.ts,
// DEMO_HUB_PROFILE with DEMO_LINKEDIN_PROFILE from demo-data.ts, and factCoverageLocal with
// factCoverage from profile.ts. The shapes below match the contract exactly, so only imports change.

export type LinkedInSectionKind = "headline" | "about" | "experience" | "education" | "projects" | "volunteering";
export type ProfileEntry = {
  id: string;
  title: string;
  organization: string;
  dates?: string;
  location?: string;
  description: string;
};
export type LinkedInProfile = {
  headline: string;
  about: string;
  experience: ProfileEntry[];
  education: ProfileEntry[];
  projects: ProfileEntry[];
  volunteering: ProfileEntry[];
  skills: string[];
  honors: string[];
};
export type FactCoverage = {
  perFact: { factId: string; sectionKeys: string[] }[];
  summary: { confirmed: number; covered: number };
};

/** The fictitious demo persona's LinkedIn, by section. Deliberately vague up top, like the demo bio. */
export const DEMO_HUB_PROFILE: LinkedInProfile = {
  headline: "Aspiring tech professional | Passionate about innovation",
  about:
    "I am a motivated team player who is passionate about technology. I have experience with various projects and love learning new things. Looking for opportunities to grow and make an impact.",
  experience: [
    {
      id: "exp1",
      title: "Teaching Assistant, Intro to Programming",
      organization: "Fictional State University",
      dates: "Aug 2025 - Present",
      description: "- Held weekly lab hours for students in the programming course\n- Graded assignments",
    },
    {
      id: "exp2",
      title: "Open-source contributor",
      organization: "Data visualization library",
      dates: "2025",
      description: "- Contributed bug fixes and documentation",
    },
  ],
  education: [
    { id: "edu1", title: "B.S. Computer Science", organization: "Fictional State University", dates: "2022 - 2026", description: "" },
  ],
  projects: [
    { id: "proj1", title: "Course planner", organization: "Class project", description: "A web app for planning courses." },
  ],
  volunteering: [],
  skills: ["Python", "React"],
  honors: [],
};

export type HubSection = { key: string; label: string; text: string };

/** Every section a fact can appear in, in LinkedIn order. Titles and organizations count. */
export function profileSections(p: LinkedInProfile): HubSection[] {
  const entries = (kind: string, list: ProfileEntry[]) =>
    list.map((e) => ({
      key: e.id,
      label: `${kind} · ${e.title}`,
      text: [e.title, e.organization, e.description].filter(Boolean).join("\n"),
    }));
  return [
    { key: "headline", label: "Headline", text: p.headline },
    { key: "about", label: "About", text: p.about },
    ...entries("Experience", p.experience),
    ...entries("Education", p.education),
    ...entries("Projects", p.projects),
    ...entries("Volunteering", p.volunteering),
  ].filter((s) => s.text.trim());
}

/**
 * A confirmed fact "appears" in a section when at least half of its content words (and at least
 * two) are in that section. Same word matching as FactCheck. Real counts only: no scores.
 */
export function factCoverageLocal(p: LinkedInProfile, facts: IdentityFact[]): FactCoverage {
  const sections = profileSections(p).map((s) => ({ key: s.key, stems: new Set(contentWords(s.text).map(stem)) }));
  const confirmed = facts.filter((f) => f.confirmed && f.text.trim());
  const perFact = confirmed.map((f) => {
    const words = [...new Set(contentWords(f.text).map(stem))];
    const sectionKeys = sections
      .filter((s) => {
        const hits = words.filter((w) => s.stems.has(w)).length;
        return hits >= 2 && hits / words.length >= 0.5;
      })
      .map((s) => s.key);
    return { factId: f.id, sectionKeys };
  });
  return { perFact, summary: { confirmed: confirmed.length, covered: perFact.filter((x) => x.sectionKeys.length).length } };
}
