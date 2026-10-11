# Handoff: PERSONA / Personify hackathon app

> **Newer handoff:** the next session's goal is rewrite quality. Start with [HANDOFF-WRITING.md](HANDOFF-WRITING.md); it also lists what changed since this file was written.

Updated 2026-10-10 (late night) for the next Claude session. Read this, then [CLAUDE.md](CLAUDE.md) (rules, stack), then [SPEC.md](SPEC.md) (product spec). Also read [AGENTS.md](AGENTS.md): this is Next.js 16.4 / React 19.3, newer than your training data, so check `node_modules/next/dist/docs/` before writing Next code. [PROGRESS.md](PROGRESS.md) and [README.md](README.md) have more detail.

## State in one paragraph
The app works end to end, is deployed, and has been tested live. LinkedIn is entered by section (or imported from LinkedIn's PDF export), then consent (once per browser), confirm facts, pick up to 3 of 8 lenses, Audience Clash on the annotated profile, and per-section rewrites (Direct or Narrative) each checked by deterministic FactCheck, the AI-cliché lint, and receipts. Hinge keeps its prompt-answer flow. The UI is the scenic design merged from the team's Lovable project (destinations home, the platform's photo behind the studio). The Identity Hub (`/hub`) and studio share an in-memory session (`identity-session.ts`): profiles, facts, and photo follow the user between pages, cleared on refresh. Facts are written once and shared per platform (`fact-platforms.ts`); "Use this version" puts a section rewrite into the profile while FactCheck keeps checking the original (`profile-edits.ts`). Everything is merged to `main`; **the live site has not been redeployed since the sections phase.** 266 tests pass, lint and build are clean. What's left is a deploy, one live run, demo prep, and one security item for the user.

## URGENT for the user (not for you to do)
- **The repo is now PUBLIC** (https://github.com/davidzhu314/HackNCSuperSecretProject), so the Gemini key committed in `933a9c6` (`.env.example`, `GEMINI_API_KEY=AQ.…`) is publicly readable in history. The user must revoke it at https://aistudio.google.com/apikey. A full history scan found no other keys; the OpenRouter key was never committed. Don't rewrite history without the user's explicit say-so.

## Live
- **URL:** https://hackathon-app-nu.vercel.app (public, no login). Home page at `/`, the flow at `/studio`.
- **Deploys are manual:** `vercel --prod --yes` from the repo root. Pushing to GitHub does **not** deploy (no Git integration; every deployment so far was a CLI deploy by davidzhu314). Ask the user before each deploy.
- Vercel env: `OPENROUTER_API_KEY` is set for Production. The model vars are not set there; the code defaults apply.
- **Cold start:** right after a deploy, the first scripted runs failed; reruns a minute later passed. Before a demo, click through one sample run to warm it up. Sample mode is the fallback if the API is slow.
- Deployment Protection is on (Vercel default): per-deployment URLs (`hackathon-xxxx-dz-ll.vercel.app`) ask for a login; the main domain doesn't. Share only the main domain.

## Team
- **davidzhu314** (the user): runs these Claude sessions.
- **Izad Khokhar**: merged PR #1 (evals scaffold), #2 (Hinge prompts and per-answer rewrites), #3 (Lovable UI port). Uses Claude too (`.claude/launch.json`).
- **VedhK123**: pushed earlier fixes (long-sentence chunking in `segments.ts`, layout changes). Their change narrowing `.gitignore` to `.env.local` was reverted to `.env*`; tell them why if it comes up.
- Teammates push to `main` directly and via PRs. **Always `git fetch` and check `HEAD..origin/main` before pushing or deploying.**

## Architecture (what's where)
- `src/lib/schemas.ts`: zod contract for everything. Rewrite response is `{ source, variations: [{ style: "direct"|"narrative", rewrite, warnings, styleWarnings }] }`.
- `src/lib/segments.ts`: splits input into `s1, s2…` (long sentences are chunked, never truncated). The model cites IDs; the server resolves them and drops unknown ones.
- `src/lib/fact-guard.ts`: **FactCheck**, deterministic: numbers (incl. word numbers, %), capitalized entities (heuristic, with an allowlist of generic title-case words; job titles stay flagged), inflated verbs (ranked list, irregular forms), fact IDs, and a loose-claim word-overlap check ("Needs your review").
- `src/lib/style-check.ts`: AI-cliché lint (banned words/phrases from the team's copywriting prompt, emoji bullets). Shown as "Style suggestions", separate from FactCheck. The prompt's ban list is generated from the same list.
- `src/lib/llm.ts`: OpenRouter via `openai` SDK, strict `json_schema`, `provider.require_parameters: true`, zod validation, one retry. Server only.
- `src/lib/prompts.ts`, `rubrics.ts`, `postprocess.ts`: prompts (fact rules always above style rules), audience/trait configs, server-side cleanup (`buildCritiques`, `buildVariations`).
- `src/app/api/{facts/extract,evaluate,rewrite}/route.ts`: all require `consent: true` (403 otherwise).
- `src/lib/api-client.ts`: browser-side calls plus labeled sample mode.
- `src/components/PersonaFlow.tsx`: the six-step flow and its rules (no AI call before consent; only confirmed facts shared with this platform reach a rewrite; sample mode only for the demo persona; editing a fact un-ticks it). The platform comes from the URL (`/studio?platform=hinge`); switching navigates.
- `src/lib/identity-session.ts`: memory-only store (useSyncExternalStore) shared by studio and hub. Next 16 keeps left pages mounted but hidden (Cache Components / Activity), so the studio writes only values it actually changed, and hub edits bump `rev`, which the studio is keyed on (`StudioFromUrl`).
- `src/lib/fact-platforms.ts`, `src/lib/profile-edits.ts`: per-platform facts and "Start from my facts"; "Use this version" / undo, with the pre-rewrite profile kept as `original`.
- `src/components/IdentityHub.tsx`, `StudioFinish.tsx`, `TourStops.tsx`, `Chrome.tsx`: hub, end-of-studio next steps, step rail, scenic chrome.
- `evals/`: 20 synthetic draft cases (LinkedIn and Hinge) with traps; `evals/cases.test.ts` runs in `npm test`. Its README mentions `src/lib/models.ts`, **which doesn't exist yet**.

## Model decisions (measured, one sample each, so first impressions)
- Extract and evaluate: `anthropic/claude-haiku-5.5` (cheap, fast, sensible). Rewrite: `anthropic/claude-sonnet-5.5` (`OPENROUTER_REWRITE_MODEL` overrides). Two versions take about 11-12s live.
- `gemini-3.1-flash-lite`: invented skills, useless feedback. `gemini-3.8-flash`: slow, cited segment IDs as fact IDs. Not used.
- **No Anthropic model on OpenRouter accepts `temperature`**; with `require_parameters` the request 404s. So temperature is opt-in via `OPENROUTER_TEMPERATURE` and unset by default. Don't "fix" this by adding temperature back.
- Known blind spot: models make small soft inferences ("my TA role gave me practice explaining") that FactCheck can't see. It catches concrete claims only; say so in the demo.

## Testing the real app (browser)
`chromium-cli` isn't installed. What worked: `playwright-core` installed in a scratch folder (not the project), driving the installed Chrome with `chromium.launch({ channel: "chrome", headless: true })`. Run `npm run dev`, poll `http://localhost:3000`, then script the flow at `/studio`. Gotchas:
- In sample mode the consent button is **"Continue with samples"**, not "I agree, continue".
- The step tab "6 Rewrite + FactCheck" also matches `/rewrite/i` and is disabled; use exact names ("Rewrite my profile", "Generate rewrites").
- Next's dev server sometimes serves stale CSS after edits to `globals.css`: stop it, `rm -rf .next/dev`, restart.
- The first `/studio` load after a restart takes ~15s to hydrate (pdfjs compiles). Wait before clicking.
- Kill the dev server by port when done: `lsof -ti:3000 -sTCP:LISTEN | xargs kill`.
If the user wants this repeatable, suggest `/run-skill-generator` to save it as a project skill.

## Stale docs
None known. README, PROGRESS, CLAUDE.md, and this file were updated after the write-once work merged. `HANDOFF-PERSON-1.md` and `HANDOFF-PERSON-2.md` are finished work orders, kept as a record.

## Sections phase (done)
LinkedIn by sections, PDF import, 8 lenses in 4 categories, Audience Clash redesign, per-section rewrites with a style dropdown, consent once per browser, and a demo-only Identity Hub. It was split so the two sessions didn't edit the same files:
- [HANDOFF-PERSON-1.md](HANDOFF-PERSON-1.md): profile data and AI (contract, PDF parser, `/api/rewrite-section`, FactCheck per section, lenses, limits, fact coverage).
- [HANDOFF-PERSON-2.md](HANDOFF-PERSON-2.md): interface (copy cleanup, consent once, section editor and PDF upload, lens picker, Audience Clash redesign, rewrite screen, hub).
User decisions for this phase are listed in both docs; notably the "Simulated AI feedback" label is dropped for now (overrides CLAUDE.md/SPEC.md until those are updated) and there is no real login.

## Still to do
1. User: revoke the leaked Gemini key (above).
2. Deploy `main` (ask first) and do one live run on the production URL: today's features were only checked in sample mode.
3. Demo: rehearse the 90-second script in SPEC.md, leading with "try to make me lie" (a judge edits a rewrite; FactCheck flags it in the browser with no AI call). Record a backup video. Warm the site first.
4. Evals: the 20 cases are drafts awaiting human review. The live false-positive sweep exists (`evals/fp-sweep.test.ts`); a model-comparison runner doesn't.
5. Optional: "Use this version" for Hinge (needs per-answer rewrite output), blind A/B.

## Working with this user
- Wants brutally honest assessments, concise answers, and a recommendation instead of a survey.
- Prefers you do installs and setup yourself. **Confirm before outward-facing actions** (push, deploy, deleting). They have approved pushes and deploys case by case; get a yes each time.
- **Never ask for or print API keys.** The user edits `.env.local` and Vercel env themselves (`vercel env add OPENROUTER_API_KEY production`). Verify by length/prefix or a live call without echoing values.
- Don't build ahead of a decision. When asked "what if…", answer and recommend; build when they say go.

## Gotchas
- **Never run `npm run build` while `npm run dev` is running.** Both write under `.next/`, and the dev server then keeps serving an old stylesheet (the home page shows one full-screen photo with an unstyled link). Fix: stop the server, `rm -rf .next`, restart, and hard-refresh the browser (Cmd+Shift+R).
- **Never chain a deploy after a push with `| tail` or `;`.** That's how my local code got deployed without a teammate's commits once (pipe hid the rejected push). Use `git push origin main && vercel --prod --yes`.
- `.gitignore` must keep `.env*` then `!.env.example`. `.env.example` lists names only; it's the file that leaked a key.
- zsh doesn't word-split variables: `G="git -c …"; $G commit` fails. Write the command out.
- Commit with `-c user.name=davidzhu314 -c user.email=davidzhu314@gmail.com` plus the attribution line from your system reminder. Don't commit `.env.local`, `.venv/`, or `.vercel/`.
- shadcn components here are the **base-ui** variant (`Checkbox` uses `checked`/`onCheckedChange` and renders a hidden input too; `TabsContent` needs `keepMounted` to keep state).
- `diff`'s `diffWords` loses whitespace on the "old" side; use `diffWordsWithSpace`.
- A stray `~/hackathon-app` folder has outdated copies of the docs. Ignore it.
