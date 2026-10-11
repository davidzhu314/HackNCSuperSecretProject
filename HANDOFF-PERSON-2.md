# Handoff: Person 2, interface

Written 2026-10-10 for the session doing the **UI** side of the next phase. Person 1 builds the data model, PDF parser, and AI routes in parallel from [HANDOFF-PERSON-1.md](HANDOFF-PERSON-1.md). Read [HANDOFF.md](HANDOFF.md) first (live site, team, architecture, how to drive the app in Chrome), then [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) (Next.js 16.4 is newer than your training data; check `node_modules/next/dist/docs/` before Next code).

## The phase in one paragraph
LinkedIn stops being "headline + About as one text block". A profile becomes **sections**: headline, About, and entries under Experience, Education, Projects, and Volunteering, which users can import from LinkedIn's "Save to PDF" export. Audience Clash becomes an annotated, interactive view of the profile. Each section gets its own rewrite in a style picked from a dropdown. A demo-only Identity Hub shows the profile and real fact-coverage numbers. The copy loses its filler. Hinge stays as it is apart from the copy cleanup. LinkedIn first.

## Decisions already made by the user (don't reopen)
- **No real login.** The hub is **demo only**, using the fictitious demo persona, visibly labeled as a demo. Nothing is saved.
- **No made-up scores.** The mock the user showed had "78/100 profile consistency" with per-platform bars; the user agreed to replace it with **real counts** from Person 1's `factCoverage` (e.g. "9 of 12 confirmed facts appear on your LinkedIn", per section).
- **Platforms on the hub:** LinkedIn (active) and Hinge (working). No Instagram/Handshake cards: the spec forbids buttons that don't work.
- **Consent once per browser:** ask the first time live AI is used, remember it in `localStorage` (a flag only, e.g. `persona.consent.v1`, never profile text), and show a small "Withdraw consent" link. Keep sending `consent: true` on every request; the API still checks it. Sample mode needs no consent.
- **Drop the "Simulated AI feedback" label** for now (user decision; it overrides the rule in CLAUDE.md/SPEC.md; Person 1 updates those docs). **Keep the "Sample result" label** on cached/demo outputs; that rule wasn't waived.
- **Rewrite version is a dropdown per section** (Direct / Narrative), generated on demand.
- **Limit is 10,000 characters** for a whole profile (Person 1 changes `LIMITS`; update the counters in the UI).

## Your ownership (to avoid merge conflicts)
You own and may edit: `src/components/**`, `src/app/page.tsx`, `src/app/studio/**`, new `src/app/hub/**`, `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/api-client.ts`, `src/lib/persona-ui.ts`, and any new UI-only lib file (e.g. `src/lib/clash.ts`) with its tests.
Don't edit `schemas.ts`, `prompts.ts`, `rubrics.ts`, `fact-guard.ts`, `segments.ts`, `demo-data.ts`, or `src/app/api/**` (Person 1's). If you need a change there, ask in your PR.

## The contract (Person 1 merges it first; build against it now with local mocks)
```ts
type LinkedInSectionKind = "headline" | "about" | "experience" | "education" | "projects" | "volunteering";
type ProfileEntry = { id: string; title: string; organization: string; dates?: string; location?: string; description: string };
type LinkedInProfile = {
  headline: string; about: string;
  experience: ProfileEntry[]; education: ProfileEntry[]; projects: ProfileEntry[]; volunteering: ProfileEntry[];
  skills: string[]; honors: string[];
};
type RewritableSection = { key: string; kind: LinkedInSectionKind; label: string; text: string };
```
Functions you call (Person 1 writes them): `parseLinkedInPdf(file)` -> `{ profile, warnings }` (runs in the browser), `rewritableSections(profile)`, `segmentProfile(profile)` (segment ids like `"exp2-s1"`), `sectionOfSegment(id)`, `factCoverage(profile, facts)`.
Routes: `/api/evaluate` (same shape as now, segments from `segmentProfile`); **new** `/api/rewrite-section` with request `{ consent, platform: "linkedin", section, profile, facts, style, audiences, goal?, jobDescription? }` and response `{ source, sectionKey, style, rewrite, warnings, styleWarnings }`. Hinge keeps `/api/rewrite`.
Mock data arriving in the contract PR: `DEMO_LINKEDIN_PROFILE`, `SAMPLE_SECTION_REWRITES`, and an updated `SAMPLE_EVALUATE`. Until it merges, mirror these shapes in a local mock so you aren't blocked.

