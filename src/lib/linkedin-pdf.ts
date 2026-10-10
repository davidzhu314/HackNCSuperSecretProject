import { emptyLinkedInProfile } from "./profile";
import { ENTRY_ID_PREFIX, LIMITS, profileCharCount, type EntrySectionKind, type LinkedInProfile, type ProfileEntry } from "./schemas";

// LinkedIn "Save to PDF" import. Runs in the browser, so nothing leaves the device before consent.
//
// The export is a fixed template, and text extraction alone can't tell a sidebar award from
// the person's name, so parsing works on lines with their font size and x position:
//   sidebar (left, x small): 13pt headings (Contact, Top Skills, Honors-Awards...), 10.5pt items
//   main column: 26pt name, 12pt headline + location, 15.8pt section headings,
//   12pt organization, 11.5pt title, 10.5pt dates / location / "·" bullets, 9pt "Page 1 of 3" footer.
// Name, contact details, URLs, and the person's location are dropped here and never stored.

export type ParsedLinkedIn = { profile: LinkedInProfile; warnings: string[] };

/** One visual line of the PDF. `y` grows upward (PDF coordinates). */
export type PdfLine = { text: string; size: number; x: number; y: number; page: number };

/** The subset of a pdfjs TextItem used here. */
export type PdfTextItem = { str: string; hasEOL: boolean; transform: number[]; height: number };

// Font-size bands (points), with tolerance around the template's sizes.
const SIZE = {
  footerMax: 9.5,
  name: 20,
  mainHeading: 14.5,
  sidebarHeading: 12.6,
  organization: 11.8,
  title: 11.2,
} as const;

// ---------- 1. pdfjs items -> lines ----------

/** Join each page's text items into lines (split on end-of-line markers or a change of baseline). */
export function linesFromTextItems(pages: PdfTextItem[][]): PdfLine[] {
  const lines: PdfLine[] = [];
  pages.forEach((items, i) => {
    let parts: PdfTextItem[] = [];
    const flush = () => {
      const visible = parts.filter((it) => it.str.trim());
      if (visible.length) {
        lines.push({
          text: parts.map((it) => it.str).join("").replace(/\s+/g, " ").trim(),
          size: Math.max(...visible.map((it) => it.height)),
          x: visible[0].transform[4],
          y: visible[0].transform[5],
          page: i + 1,
        });
      }
      parts = [];
    };
    for (const item of items) {
      const first = parts.find((it) => it.str.trim());
      if (item.str.trim() && first && Math.abs(first.transform[5] - item.transform[5]) > 2) flush();
      parts.push(item);
      if (item.hasEOL) flush();
    }
    flush();
  });
  return lines;
}

// ---------- 2. text cleanup ----------

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|org|net|io|dev|me)\/\S*/gi;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g;

const hasContact = (t: string) => [EMAIL, URL_RE, PHONE].some((re) => t.search(new RegExp(re.source, re.flags.replace("g", ""))) !== -1);

/**
 * Remove template junk, repair sentences glued at line joins, and drop every sentence that
 * contains an email, URL, or phone number (removing just the address leaves a broken sentence).
 * `ctx.removed` counts dropped sentences so the user can be told.
 */
export function cleanText(text: string, ctx?: { removed: number }): string {
  const repaired = text
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/([a-z]{2}[.!?])(?=[A-Z])/g, "$1 ") // "problems?My" -> "problems? My"
    .replace(/\s+/g, " ")
    .trim();
  const sentences = repaired.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((sentence) => !hasContact(sentence));
  if (ctx) ctx.removed += sentences.length - kept.length;
  return kept.join(" ").trim();
}

// ---------- 3. lines -> profile ----------

const SIDEBAR_SECTIONS: Record<string, "skills" | "honors" | null> = {
  contact: null,
  "top skills": "skills",
  "honors-awards": "honors",
  languages: null,
  certifications: null,
  publications: null,
  patents: null,
};

