# Handoff: Person 1, profile data and AI

Written 2026-10-10 for the session doing the **data model, PDF parsing, AI routes, and FactCheck** side of the next phase. Person 2 builds the UI in parallel from [HANDOFF-PERSON-2.md](HANDOFF-PERSON-2.md). Read [HANDOFF.md](HANDOFF.md) first (live site, team, architecture, gotchas), then [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) (Next.js 16.4 is newer than your training data; check `node_modules/next/dist/docs/` before Next code).

## The phase in one paragraph
LinkedIn stops being "headline + About as one text block". A profile becomes **sections**: headline, About, and entries under Experience, Education, Projects, and Volunteering. Users can import LinkedIn's "Save to PDF" export instead of pasting. Each rewritable section gets its own rewrite in a style the user picks from a dropdown (Direct or Narrative), checked by FactCheck against that section's own text. LinkedIn gets 8 audience lenses in 4 categories. Hinge is unchanged except copy cleanup. All of this is LinkedIn first.

## Decisions already made by the user (don't reopen)
- **Sections, not one block.** Only free text is rewritten: headline, About, and each entry's description. Titles, organizations, dates, and locations are kept exactly as written.
- **Version choice is a dropdown per section** (Direct / Narrative). Generate only the chosen style on demand; cache it; switching to the other style generates that one if it doesn't exist yet. No more "two versions in one call" for LinkedIn sections.
- **Limit goes to 10,000 characters** for a whole profile.
- **Lenses: 4 categories x 2** (table below). Users still pick up to 3.
- **No real login.** A demo-only Identity Hub (Person 2) with fact-coverage numbers you compute. No 78/100-style scores: anything numeric must be a real count.
- **Consent once per browser** (Person 2). The API still requires `consent: true` on every request; don't remove that.
- **The "Simulated AI feedback" label is dropped for now** (user decision; it overrides the trust rule in CLAUDE.md and SPEC.md, so update those when you touch them). The "Sample result" label on cached/demo outputs **stays**: that rule wasn't waived.

## Your ownership (to avoid merge conflicts)
You own and may edit: `src/lib/schemas.ts`, `segments.ts`, `fact-guard.ts`, `style-check.ts`, `prompts.ts`, `rubrics.ts`, `postprocess.ts`, `llm.ts`, `demo-data.ts`, new `src/lib/linkedin-pdf.ts`, new `src/lib/profile.ts`, `src/app/api/**`, `evals/**`, and their tests.
Don't edit `src/components/**`, `src/app/page.tsx`, `src/app/studio/**`, `globals.css`, or `api-client.ts` (Person 2's). If you need a change there, say so in your PR description.

## The contract (build this first, merge it within your first hour)
Person 2 is building against exactly this. Once merged, `schemas.ts` is the source of truth; if you must change a shape, tell Person 2 in the PR.

```ts
// src/lib/schemas.ts (add; keep existing Hinge shapes working)
type LinkedInSectionKind = "headline" | "about" | "experience" | "education" | "projects" | "volunteering";
type ProfileEntry = {
  id: string;            // "exp1", "edu2", "proj1", "vol1"
  title: string;         // role / degree / project name, kept verbatim
  organization: string;  // company / school, kept verbatim
  dates?: string;        // verbatim, e.g. "July 2026 - Present (4 months)"
  location?: string;     // verbatim; never sent to the AI
  description: string;   // the only rewritable part (bullets keep their "-" lines)
};
type LinkedInProfile = {
  headline: string;
  about: string;
  experience: ProfileEntry[];
  education: ProfileEntry[];
  projects: ProfileEntry[];
  volunteering: ProfileEntry[];
  skills: string[];      // listed, not rewritten
  honors: string[];      // listed, not rewritten
};                        // name, email, URL, and location are stripped at parse time and never stored
type RewritableSection = { key: string; kind: LinkedInSectionKind; label: string; text: string };
  // key: "headline" | "about" | an entry id; label: e.g. "Experience · Agxes · Machine Learning Intern"
```

```ts
// src/lib/profile.ts (pure, tested)
rewritableSections(p: LinkedInProfile): RewritableSection[]   // skips entries with empty descriptions
segmentProfile(p: LinkedInProfile): Segment[]                 // ids are `${sectionKey}-s${n}`: "headline-s1", "about-s3", "exp2-s1" (≤16 chars)
sectionOfSegment(segmentId: string): string                   // "exp2-s1" -> "exp2"
factCoverage(p: LinkedInProfile, facts: IdentityFact[]): {
  perFact: { factId: string; sectionKeys: string[] }[];       // where each confirmed fact shows up
  summary: { confirmed: number; covered: number };            // "9 of 12 confirmed facts appear on your LinkedIn"
}

// src/lib/linkedin-pdf.ts
parseLinkedInText(text: string): { profile: LinkedInProfile; warnings: string[] }  // pure, the part you test
parseLinkedInPdf(file: File): Promise<{ profile: LinkedInProfile; warnings: string[] }>  // browser only: PDF -> text -> parseLinkedInText
```

API:
- `POST /api/evaluate`: same request/response shape as now; LinkedIn sends `segmentProfile(...)` segments. Critiques cite segment ids; the section comes from `sectionOfSegment`. Raise limits so a full profile fits.
- **New** `POST /api/rewrite-section` (LinkedIn only):
  - request `{ consent: true, platform: "linkedin", section: RewritableSection, profile: LinkedInProfile, facts: confirmed IdentityFact[], style: "direct" | "narrative", audiences: string[], goal?: string, jobDescription?: string }`
  - response `{ source: "live" | "sample", sectionKey: string, style, rewrite: Rewrite, warnings: GuardWarning[], styleWarnings: GuardWarning[] }`
