# Personify (hackathon app)

**Current goal: improve the rewrite writing quality. Start with [HANDOFF-WRITING.md](HANDOFF-WRITING.md).** The full Tinder profile is merged to `main` (PR #34; decisions and what's still open in [HANDOFF-TINDER-0-CONTRACT.md](HANDOFF-TINDER-0-CONTRACT.md)). Then [HANDOFF.md](HANDOFF.md) (team, deploy, gotchas; its state section is partly out of date), then the full spec: [SPEC.md](SPEC.md). Read [AGENTS.md](AGENTS.md) too: this Next.js version is newer than most training data. (The earlier SkinOS idea is archived in `archive/SKINOS-SPEC.md`; ignore it.)

## Idea
**Personify** (earlier name: PERSONA) — "One identity. Every platform. Authentically you." Users enter a LinkedIn profile by sections (or import LinkedIn's PDF export) or Hinge answers, confirm a few true facts about themselves, pick simulated audiences, and get evidence-linked feedback plus rewrites grounded only in confirmed facts. A deterministic **FactCheck** layer flags invented numbers, entities, and inflated verbs. Principle: improve expression, not invent identity.

## Stack
- Next.js 16 (App Router, `src/app/`), React 19, TypeScript, Tailwind CSS
- shadcn/ui, lucide-react, zod, `diff`
- LLM via Google Gemini's OpenAI-compatible endpoint (`openai` SDK, baseURL `https://generativelanguage.googleapis.com/v1beta/openai/`), server-side only, JSON/structured output validated with zod (retry once on invalid JSON)
- No database or auth. React state plus localStorage (non-sensitive prefs only)
- npm, deployed on Vercel

## Commands
- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build. Run before every deploy.
- `npm run lint`: ESLint
- Deploy: `vercel` (preview) or `vercel --prod`

## Layout
- `src/app/`: pages plus `api/facts/extract`, `api/facts/verify` (Lie Checker's AI check), `api/evaluate`, `api/rewrite` (Hinge), `api/rewrite-section` (LinkedIn, one section per call), `api/compare` (stretch)
- `src/components/`: `PersonaFlow` (the flow), `LinkedInEditor`, `TinderEditor` (About me, prompts, profile fields), `ProfileClash`, `SectionRewrites` (LinkedIn), `ProfileInput`, `AudienceClash`, `RewriteComparison` (Hinge and bio platforms), `ExtraFacts` (add a true fact on the rewrite step, with the Lie Checker), `FactCheckDetail` (a fact's check result), `QuickCheck` (Quick check plus Where it fits; read-only results, never controls), `ProgressBar` (theme-aware, while an AI request runs; logic and tests in `src/lib/progress.ts`), `AudienceSelection`
- `src/app/hub/` (`IdentityHub`): sources (LinkedIn PDF, photo) and real fact coverage; `src/app/studio/`: the flow (`?platform=hinge`). Home is the scenic destinations, one per platform group (professional, social, dating) listing all six platforms; the Hub is white and minimal and lists all six as sources; the studio shows the platform's photo with `TourStops` as the step rail (merged from the Lovable aero-persona-hub design)
- `src/lib/autofill.ts` + `AutofillPanel`: "Fill from your other profiles" on every platform's profile step, button only, empty spots only. Fill (no AI) copies the user's own sentences, role/school lines, and Tinder work fields, ranked per platform (no casual text on LinkedIn, no prompt answers in bios). Draft with AI (`/api/draft`, asks for consent first) rewords the same sources; `buildDrafts` FactChecks every sentence and removes any it can't trace
- `src/lib/tinder.ts`: Tinder prompts, field groups, LinkedIn carry-over (job title, company, school, languages), `segmentTinder` (About plus answers only), `tinderFieldFacts` (the only fields a rewrite gets; FactCheck counts them as the user's words). Location and the relationship, basics, and lifestyle picks are never sent. Option lists are unverified, and prompt limits are assumed (copied from Hinge)
- `src/lib/identity-session.ts`: memory-only session shared by hub and studio (profiles, facts, photo); cleared on refresh, never sent or stored
- `src/lib/fact-platforms.ts`: write once, show up everywhere. One fact pool; each fact is shared with chosen platforms (found facts default to where they were found, typed facts to all). The studio's `confirmedFacts` is filtered by platform, so an unshared fact can't support a claim there. "Start from my facts" seeds an empty Hinge or LinkedIn About with the user's own confirmed sentences
- `src/lib/profile-edits.ts`: "Use this version" (write a section rewrite into the profile, undo), copy-all text, Hinge fact coverage. The studio keeps the pre-rewrite profile as `original` so FactCheck and rewrites still check against the user's own words
- Checks by code, not AI (all tested, all in the browser): `lint.ts` (Quick check on the profile step: buzzwords, no specifics, no role, duties, repeats; plus the before/after scorecard counts), `fit.ts` (Where it fits: the text against every platform's real limit), `consistency.ts` (Hub: contradictions across platforms), `proof.ts` (Copy/download with sources), `benchmark.ts` (the `/factcheck` page: planted fabrications caught, misses listed), `fact-claims.ts` (Lie Checker rules on an added fact: status superlatives, a number that differs from a related line, a stronger past-tense role verb than the related line)
- Lie Checker (`ExtraFacts`, every platform): each added fact is compared with the original profile (before "Use this version"). Rules run as you type; the AI check (`/api/facts/verify`, consent required, off in sample mode) runs when a fact is added or on Check / Re-check, and a verdict that needs evidence but cites none is downgraded to `not_mentioned`. States: verified, unverified, pending_check, flagged. It never blocks adding a fact and never claims a fact is true
- `src/lib/`: `llm.ts`, `rubrics.ts`, `fact-guard.ts`, `segments.ts`, `schemas.ts`, `demo-data.ts`, `profile.ts` (sections, segment ids like `exp2-s1`, per-section FactCheck corpus, `factCoverage`), `linkedin-pdf.ts` (browser-side PDF import via `pdfjs-dist`), `styles.ts` (section rewrite styles, length steps, and deterministic style checks)

## Rules
- Audiences are simulated lenses, defined by what they look for, never demographics. No hireability/match percentages, no predictions, no made-up scores (only real counts). The "simulated AI feedback" label is dropped for now (user decision).
- Only **confirmed** facts may support generated claims. Never invent credentials, numbers, employers, dates, hobbies, or preferences.
- Evidence uses **segment IDs**, not free-text quotes: split input into numbered segments server-side, have the model cite IDs, resolve quotes on the server. Flag unknown IDs.
- FactCheck is deterministic TypeScript and must have tests. Never trust model `usedFactIds`. Never say "verified true"; say "no unsupported concrete claims detected".
- Consent before any text goes to Google through the Gemini API. Asked once per browser (a `localStorage` flag only, with a way to withdraw); every API request still sends `consent: true` and is rejected without it. Never log or persist profile text by default.
- Never commit a real person's profile (the repo is public). Test with real exports locally only; commit synthetic fixtures.
- Demo/cached outputs must be visibly labeled. Never disguise them as live runs. No silent fake results.
- Never expose `GEMINI_API_KEY` or `OPENROUTER_API_KEY` to the browser. Read it from `process.env` in server code only.
- Secrets live in `.env.local` (gitignored). `.env.example` lists names only. Never commit `.env*` values or paste keys into chat.
- Use current official Gemini API docs, not memory. Verify the chosen model actually returns valid structured JSON before relying on it.
- Define zod schemas first; build UI against mock JSON so work can run in parallel.
- Make sure `npm run build` passes before saying something is done.
- Don't run `npm audit fix --force`. The current audit warnings are in dev tooling and accepted.

## Environment variables
- `GEMINI_API_KEY`: server-side Gemini API key. When it is unset, `src/lib/llm.ts` falls back to OpenRouter if `OPENROUTER_API_KEY` is set (models `OPENROUTER_MODEL` / `OPENROUTER_REWRITE_MODEL`, defaults Claude Haiku / Sonnet). Production on Vercel has only the OpenRouter key (2026-10-11), so it runs through OpenRouter
- `GEMINI_MODEL`: model for extraction and evaluation (default `gemini-3.8-flash`)
- `GEMINI_REWRITE_MODEL`: optional model for `/api/rewrite` and `/api/rewrite-section` (default `gemini-3.8-flash`)
- `GEMINI_TEMPERATURE`: optional generation temperature; unset by default

## Status
- [x] Next.js scaffold created and dev server verified
- [x] Idea chosen (PERSONA, now named Personify) and spec written
- [x] `gh`, `uv`, `vercel` CLIs installed and logged in (davidzhu314)
- [x] Pushed to GitHub repo (now public) davidzhu314/HackNCSuperSecretProject (`origin/main`, merged with its initial README commit)
- [x] Vercel project linked and deployed (https://hackathon-app-nu.vercel.app). Model vars aren't set on Vercel; code defaults apply.
- [x] OpenRouter key in `.env.local` and verified (`scripts/llm_check.py` passes with `anthropic/claude-haiku-5.5`). Switched from Gemini direct: the Google AI Studio key returned 401 on every endpoint.
- [x] shadcn/ui (button, card, tabs, checkbox, badge, textarea, label), zod, `openai`, `diff`, lucide-react installed
- [x] Schemas (`schemas.ts`) and demo persona (`demo-data.ts`)
- [x] LinkedIn flow end to end (hour 12 checkpoint): placeholder UI in `src/components/`, driven live in Chrome. Lovable redesign to be ported in.
- [x] FactCheck with tests (`fact-guard.ts`, vitest: `npm test`)
- [x] LLM client, rubrics, prompts, and API routes `facts/extract`, `evaluate`, `rewrite` (verified live against OpenRouter with the demo persona)
- [x] Hinge mode
- [x] Live on Vercel (https://hackathon-app-nu.vercel.app); configure `GEMINI_API_KEY` in the deployment environment before deploying this Gemini integration
- [x] Sections phase, data/AI side: section schemas and `profile.ts` (#7), PDF import (#9), live `/api/rewrite-section` (#10), 8 lenses in 4 categories (#11), `factCoverage` per section
- [x] Sections phase, UI side (#5, #6, #8, #14; Person 2: section editor and PDF upload, lens picker, Audience Clash redesign, per-section rewrite screen, consent once, demo hub)
- [x] Sections build tested live and deployed
- [x] Scenic UI merged from Lovable, Identity Hub with shared session, "Use this version", write once / per-platform facts (sample mode only; not yet deployed or run live)
- [x] Full Tinder profile: About me, 42 prompts, profile fields, LinkedIn carry-over, PDF languages import (merged to `main` in PR #34)
- [x] Progress bar for AI requests and the Lie Checker on added facts (on `main`)
- [ ] Blind A/B (stretch)
- [ ] Demo rehearsed and backup video recorded