const MAIN_SECTIONS: Record<string, "about" | EntrySectionKind> = {
  summary: "about",
  about: "about",
  experience: "experience",
  education: "education",
  projects: "projects",
  "volunteer experience": "volunteering",
  volunteering: "volunteering",
};

const DATE_RANGE =
  /^(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? )?\d{4} ?[-–] ?(?:present|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? )?\d{4})\b/i;
/** "2 years 3 months" on its own: the total-time line LinkedIn puts under a company with several roles. */
const DURATION_ONLY = /^\(?\d+ (?:years?|months?|yrs?|mos?)(?: \d+ (?:months?|mos?))?\)?$/i;

const isBullet = (t: string) => /^[·•]/.test(t);
const stripBullet = (t: string) => t.replace(/^[·•]\s*/, "");

/** A short line under the dates that names a place rather than describing work. */
function looksLikeLocation(t: string): boolean {
  if (t.length > 80 || /[.!?]$/.test(t) || isBullet(t)) return false;
  return /, |\bArea$|^Remote$|^Hybrid$|^On-?site$|^United States$/i.test(t);
}

/**
 * Group wrapped lines: a vertical gap above `factor` x font size starts a new item/paragraph.
 * Sidebar items wrap at ~1.2x and are spaced ~1.65x; the About text runs at ~1.5x.
 */
function splitByGap(lines: PdfLine[], factor: number): PdfLine[][] {
  const groups: PdfLine[][] = [];
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const newGroup = !prev || prev.page !== l.page || prev.y - l.y > l.size * factor;
    if (newGroup) groups.push([l]);
    else groups[groups.length - 1].push(l);
  });
  return groups;
}

const joinLines = (lines: PdfLine[]) => lines.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();

function clip(text: string, max: number, what: string, warnings: string[]): string {
  if (text.length <= max) return text;
  warnings.push(`${what} was longer than ${max} characters and was cut. Check the end of it.`);
  return text.slice(0, max).trim();
}

/** Description lines -> text with "- " bullets; wrapped lines are joined back together. */
function buildDescription(lines: PdfLine[], ctx: { removed: number }): string {
  const out: string[] = [];
  for (const l of lines) {
    if (isBullet(l.text)) out.push(`- ${stripBullet(l.text)}`);
    else if (out.length) out[out.length - 1] += ` ${l.text}`;
    else out.push(l.text);
  }
  return out.map((s) => cleanText(s, ctx)).filter((s) => s && s !== "-").join("\n");
}

type RawEntry = { organization: string; title: string; dates?: string; location?: string; body: PdfLine[] };

