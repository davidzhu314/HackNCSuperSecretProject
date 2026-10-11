# Personify: progress so far

For the product idea and rules, see [SPEC.md](SPEC.md) and [CLAUDE.md](CLAUDE.md); for the current handoff, [HANDOFF.md](HANDOFF.md).

## Latest (2026-10-10, late night): scenic UI, closed-loop flow, write once

Since the sections phase (below), all merged to `main` (not yet deployed; 266 tests pass):

- **Scenic UI** (merged from the team's Lovable "aero-persona-hub"): home is the LinkedIn city / Hinge town destinations; the studio shows the platform's photo, hotspot "pearls" as the step rail, the work in a wide panel, and a bottom bar with consent status and progress. The 3D look-around and the slide-out drawer were left out on purpose (weight, phones, room for the section editor).
- **Identity Hub, made real**: photo and LinkedIn PDF import (both browser-only), your facts across platforms, LinkedIn coverage for your own profile (the demo is shown as a labeled example when you have nothing yet).
- **Shared session** (`identity-session.ts`): profiles, facts, and photo follow you between home, studio, and hub. Memory only. Next 16 keeps pages you've left mounted but hidden, so the studio writes only real changes and restarts when the hub changes something.
- **Closed loop**: "Use this version" (undoable) puts a section rewrite into your profile; the studio ends with "Copy updated profile", "See it in your Identity Hub", or the other platform; the hub shows coverage before → after. Audience Clash keeps the text it was given and says when it predates rewrites you used.
- **Write once, show up everywhere** (`fact-platforms.ts`): each confirmed fact is shared with chosen platforms (found facts start on the platform they were found on, typed facts on both); rewrites and FactCheck use only facts shared with the current platform. "Start from my facts" fills empty Hinge answers or an empty About with your own confirmed sentences.
- **Fixes**: lens cards were clipped by a fixed height; entrance animations no longer start invisible; step changes scroll to the top; 118 unused CSS rules removed.

## Earlier (2026-10-10, night): sections phase done, tested live

The product is named **Personify** (it was PERSONA in earlier notes below). Since the notes below were written: the Lovable UI was ported in, Hinge was built end to end, the site was deployed, and the sections phase was built, merged, tested live, and deployed. 252 tests passed at the time; lint and build were clean.

**Data and AI side** (Person 1):

- **Profile by sections** (`profile.ts`, #7): headline, About, and Experience / Education / Projects / Volunteering entries. Segment ids are per section (`exp2-s1`); only free text is ever rewritten.
- **PDF import** (`linkedin-pdf.ts`, #9): LinkedIn's "Save to PDF" export parsed in the browser with `pdfjs-dist`; drops name, contact details, and location. Tested on a synthetic export; checked locally on one real export.
- **Per-section rewrites** (`/api/rewrite-section`, #10): one section and one style per call, about 2-3.5s per section (About ~10-13s), "rewrite all" for 8 sections in 8-14s at 3 at a time. FactCheck checks an entry only against its own text.
- **8 lenses in 4 categories** (#11), traits shown as plain questions; sample feedback covers all 8.
- **Fact coverage** (#12): real counts of which confirmed facts appear in which section, for the demo hub.

**UI side** (Person 2: #5, #6, #8, #14):

- **Section editor** (`LinkedInEditor`): headline, About, entries with add/remove, skills one per line, optional job description, 10,000-character counter. **Import PDF** fills the same boxes and shows a review banner with the parser's warnings.
- **Consent once per browser** (`consent.ts`): a localStorage flag with a way to withdraw. Every request still sends `consent: true`.
- **Lens picker**: the 8 lenses grouped by category, up to 3, traits as plain questions.
- **Audience Clash** (`ProfileClash`, `clash.ts`): the profile annotated section by section, reaction cards with "What to change" and "Rewrite this section", audience filters, "Where they disagree" (sentences rated 2+ levels apart), "Nobody could find".
- **Per-section rewrites** (`SectionRewrites`): one card per section with a Direct / Narrative dropdown, cached per style, "Rewrite all" at 3 at a time (`run-limited.ts`). Each result keeps the diff, FactCheck, style suggestions, receipts, edit-and-recheck, and Copy.
- **Receipts** (`provenance.ts`): each rewritten sentence traced to the source sentences or confirmed facts it came from.
- **Identity Hub** (`/hub`): at the time demo-only, with real fact-coverage counts per section (made real later; see above).

The notes below describe the earlier plain UI and are kept as a record; their counts and to-do items are out of date.

## Where things stand

The LinkedIn flow works end to end with the real AI. The screens are plain placeholders, waiting for the Lovable designs to be ported in. The public site is not updated yet: it needs the API key in Vercel and a deploy.

- **Built:** data shapes, demo data, FactCheck, the AI client, three API routes, and a working six-step page.
- **Checked:** 40 automated tests pass, lint is clean, and `npm run build` passes. The whole flow was driven in a real Chrome browser, both in sample mode and live, on desktop and phone width.
- **Not built:** Hinge screens, blind A/B (stretch goal).

## Rewrite style (two versions)

The rewrite now follows the team's LinkedIn copywriting rules, adapted for a profile instead of a post: plain headline, a strong true first line, short paragraphs, bullets, and a ban list of AI clichés. It returns two versions from the same facts, **Option A: Direct** and **Option B: Narrative**, shown as tabs. Our fact rules always win over the style rules.

- `src/lib/style-check.ts` flags banned words and phrases and emoji bullets. These show as "Style suggestions", separate from FactCheck.
- Model check with the new prompt (one run each, neutral and "make me sound more impressive"): no model used a banned word. Sonnet had 1 FactCheck flag in 4 versions (mostly a false positive on "CS"), Haiku had 0 but weaker openings, and Gemini 3.8 Flash cited invalid fact IDs. Sonnet stays the rewrite model, about 6-7s for both versions.

## The page (UI)

`src/components/PersonaFlow.tsx` runs the six steps: Profile, Consent, Facts, Audiences, Feedback, Rewrite.

- **Consent comes before the facts step**, because suggesting facts already sends the text to the AI. Nothing is sent before the user agrees.
- **Only ticked facts** are sent to the rewrite. AI-suggested facts start unticked.
- **Sample mode** is offered only for the demo persona, so sample results never appear next to someone's real text. Sample results are always labeled "Sample result".
- **Editing the rewrite re-runs FactCheck** instantly in the browser.
- Each screen is its own component that only takes data and callbacks (`InputStep`, `ConsentStep`, `IdentityFacts`, `AudiencePicker`, `AudienceClash`, `RewriteComparison`). A Lovable version can replace one at a time without touching the flow.
- `src/lib/api-client.ts` is how the screens call the API. It never touches the API key.

## What each file does

All of these are in `src/lib/` unless noted.

| File | What it does |
|---|---|
| `schemas.ts` | The shared data shapes (zod). Everyone builds against this. |
| `demo-data.ts` | A made-up persona ("Priya Nair"), a vague LinkedIn bio, Hinge answers, and sample results. Every sample is marked `source: "sample"` so the UI can label it. |
| `segments.ts` | Splits pasted text into numbered pieces (`s1`, `s2`, …). The AI cites these numbers, never quotes. |
| `fact-guard.ts` | **FactCheck.** Plain code, no AI. Flags anything in a rewrite that your text and confirmed facts don't support. |
| `llm.ts` | Talks to OpenRouter. Checks the AI's answer against the schema and retries once if it's broken. |
| `rubrics.ts` | The audiences and traits for LinkedIn and Hinge. |
| `prompts.ts` | The instructions sent to the AI for each step. |
| `postprocess.ts` | Cleans up the AI's answer: drops unknown segment numbers, trims long text, never marks a fact confirmed. |
| `api.ts` | Shared code for the API routes: reads the request, checks consent, turns errors into clear messages. |
| `api-client.ts` | Browser-side helper the screens use to call the routes. Handles sample mode. |
| `src/app/api/…` | The three routes listed below. |

## The three API routes

1. **`POST /api/facts/extract`**: reads the pasted profile and suggests facts about the person. Suggested facts always start unconfirmed; the user ticks the true ones.
2. **`POST /api/evaluate`**: simulated feedback from 2–3 audiences (for example a startup founder or a recruiter). Each critique is rated `not_evident` / `weak` / `moderate` / `strong` and points at the segment numbers it is based on. No percentages or scores.
3. **`POST /api/rewrite`**: writes an improved version using only the original text and confirmed facts, then runs FactCheck on the result.

Every route refuses to run without consent (`consent: true` in the request), so no text reaches the AI without the user agreeing first.

## What FactCheck catches

- **Numbers and dates** that weren't in the user's text or facts, including written-out ones ("two hundred", "95 percent").
- **Names** (companies, schools, certifications) that weren't there. This is a guess based on capital letters, not perfect.
- **Stronger verbs** than the facts support, for example "contributed" turned into "led".
- **Fact IDs** the AI cited that don't exist or that the user didn't confirm.
- **Sentences** that barely match anything the user said, flagged for a human to review.

When nothing is flagged, the app must say "no unsupported concrete claims detected", never "verified true". FactCheck can still miss subtle exaggeration.

## AI models

| Step | Model | Why |
|---|---|---|
| Extract and evaluate | `anthropic/claude-haiku-5.5` | Cheap, fast, and gave sensible feedback. |
| Rewrite | `anthropic/claude-sonnet-5.5` | Best formatting, about 4 seconds, under a cent per rewrite. |

We compared four models on the same inputs (one try each, so a first impression, not a benchmark):

- `gemini-3.1-flash-lite` invented skills and gave useless feedback. Not used.
- `gemini-3.8-flash` stayed closest to the facts but took 12–14 seconds per rewrite, which is too slow for a live demo.
- Haiku listed vague claims like "I am a team player" as facts. A prompt fix solved this.

The rewrite model can be changed with `OPENROUTER_REWRITE_MODEL`, with no code change.

## Problems found and fixed

- **Requests to Haiku failed.** Haiku on OpenRouter doesn't accept a `temperature` setting, and the request was set to fail rather than quietly drop a setting. Temperature is now optional (`OPENROUTER_TEMPERATURE`) and off by default.
- **vitest wouldn't install.** It needed newer Node type definitions. `@types/node` was updated from 20 to 26.
- **A teammate's push removed `.venv/` from `.gitignore`.** That line is back, so the Python environment can't be committed by accident. Their `example.py` reads the Gemini key from the environment and does not contain a key.
- **FactCheck flagged ordinary words** like "Student", "Apps", and headings like "What I've worked on". These are now allowed. Job titles like "Developer" and names like "Google" are still flagged.
- **FactCheck flagged "Builder"** when the facts said "built". Irregular verbs (built, wrote, taught, led, ...) now match their other forms.
- **The page font fell back to a serif** because of a setup bug in `globals.css`. Fixed.
- **The before/after view lost spaces** ("courseand"). Switched to a diff that keeps whitespace exactly.

## Environment variables

| Name | Needed? | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Server only. Lives in `.env.local`, never in git. |
| `OPENROUTER_MODEL` | Optional | Defaults to `anthropic/claude-haiku-5.5`. |
| `OPENROUTER_REWRITE_MODEL` | Optional | Defaults to `anthropic/claude-sonnet-5.5`. |
| `OPENROUTER_TEMPERATURE` | Optional | Leave empty for Anthropic models. |

## Commands

- `npm run dev`: run the app at http://localhost:3000
- `npm test`: run the FactCheck and AI client tests
- `npm run lint` and `npm run build`: run both before calling anything done

## Still to do

1. **Deploy** `main` (`vercel --prod --yes`); the live site predates the scenic UI.
2. **Live run** on the deployed URL: feedback, section rewrites, "Use this version", and per-platform facts were only checked in sample mode.
3. **Security:** revoke the old Gemini key that was briefly committed in `933a9c6`, at https://aistudio.google.com/apikey.
4. **Demo:** rehearse the 90-second script (lead with "try to make me lie") and record a backup video. The demo's facts start LinkedIn-only, so share one with Hinge on stage before "Hinge next".
5. **Evals:** review the 20 draft cases; a model-comparison runner isn't built.
6. **If time allows:** "Use this version" for Hinge (needs per-answer rewrite output), blind A/B.
