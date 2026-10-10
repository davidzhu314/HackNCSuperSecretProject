# Handoff: PERSONA hackathon app

Written 2026-10-10 for the next Claude session. Read this, then [CLAUDE.md](CLAUDE.md) (rules, stack, status checklist), then [SPEC.md](SPEC.md) (full product spec). Also read [AGENTS.md](AGENTS.md): this is Next.js 16.4 / React 19.3, newer than your training data, so check `node_modules/next/dist/docs/` before writing Next code.

## State in one paragraph
Setup is finished and nothing product-side is built yet. The user (davidzhu314) is in a 24-hour hackathon with two teammates (all beginners) and the clock is running. The idea is decided (PERSONA), the spec is written, accounts and tooling work, the LLM key is verified, and `main` is pushed. The next job is to write code, starting with the schemas and FactCheck.

## The idea (decided)
**PERSONA**: users paste a LinkedIn or Hinge profile, tick the facts about themselves that are true ("Identity DNA"), pick simulated audiences, and get evidence-linked feedback plus rewrites grounded only in confirmed facts. A deterministic **FactCheck** layer flags invented numbers, entities, and inflated verbs ("contributed" becoming "led"). Principle: improve expression, don't invent identity. MVP is LinkedIn first, then Hinge. Everything else is out of scope. See SPEC.md for the data model, routes, FactCheck design, demo script, and the hour-by-hour plan with cut rules (if LinkedIn isn't end to end by hour 12, cut Hinge; never sacrifice FactCheck for polish).

How we got here, so you don't re-litigate it: the user first explored SkinOS (skincare budget optimizer, spec archived at `archive/SKINOS-SPEC.md`), then chose PERSONA after three drafts of the brief (original at `~/Downloads/IDEA (2).md`). The decision was based on feasibility and on FactCheck being a real deterministic feature. Don't reopen it unless asked.

## Key design decisions already made
- **Citations use segment IDs, not quoted text.** Split input into numbered segments server-side, have the model cite IDs, resolve quotes on the server. Free-text quotes fail exact-match checks because models alter whitespace and punctuation.
- **FactCheck never trusts the model's `usedFactIds`.** It checks numbers, entities, inflated verbs, and fact IDs deterministically. It must have tests. Never output "verified true"; say "no unsupported concrete claims detected".
- **Categorical ratings only** (`not_evident` / `weak` / `moderate` / `strong`). No percentages or hireability scores.
- **Demo/cached outputs are always labeled.** Consent screen names OpenRouter and the underlying model provider.

## What exists
- **Repo:** https://github.com/davidzhu314/HackNCSuperSecretProject (private), branch `main`, at `940a72f`, in sync with origin when this was written. Local path: `/Users/davidzhu/Desktop/hackathon-app`.
- **App:** create-next-app scaffold plus shadcn/ui (button, card, tabs, checkbox, badge, textarea, label) and `src/lib/utils.ts`. Installed: `zod` 4, `openai` 7 (for OpenRouter), `diff` 9, `lucide-react`. `npm run build` passes. No test runner yet; add `vitest` for FactCheck.
- **Deployed:** Vercel project `dz-ll/hackathon-app`, hello-world live at https://hackathon-app-nu.vercel.app (assigned to production on first deploy). `.vercel/` is gitignored. Vercel env vars are **not** set yet.
- **Logins:** `gh` and `vercel` are both logged in as davidzhu314. Also installed: `uv`, Node v26, Python 3.10.13.
- **Python:** `.venv/` (gitignored) with `openai` and `python-dotenv`. `scripts/llm_check.py` tests the OpenRouter key and a strict-JSON-schema call: `.venv/bin/python scripts/llm_check.py`. It passed.

## LLM setup
- Provider is **OpenRouter** via the `openai` SDK with `baseURL: https://openrouter.ai/api/v1`. Server-side only.
- `.env.local` (gitignored) holds `OPENROUTER_API_KEY` (set, verified working) and `OPENROUTER_MODEL=anthropic/claude-haiku-5.5`, plus a `VERCEL_OIDC_TOKEN` that `vercel link` added. Leave that line alone.
- Haiku passed a strict-JSON-schema test, but that is one small sample. It was picked from a price-sorted list (about $0.10 in / $0.50 out per 1M tokens), not from a quality comparison. Fallback: `google/gemini-3.1-flash-lite`.
- **Suggested experiment:** once the real rewrite prompt exists, run it on Haiku and a stronger model and compare how often FactCheck flags each. If the stronger one is clearly better, add `OPENROUTER_REWRITE_MODEL` and use it for `/api/rewrite` only; keep Haiku for `/api/evaluate`.
- Why not Gemini directly: the user's Google AI Studio keys (new "auth key" format, `AQ.` prefix, introduced May 28, 2026) returned 401 on every endpoint and SDK. Cause never found. Don't spend time on it.

## Do first (in order)
1. `src/lib/schemas.ts`: zod schemas from SPEC.md's data model. This is the contract the three teammates build against.
2. `src/lib/demo-data.ts`: fictitious persona, 4–6 facts, a vague LinkedIn bio, a Hinge sample, labeled cached outputs.
3. `src/lib/segments.ts` and `src/lib/fact-guard.ts` with `vitest` tests (fabricated metric, company, date, qualification, inflated verb, correct quote, legitimate paraphrase, unconfirmed fact, invalid ID). No API key needed.
4. `src/lib/llm.ts` (OpenRouter client, one retry on invalid JSON, zod validation) and `src/lib/rubrics.ts`.
5. API routes `facts/extract`, `evaluate`, `rewrite`, then the UI against mock JSON first.

## Open items for the user (not for you to do silently)
- **Revoke the leaked Gemini key.** Commit `933a9c6` put a real `AQ.` key in `.env.example` on GitHub (removed a minute later in `9b6e2be`, but still in history). Probably already dead, but it should be revoked at https://aistudio.google.com/apikey. History was not rewritten and shouldn't be without the user's say-so.
- Add teammates as collaborators on the repo.
- Add `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to Vercel (`vercel env add ...`) before deploying the real app. The user pastes secrets themselves.

## Working with this user
- Wants brutally honest assessments, concise answers, and a recommendation instead of a survey.
- Prefers you do installs and setup yourself. Confirm before outward-facing actions (push, deploy, deleting). The user approved pushes to this repo as part of "merge on top", and normal non-force pushes have been fine.
- **Never ask for or print API keys.** The user edits `.env.local` themselves; `open -e .env.local` opens it in TextEdit (it's a hidden file in Finder). Verify keys by length/prefix or a live test without echoing them.
- Don't build ahead of a decision. When the user said "don't do it", they meant read and advise only.

## Gotchas
- `.gitignore` has `.env*` then `!.env.example`, so `.env.example` is tracked. Keep real values out of it; it is the file that leaked a key once.
- A stray `~/hackathon-app` folder still holds old duplicate copies of CLAUDE.md, SPEC.md, and `archive/`. They are outdated (they still mention Gemini). Ignore them. The user hasn't decided whether to delete them.
- No dev server should be running. Check port 3000 before starting one.
- Commit with `-c user.name=davidzhu314 -c user.email=davidzhu314@gmail.com`, and add the attribution line your session's system reminder specifies. Don't commit `.env.local`, `.venv/`, or `.vercel/`.
- `CLAUDE.md` status checklist was last updated before the OpenRouter key verification and the push of the switch. Tick items as you finish them.
- This file is uncommitted. Commit it with your first batch of work if you want it in the repo.
