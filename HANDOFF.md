# Handoff: PERSONA / Personify hackathon app

Updated 2026-10-10 (evening) for the next Claude session. Read this, then [CLAUDE.md](CLAUDE.md) (rules, stack), then [SPEC.md](SPEC.md) (product spec). Also read [AGENTS.md](AGENTS.md): this is Next.js 16.4 / React 19.3, newer than your training data, so check `node_modules/next/dist/docs/` before writing Next code. [PROGRESS.md](PROGRESS.md) and [README.md](README.md) have more detail but predate the Personify UI (see "Stale docs").

## State in one paragraph
The app works end to end and is deployed. LinkedIn and Hinge both run live against OpenRouter: paste profile, consent, confirm facts, simulated audience feedback with clickable sentence citations, then two grounded rewrites (Option A direct, Option B narrative), each checked by deterministic FactCheck and an AI-cliché lint. The UI is the teammates' Lovable design ("Personify"), ported into `src/` by Izad Khokhar and wired to the real API. 146 tests pass, lint and build are clean. What's left is mostly demo prep, docs, and one urgent security item for the user.

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
- `src/components/PersonaFlow.tsx`: the six-step flow and its rules (no AI call before consent; only confirmed facts reach rewrite; sample mode only for the demo persona; new text means new consent; editing a fact un-ticks it).
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
- Next's dev server sometimes serves stale CSS after edits to `globals.css`; restart it.
- Kill the dev server by port when done: `lsof -ti:3000 -sTCP:LISTEN | xargs kill`.
If the user wants this repeatable, suggest `/run-skill-generator` to save it as a project skill.

## Stale docs
`README.md` and `PROGRESS.md` describe the earlier plain UI ("PERSONA", no Hinge, PROGRESS says 40 tests; it's now 146). The app is now branded **Personify** on screen. Update both once the user confirms the name. `CLAUDE.md`'s status checklist is also behind (Hinge is now done; the deploy is live).

## Next phase (split between two people)
LinkedIn by sections, PDF import, 8 lenses in 4 categories, Audience Clash redesign, per-section rewrites with a style dropdown, consent once per browser, and a demo-only Identity Hub. The work is split so the two sessions don't edit the same files:
- [HANDOFF-PERSON-1.md](HANDOFF-PERSON-1.md): profile data and AI (contract, PDF parser, `/api/rewrite-section`, FactCheck per section, lenses, limits, fact coverage).
- [HANDOFF-PERSON-2.md](HANDOFF-PERSON-2.md): interface (copy cleanup, consent once, section editor and PDF upload, lens picker, Audience Clash redesign, rewrite screen, hub).
User decisions for this phase are listed in both docs; notably the "Simulated AI feedback" label is dropped for now (overrides CLAUDE.md/SPEC.md until those are updated) and there is no real login.

## Still to do
1. User: revoke the leaked Gemini key (above).
2. Demo: rehearse the 90-second script in SPEC.md and record a backup video. Warm the site first.
3. Update README, PROGRESS.md, and the CLAUDE.md checklist for Personify, Hinge, and the live URL.
4. Evals: the 20 cases are drafts awaiting human review; a runner that compares models and a `src/lib/models.ts` don't exist yet.
5. Optional: blind A/B (stretch) only if everything else is solid.

## Working with this user
- Wants brutally honest assessments, concise answers, and a recommendation instead of a survey.
- Prefers you do installs and setup yourself. **Confirm before outward-facing actions** (push, deploy, deleting). They have approved pushes and deploys case by case; get a yes each time.
- **Never ask for or print API keys.** The user edits `.env.local` and Vercel env themselves (`vercel env add OPENROUTER_API_KEY production`). Verify by length/prefix or a live call without echoing values.
- Don't build ahead of a decision. When asked "what if…", answer and recommend; build when they say go.

## Gotchas
- **Never chain a deploy after a push with `| tail` or `;`.** That's how my local code got deployed without a teammate's commits once (pipe hid the rejected push). Use `git push origin main && vercel --prod --yes`.
- `.gitignore` must keep `.env*` then `!.env.example`. `.env.example` lists names only; it's the file that leaked a key.
- zsh doesn't word-split variables: `G="git -c …"; $G commit` fails. Write the command out.
- Commit with `-c user.name=davidzhu314 -c user.email=davidzhu314@gmail.com` plus the attribution line from your system reminder. Don't commit `.env.local`, `.venv/`, or `.vercel/`.
- shadcn components here are the **base-ui** variant (`Checkbox` uses `checked`/`onCheckedChange` and renders a hidden input too; `TabsContent` needs `keepMounted` to keep state).
- `diff`'s `diffWords` loses whitespace on the "old" side; use `diffWordsWithSpace`.
- A stray `~/hackathon-app` folder has outdated copies of the docs. Ignore it.
