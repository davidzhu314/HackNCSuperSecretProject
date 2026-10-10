# PERSONA (hackathon app)

Full spec: [SPEC.md](SPEC.md). Read it before building anything. (The earlier SkinOS idea is archived in `archive/SKINOS-SPEC.md`; ignore it.)

## Idea
**PERSONA** — "One identity. Every platform. Authentically you." Users paste a LinkedIn or Hinge profile, confirm a few true facts about themselves, pick simulated audiences, and get evidence-linked feedback plus rewrites grounded only in confirmed facts. A deterministic **FactCheck** layer flags invented numbers, entities, and inflated verbs. Principle: improve expression, not invent identity.

## Stack
- Next.js 16 (App Router, `src/app/`), React 19, TypeScript, Tailwind CSS
- shadcn/ui, lucide-react, zod, `diff`
- Google Gemini via `@google/genai`, server-side only, low temperature, structured output
- No database or auth. React state plus localStorage (non-sensitive prefs only)
- npm, deployed on Vercel

## Commands
- `npm run dev`: dev server at http://localhost:3000
- `npm run build`: production build. Run before every deploy.
- `npm run lint`: ESLint
- Deploy: `vercel` (preview) or `vercel --prod`

## Layout
- `src/app/`: pages plus `api/facts/extract`, `api/evaluate`, `api/rewrite`, `api/compare` (stretch)
- `src/components/`: `IdentityFacts`, `AudienceClash`, `RewriteComparison`
- `src/lib/`: `gemini.ts`, `rubrics.ts`, `fact-guard.ts`, `segments.ts`, `schemas.ts`, `demo-data.ts`

## Rules
- Audiences are simulated lenses. Label everything "simulated AI feedback". No hireability/match percentages, no predictions.
- Only **confirmed** facts may support generated claims. Never invent credentials, numbers, employers, dates, hobbies, or preferences.
- Evidence uses **segment IDs**, not free-text quotes: split input into numbered segments server-side, have the model cite IDs, resolve quotes on the server. Flag unknown IDs.
- FactCheck is deterministic TypeScript and must have tests. Never trust model `usedFactIds`. Never say "verified true"; say "no unsupported concrete claims detected".
- Consent before any text goes to Gemini. Never log or persist profile text by default.
- Demo/cached outputs must be visibly labeled. Never disguise them as live runs. No silent fake results.
- Never expose `GEMINI_API_KEY` to the browser. Read it from `process.env` in server code only.
- Secrets live in `.env.local` (gitignored). `.env.example` lists names only. Never commit `.env*` values or paste keys into chat.
- Use current official `@google/genai` docs, not memory.
- Define zod schemas first; build UI against mock JSON so work can run in parallel.
- Make sure `npm run build` passes before saying something is done.
- Don't run `npm audit fix --force`. The current audit warnings are in dev tooling and accepted.

## Environment variables
- `GEMINI_API_KEY`: server-side Gemini key
- `GEMINI_MODEL`: model name (must support structured output)

## Status
- [x] Next.js scaffold created and dev server verified
- [x] Idea chosen (PERSONA) and spec written
- [x] `gh`, `uv`, `vercel` CLIs installed and logged in (davidzhu314)
- [ ] Push to GitHub: private repo davidzhu314/HackNCSuperSecretProject exists with existing commits on `main`; local repo has no remote yet
- [x] Vercel project linked and hello-world deployed (https://hackathon-app-nu.vercel.app). Still need `GEMINI_API_KEY` / `GEMINI_MODEL` added to Vercel env.
- [ ] Gemini key pasted into `.env.local` (file created, values blank) and model name chosen
- [x] shadcn/ui (button, card, tabs, checkbox, badge, textarea, label), zod, `@google/genai`, `diff`, lucide-react installed
- [ ] Schemas agreed (`schemas.ts`) and demo persona (`demo-data.ts`)
- [ ] LinkedIn flow end to end (hour 12 checkpoint)
- [ ] FactCheck with tests
- [ ] Hinge mode
- [ ] Blind A/B (stretch)
- [ ] Demo rehearsed and backup video recorded
