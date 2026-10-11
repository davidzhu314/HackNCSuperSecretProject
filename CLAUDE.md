# Personify (hackathon app)

Start with [HANDOFF.md](HANDOFF.md) (current state and next steps), then the full spec: [SPEC.md](SPEC.md). Read [AGENTS.md](AGENTS.md) too: this Next.js version is newer than most training data. (The earlier SkinOS idea is archived in `archive/SKINOS-SPEC.md`; ignore it.)

## Idea
**Personify** (earlier name: PERSONA) — "One identity. Every platform. Authentically you." Users enter a LinkedIn profile by sections (or import LinkedIn's PDF export) or Hinge answers, confirm a few true facts about themselves, pick simulated audiences, and get evidence-linked feedback plus rewrites grounded only in confirmed facts. A deterministic **FactCheck** layer flags invented numbers, entities, and inflated verbs. Principle: improve expression, not invent identity.

## Stack
- Next.js 16 (App Router, `src/app/`), React 19, TypeScript, Tailwind CSS
- shadcn/ui, lucide-react, zod, `diff`
- LLM via OpenRouter (`openai` SDK, baseURL `https://openrouter.ai/api/v1`), server-side only, low temperature, JSON/structured output validated with zod (retry once on invalid JSON)
- No database or auth. React state plus localStorage (non-sensitive prefs only)
- npm, deployed on Vercel

## Commands
- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build. Run before every deploy.
- `npm run lint`: ESLint
- Deploy: `vercel` (preview) or `vercel --prod`

## Layout
- `src/app/`: pages plus `api/facts/extract`, `api/evaluate`, `api/rewrite` (Hinge), `api/rewrite-section` (LinkedIn, one section per call), `api/compare` (stretch)
- `src/components/`: `PersonaFlow` (the flow), `LinkedInEditor`, `ProfileClash`, `SectionRewrites` (LinkedIn), `ProfileInput`, `AudienceClash`, `RewriteComparison` (Hinge), `IdentityFacts`, `AudienceSelection`
- `src/app/hub/` (`IdentityHub`): sources (LinkedIn PDF, photo) and real fact coverage; `src/app/studio/`: the flow (`?platform=hinge`). Home is the scenic LinkedIn/Hinge destinations; the studio shows the platform's photo with `TourStops` as the step rail (merged from the Lovable aero-persona-hub design)
- `src/lib/identity-session.ts`: memory-only session shared by hub and studio (profiles, facts, photo); cleared on refresh, never sent or stored
- `src/lib/fact-platforms.ts`: write once, show up everywhere. One fact pool; each fact is shared with chosen platforms (found facts default to where they were found, typed facts to all). The studio's `confirmedFacts` is filtered by platform, so an unshared fact can't support a claim there. "Start from my facts" seeds an empty Hinge or LinkedIn About with the user's own confirmed sentences
- `src/lib/profile-edits.ts`: "Use this version" (write a section rewrite into the profile, undo), copy-all text, Hinge fact coverage. The studio keeps the pre-rewrite profile as `original` so FactCheck and rewrites still check against the user's own words
- `src/lib/`: `llm.ts`, `rubrics.ts`, `fact-guard.ts`, `segments.ts`, `schemas.ts`, `demo-data.ts`, `profile.ts` (sections, segment ids like `exp2-s1`, per-section FactCheck corpus, `factCoverage`), `linkedin-pdf.ts` (browser-side PDF import via `pdfjs-dist`)

## Rules
- Audiences are simulated lenses, defined by what they look for, never demographics. No hireability/match percentages, no predictions, no made-up scores (only real counts). The "simulated AI feedback" label is dropped for now (user decision).
- Only **confirmed** facts may support generated claims. Never invent credentials, numbers, employers, dates, hobbies, or preferences.
- Evidence uses **segment IDs**, not free-text quotes: split input into numbered segments server-side, have the model cite IDs, resolve quotes on the server. Flag unknown IDs.
- FactCheck is deterministic TypeScript and must have tests. Never trust model `usedFactIds`. Never say "verified true"; say "no unsupported concrete claims detected".
- Consent before any text goes to the AI provider (OpenRouter plus the underlying model provider). Asked once per browser (a `localStorage` flag only, with a way to withdraw); every API request still sends `consent: true` and is rejected without it. Never log or persist profile text by default.
- Never commit a real person's profile (the repo is public). Test with real exports locally only; commit synthetic fixtures.
- Demo/cached outputs must be visibly labeled. Never disguise them as live runs. No silent fake results.
- Never expose `OPENROUTER_API_KEY` to the browser. Read it from `process.env` in server code only.
- Secrets live in `.env.local` (gitignored). `.env.example` lists names only. Never commit `.env*` values or paste keys into chat.
- Use current official OpenRouter docs, not memory. Verify the chosen model actually returns valid structured JSON before relying on it.
- Define zod schemas first; build UI against mock JSON so work can run in parallel.
- Make sure `npm run build` passes before saying something is done.
- Don't run `npm audit fix --force`. The current audit warnings are in dev tooling and accepted.

## Environment variables
- `OPENROUTER_API_KEY`: server-side OpenRouter key
- `OPENROUTER_REWRITE_MODEL`: optional model for `/api/rewrite` and `/api/rewrite-section` (default `anthropic/claude-sonnet-5.5`; picked after a one-sample comparison against haiku-5.5, gemini-3.1-flash-lite, gemini-3.8-flash). Extract and evaluate use `OPENROUTER_MODEL`.
- `OPENROUTER_TEMPERATURE`: optional. Unset by default because `anthropic/claude-haiku-5.5` has no OpenRouter endpoint that accepts `temperature` (with `require_parameters` it 404s). Set only for models that support it.
- `OPENROUTER_MODEL`: model id (default `anthropic/claude-haiku-5.5`, ~$0.10 in / $0.50 out per 1M tokens; must support structured output; fallback `google/gemini-3.1-flash-lite`)

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
- [x] Live on Vercel (https://hackathon-app-nu.vercel.app); `OPENROUTER_API_KEY` set for Production
- [x] Sections phase, data/AI side: section schemas and `profile.ts` (#7), PDF import (#9), live `/api/rewrite-section` (#10), 8 lenses in 4 categories (#11), `factCoverage` per section
- [x] Sections phase, UI side (#5, #6, #8, #14; Person 2: section editor and PDF upload, lens picker, Audience Clash redesign, per-section rewrite screen, consent once, demo hub)
- [x] Sections build tested live and deployed
- [x] Scenic UI merged from Lovable, Identity Hub with shared session, "Use this version", write once / per-platform facts (sample mode only; not yet deployed or run live)
- [ ] Blind A/B (stretch)
- [ ] Demo rehearsed and backup video recorded
