import { parseLinkedInPdf } from "./linkedin-pdf";
import { emptyLinkedInProfile } from "./profile";
import { LIMITS, LinkedInProfileSchema, type LinkedInProfile } from "./schemas";

// Turning an uploaded file into a LinkedIn profile, entirely in the browser. Nothing is sent.

export type ImportedProfile = { profile: LinkedInProfile; warnings: string[] };

/** Blank skill/honor lines are an editing artifact; drop them before segmenting or sending. */
export function cleanProfile(p: LinkedInProfile): LinkedInProfile {
  const list = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
  return { ...p, skills: list(p.skills), honors: list(p.honors) };
}

/**
 * Text files: a JSON LinkedInProfile, a JSON {headline, about} or {text}, or plain text
 * (first line = headline, the rest = About). Throws a readable Error on anything else.
 */
export function profileFromText(fileName: string, text: string): ImportedProfile {
  const warnings: string[] = [];
  let headline = "";
  let about = "";
  if (/\.json$/i.test(fileName)) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("That JSON file couldn’t be read.");
    }
    const full = LinkedInProfileSchema.safeParse(data);
    if (full.success) return { profile: full.data, warnings };
    const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    if (typeof d.headline === "string" || typeof d.about === "string") {
      headline = typeof d.headline === "string" ? d.headline : "";
      about = typeof d.about === "string" ? d.about : "";
    } else if (typeof d.text === "string" || typeof data === "string") {
      text = typeof data === "string" ? data : (d.text as string);
    } else {
      throw new Error("JSON needs a profile, headline/about, or a text field.");
    }
  }
  if (!about && !headline) {
    const lines = text.trim().split("\n");
    headline = (lines.shift() ?? "").trim();
    about = lines.join("\n").trim();
    if (!about) [about, headline] = [headline, ""];
    warnings.push("Plain text has no sections, so it was split into a headline (first line) and About. Add experience and other entries below.");
  }
  if (headline.length > LIMITS.headlineChars) {
    warnings.push(`The headline was cut to LinkedIn's ${LIMITS.headlineChars} characters.`);
    headline = headline.slice(0, LIMITS.headlineChars);
  }
  if (about.length > LIMITS.sectionText) {
    warnings.push(`About was cut to LinkedIn's ${LIMITS.sectionText.toLocaleString()} characters.`);
    about = about.slice(0, LIMITS.sectionText);
  }
  return { profile: { ...emptyLinkedInProfile(), headline, about }, warnings };
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Browser only. PDF goes through the LinkedIn parser; .txt/.md/.json through profileFromText. */
export async function importProfileFile(file: File): Promise<ImportedProfile> {
  if (file.size > MAX_FILE_BYTES) throw new Error("Choose a file under 20 MB.");
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    try {
      return await parseLinkedInPdf(file);
    } catch {
      throw new Error("That PDF couldn’t be read. Use LinkedIn’s “Save to PDF” export, or fill in the sections by hand.");
    }
  }
  if (!/\.(txt|md|json)$/i.test(file.name)) throw new Error("Choose a PDF, TXT, MD, or JSON file.");
  return profileFromText(file.name, await file.text());
}