## Work items, in order
1. **Copy cleanup** (independent; do it first and open a small PR). Remove or replace with plain functional labels:
   - `AudienceSelection.tsx:80` "Choose 1–3 audience lenses and 1–5 traits. Each lens can notice something different in the same words." -> e.g. "Pick up to 3 audiences."
   - `AudienceSelection.tsx:86` "Simulated AI feedback, not a prediction of how real people will react." -> remove.
   - `AudienceClash.tsx:36` "Simulated AI feedback" -> remove.
   - `PersonaFlow.tsx:283, 306-310`: "One identity. Every platform.", "Authentically you", "You, in your best light.", "One identity. Every platform. Authentically you.", "Improve expression, not invent identity." -> remove; keep a plain page title.
   - `ProfileInput.tsx:213` "Improve expression, not invent identity." -> remove.
   - `src/app/page.tsx:22, 27, 44, 86` (same phrases on the home page) and the metadata in `layout.tsx:9-11` and `studio/page.tsx:7`.
   Line numbers are from commit `bc83b08`; search for the strings if they moved. Rule of thumb for new copy: say what the control does, nothing about how the user should feel.
2. **Consent once** (see decisions). Test: first live run asks; reload; second run doesn't; "Withdraw consent" asks again; sample mode never asks.
3. **Profile input by section** (LinkedIn).
   - Upload accepts `.pdf` (keep `.txt/.md/.json`). On a PDF, call `parseLinkedInPdf` and show a **review screen**: each detected section in its own editable box, parser warnings shown, and "Add Projects / Add Volunteering" buttons (the user's real export had neither section).
   - Paste path: a section editor with the same boxes. Titles, organizations, and dates are editable fields but are never rewritten.
   - Show a 10,000-character counter for the whole profile.
   - Test with a synthetic profile; the user can try their own PDF locally. Never commit a real profile.
4. **Lens picker**: 8 LinkedIn lenses grouped in 4 categories (Recruitment; Hiring & Leadership; Research & Academia; Entrepreneurship & Networking), up to 3 picked. Default: one lens from each of 3 categories so the feedback actually differs. Categories come from `rubrics.ts`.
5. **Audience Clash redesign (LinkedIn only; Hinge keeps the current screen).** The current grid of trait names and ratings doesn't explain anything. Replace it with:
   - **Annotated profile**: the profile, section by section, with each audience's reactions attached to the exact sentences they cite (segment ids), color-coded by audience. Filter chips: one audience or all.
   - **"Where they disagree"** strip at the top: sentences that two audiences rate at least two levels apart. Compute it in a pure, tested helper (e.g. `src/lib/clash.ts`).
   - Traits shown as plain questions (labels from `rubrics.ts`, e.g. "Can they tell what you do?").
   - Each reaction card: the reaction, the highlighted evidence, what to change, and a **"Rewrite this section"** button that jumps to that section's rewrite.
   - Critiques with no evidence ("missing evidence") get their own short list, e.g. "Nobody could find: …".
   - The old grid can shrink to a small summary or go.
6. **Rewrite screen by section.**
   - One card per rewritable section, in LinkedIn order: original, rewritten (word diff, as now), FactCheck panel, style suggestions, and its own **Copy** button (people paste back into LinkedIn one section at a time).
   - A **dropdown per section: Direct / Narrative.** Generate the selected style on demand; cache results so switching back is instant; switching to an ungenerated style generates it.
   - "Rewrite all sections" runs the chosen style for every section, **at most 3 requests at a time**, with per-section loading and errors (one failure doesn't block the others).
   - Keep edit-then-recheck (FactCheck and the style lint rerun locally on edits) and the "Show FactCheck demo" test case.
7. **Identity Hub (demo only)** at `/hub`, linked from the home page.
   - Demo persona card: avatar (initials or an illustration, not a photo of a real person), name labeled as a demo persona, counts like "1 profile · N drafts".
   - Platforms: LinkedIn and Hinge cards that open the studio for that platform.
   - "Your facts on LinkedIn": real numbers from `factCoverage` (confirmed facts covered, per section bars). Label the whole page "Demo profile". No invented scores.

## Rules that still apply
- No AI call before consent (remembered or fresh). Only confirmed facts reach a rewrite. Sample results are labeled "Sample result".
- FactCheck wording: "No unsupported concrete claims detected", never "verified".
- Mobile works (no horizontal scroll at 390px), every visible button works, real loading/empty/error states.
- Drive it in a real browser before calling anything done (HANDOFF.md has the Playwright-with-installed-Chrome recipe and the gotchas). `npm test`, `npm run lint`, and `npm run build` pass before a PR.
- Work on a branch and open a PR. `git fetch` before pushing. Don't deploy; the user approves each deploy.