/** Experience-style entries: 12pt organization, 11.5pt title, then dates, location, description. */
function parseEntries(lines: PdfLine[], heading: string, warnings: string[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let org = "";
  let orgLines: PdfLine[] = [];
  let cur: RawEntry | null = null;
  let stage: "org" | "title" | "dates" | "body" = "org";
  const multiRole = new Set<string>();

  for (const l of lines) {
    if (l.size >= SIZE.organization) {
      if (stage !== "org") orgLines = [];
      orgLines.push(l);
      org = cleanText(joinLines(orgLines));
      stage = "org";
      cur = null;
    } else if (l.size >= SIZE.title) {
      if (stage === "title" && cur) {
        cur.title = cleanText(`${cur.title} ${l.text}`); // wrapped title
        continue;
      }
      if (stage !== "org") multiRole.add(org); // a second title under the same organization
      cur = { organization: org, title: cleanText(l.text), body: [] };
      entries.push(cur);
      stage = "title";
    } else if (!cur) {
      // 10.5pt line between an organization and its first title: total time at a multi-role company.
      if (DURATION_ONLY.test(l.text)) multiRole.add(org);
      else if (org) {
        cur = { organization: org, title: "", body: [l] };
        entries.push(cur);
        stage = "body";
      }
    } else if ((stage === "title" || stage === "dates") && !cur.dates && DATE_RANGE.test(l.text)) {
      cur.dates = l.text;
      stage = "dates";
    } else if (stage === "dates" && !cur.location && looksLikeLocation(l.text)) {
      cur.location = l.text;
      stage = "body";
    } else {
      cur.body.push(l);
      stage = "body";
    }
  }
  for (const o of multiRole) {
    warnings.push(`${heading}: "${o}" seems to list several roles. Each became its own entry; check the titles and dates.`);
  }
  return entries;
}

/** Education: 12pt school, then "Degree · (dates)" which may wrap onto the next line. */
function parseEducation(lines: PdfLine[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let cur: RawEntry | null = null;
  let detail: PdfLine[] = [];
  const finish = () => {
    if (!cur) return;
    // "Degree · (dates)" may wrap; anything after the dates is a description.
    const datesEnd = detail.findIndex((l) => l.text.includes(")"));
    const head = datesEnd === -1 ? detail.slice(0, 1) : detail.slice(0, datesEnd + 1);
    const text = cleanText(joinLines(head));
    const m = /^(.*?)\s*·?\s*\(([^()]*)\)$/.exec(text);
    cur.title = m ? m[1].trim() : text;
    if (m) cur.dates = m[2].trim();
    cur.body = detail.slice(head.length);
  };
  for (const l of lines) {
    if (l.size >= SIZE.organization) {
      if (cur && detail.length === 0 && !cur.title) {
        cur.organization = cleanText(`${cur.organization} ${l.text}`); // wrapped school name
        continue;
      }
      finish();
      cur = { organization: cleanText(l.text), title: "", body: [] };
      entries.push(cur);
      detail = [];
    } else if (cur) detail.push(l);
  }
  finish();
  return entries;
}

function toEntries(kind: EntrySectionKind, raw: RawEntry[], warnings: string[], ctx: { removed: number }): ProfileEntry[] {
  const label = { experience: "Experience", education: "Education", projects: "Projects", volunteering: "Volunteering" }[kind];
  if (raw.length > LIMITS.maxEntries) {
    warnings.push(`${label} had ${raw.length} entries; only the first ${LIMITS.maxEntries} were kept.`);
  }
  return raw.slice(0, LIMITS.maxEntries).map((r, i) => {
    const entry: ProfileEntry = {
      id: `${ENTRY_ID_PREFIX[kind]}${i + 1}`,
      title: clip(r.title, LIMITS.entryField, `${label} ${i + 1} title`, warnings),
      organization: clip(r.organization, LIMITS.entryField, `${label} ${i + 1} organization`, warnings),
      description: clip(buildDescription(r.body, ctx), LIMITS.sectionText, `${label} ${i + 1} description`, warnings),
    };
    if (r.dates) entry.dates = r.dates.slice(0, 100);
    if (r.location) entry.location = r.location.slice(0, LIMITS.entryField);
    return entry;
  });
}

/** Pure: lines of a LinkedIn PDF export -> sectioned profile plus anything the user should check. */
export function parseLinkedInLines(input: PdfLine[]): ParsedLinkedIn {
  const warnings: string[] = [];
  const contact = { removed: 0 };
  const profile = emptyLinkedInProfile();
  const lines = input.filter((l) => l.size > SIZE.footerMax && !/^Page \d+ of \d+$/i.test(l.text));

  const nameIdx = lines.findIndex((l) => l.size >= SIZE.name);
  if (nameIdx === -1 || !lines.some((l) => l.size >= SIZE.mainHeading && l.size < SIZE.name)) {
    return {
      profile,
      warnings: ["This doesn't look like a LinkedIn \"Save to PDF\" export. Enter your sections by hand instead."],
    };
  }
  const mainX = lines[nameIdx].x;
  const sidebar = lines.filter((l) => l.x < mainX - 50);
  const main = lines.filter((l) => l.x >= mainX - 50);

  // Sidebar: skills and honors; contact details and the rest are dropped.
  let sideTarget: "skills" | "honors" | null = null;
  let sideLines: PdfLine[] = [];
  const flushSide = () => {
    if (sideTarget) {
      for (const g of splitByGap(sideLines, 1.45)) {
        const item = cleanText(joinLines(g)).slice(0, LIMITS.listItem);
        if (item && profile[sideTarget].length < LIMITS.maxListItems) profile[sideTarget].push(item);
      }
    }
    sideLines = [];
  };
  for (const l of sidebar) {
    if (l.size >= SIZE.sidebarHeading) {
      flushSide();
      const key = l.text.trim().toLowerCase();
      sideTarget = SIDEBAR_SECTIONS[key] ?? null;
      if (!(key in SIDEBAR_SECTIONS)) warnings.push(`Skipped the "${l.text.trim()}" sidebar section.`);
      else if (sideTarget === null && key !== "contact") warnings.push(`"${l.text.trim()}" isn't imported.`);
    } else sideLines.push(l);
  }
  flushSide();

  // Main column: name (dropped), headline, location (dropped), then sections.
  const mainNameIdx = main.findIndex((l) => l.size >= SIZE.name);
  const firstHeading = main.findIndex((l) => l.size >= SIZE.mainHeading && l.size < SIZE.name);
  const intro = main.slice(mainNameIdx + 1, firstHeading);
  // The last intro line is the location when there are two or more; the rest is the (wrapped) headline.
  const headlineLines = intro.length >= 2 ? intro.slice(0, -1) : intro.filter((l) => !looksLikeLocation(l.text));
  profile.headline = clip(cleanText(joinLines(headlineLines), contact), LIMITS.headlineChars, "Headline", warnings);

  const sections: { kind: "about" | EntrySectionKind | null; title: string; lines: PdfLine[] }[] = [];
  for (const l of main.slice(firstHeading)) {
    if (l.size >= SIZE.mainHeading && l.size < SIZE.name) {
      const kind = MAIN_SECTIONS[l.text.trim().toLowerCase()] ?? null;
      if (!kind) warnings.push(`Skipped the "${l.text.trim()}" section; add anything important by hand.`);
      sections.push({ kind, title: l.text.trim(), lines: [] });
    } else sections[sections.length - 1]?.lines.push(l);
  }

  for (const s of sections) {
    if (!s.kind) continue;
    if (s.kind === "about") {
      const paragraphs = splitByGap(s.lines, 2).map((g) => cleanText(joinLines(g), contact));
      profile.about = clip(paragraphs.filter(Boolean).join("\n\n"), LIMITS.sectionText, "About", warnings);
    } else if (s.kind === "education") {
      profile.education = toEntries("education", parseEducation(s.lines), warnings, contact);
    } else {
      profile[s.kind] = toEntries(s.kind, parseEntries(s.lines, s.title, warnings), warnings, contact);
    }
  }

  if (contact.removed) {
    warnings.push(`Removed ${contact.removed} sentence${contact.removed === 1 ? "" : "s"} containing an email, link, or phone number.`);
  }
  if (!profile.projects.length && !profile.volunteering.length) {
    warnings.push("No Projects or Volunteering sections were found in the PDF. Add them by hand if you have them.");
  }
  const total = profileCharCount(profile);
  if (total > LIMITS.profileText) {
    warnings.push(`The imported profile is ${total.toLocaleString("en-US")} characters; the limit is ${LIMITS.profileText.toLocaleString("en-US")}. Shorten it before continuing.`);
  }
  return { profile, warnings };
}

// ---------- 4. browser entry point ----------

/** Browser only: PDF file -> lines -> parseLinkedInLines. The file never leaves the device. */
export async function parseLinkedInPdf(file: File): Promise<ParsedLinkedIn> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
      type: "module",
    });
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: PdfTextItem[][] = [];
    for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      pages.push(content.items.filter((it): it is PdfTextItem & (typeof content.items)[number] => "str" in it));
    }
    return parseLinkedInLines(linesFromTextItems(pages));
  } finally {
    await task.destroy();
  }
}