- `POST /api/rewrite` stays as is for Hinge. Don't break it.

Mock data to ship in the contract PR (`demo-data.ts`, fictitious persona only):
- `DEMO_LINKEDIN_PROFILE`: extend the existing fictitious persona (Priya) into a sectioned profile: headline, About, 2-3 experience entries with bullet descriptions, 1-2 education entries, 1 project, 1 volunteering entry.
- `SAMPLE_SECTION_REWRITES`: one sample rewrite per rewritable section per style, `source: "sample"`, each passing FactCheck and the style lint (add a test like the existing `demo-data.test.ts`).
- `SAMPLE_EVALUATE` with the new segment ids, covering at least the 3 default lenses.
- A stub `/api/rewrite-section` that returns the sample is fine for the first merge; make it live afterwards.

## Work items, in order
1. **Contract PR** (above). Merge fast; Person 2 is waiting on it.
2. **PDF parsing.**
   - Pick a PDF text library that runs in the browser (so nothing leaves the device before consent). `pdfjs-dist` is the usual choice; check current docs for its worker setup under Next 16 before relying on it.
   - Test against the user's real export: they have it (`Profile (1).pdf`). **Keep it outside the repo** (the repo is public; never commit it, never put its contents in demo data or tests). Read it from a path you pass in locally.
   - Commit a **synthetic** fixture instead: a made-up person's profile written in the same text layout, for `parseLinkedInText` tests.
   - What the real export looks like (verified from the user's PDF):
     - Two columns; text extraction puts the **left sidebar first**: `Contact` (email, LinkedIn URL), `Top Skills`, `Honors-Awards`. Then the main column: name, **headline on the next line** ("MechE and Math @ Duke"), location, then `Summary`, `Experience`, `Education`.
     - Experience entry pattern: organization line, title line, dates line like `July 2026 - Present (4 months)`, location line, then bullets that start with `·`.
     - Junk to clean: `Page 1 of 3` footers in the middle of entries (bullets continue after the page break), a literal `&nbsp;`, and sentences glued at line joins (`problems?My`, `lives.I'm`).
     - That export has **no Projects or Volunteering sections**, and we don't know if LinkedIn ever exports them. They must be addable by hand in the UI; the parser should just return empty arrays.
     - Not covered by the sample: several roles at one company (LinkedIn groups them differently). Return a warning rather than guessing wrong.
   - Strip contact info, URLs, and locations from anything that could reach the AI.
3. **Per-section rewrite** (`/api/rewrite-section`, prompts, postprocess).
   - One call per section per chosen style, Sonnet (`getRewriteModel()`). Keep the existing style rules and ban list; adapt the format rule per section kind (headline: one line; About: short paragraphs; entry descriptions: keep bullet form, same number of bullets or fewer, no new bullets of new achievements).
   - **FactCheck corpus:** for headline and About, the whole profile's text plus confirmed facts (an About can summarize your experience). For an entry, **only that entry's text plus confirmed facts**, so numbers and names can't hop between jobs.
   - Stress-test with the real profile locally: numbers like `~96,000 ft`, `6+`, `over 150`, `six research posters`, `2025–2026` (en dash), `Llama 3.1`, `GPT-OSS-20B`, and names like `Lockheed Martin and Anthropic` must not be flagged when kept; `Contributed to` must not become `Led`. Fix FactCheck parsing where it trips (e.g. `~` prefix, `+` suffix, en dash ranges), with tests.
   - Measure latency for one section and for "rewrite all" (Person 2 runs at most 3 requests in parallel). Report numbers in your PR.
4. **Lenses** in `rubrics.ts`: add a `category` to each LinkedIn audience and a category list. Write each lens as what it looks for, never demographics.

   | Category | Lenses |
   |---|---|
   | Recruitment | Talent acquisition specialist, Technical recruiter |
   | Hiring & Leadership | Hiring manager, Technical lead |
   | Research & Academia | Research lead, Admissions / fellowship reviewer |
   | Entrepreneurship & Networking | Startup founder, Industry professional |

   "Industry professional" needs the sharpest definition (suggested: a peer in your field at a networking event, looking for domain credibility and something to talk about). Also give LinkedIn traits plain-question labels, e.g. Clarity -> "Can they tell what you do?", Ownership and impact -> "Can they tell what you did?". Keep the ids stable.
5. **Limits**: profile 10,000 characters total; raise `maxSegments` (a full profile can exceed 40 sentences; ~150 is safe), `maxCritiques` for 3 lenses x 5 traits, and set a per-section rewrite cap.
6. **`factCoverage`** for the hub, with tests. Real counts only.
7. Update CLAUDE.md and SPEC.md for the decisions above (sections, dropped simulated label, consent once per browser, demo hub).

## Rules that still apply
- FactCheck stays deterministic and tested; never trust model `usedFactIds`; say "no unsupported concrete claims detected", never "verified".
- Evidence uses segment ids resolved on the server; unknown ids are flagged, not highlighted.
- Never print or ask for API keys. `npm test`, `npm run lint`, and `npm run build` pass before a PR.
- Work on a branch and open a PR. `git fetch` before pushing. Don't deploy; the user approves each deploy.
