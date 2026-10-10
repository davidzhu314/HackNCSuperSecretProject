# PERSONA: progress so far

Updated 2026-10-10. This covers the backend work since setup finished. For the product idea and rules, see [SPEC.md](SPEC.md) and [CLAUDE.md](CLAUDE.md).

## Where things stand

The backend is done and works against the real AI. There is no UI yet: the home page is still the starter page. Next step is the UI.

- **Built:** data shapes, demo data, FactCheck, the AI client, and three API routes.
- **Checked:** 27 automated tests pass, lint is clean, and `npm run build` passes. All three routes were tested live with the fictitious demo persona.
- **Not built:** every screen, Hinge testing end to end, blind A/B (stretch goal).

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

1. **UI:** paste screen, fact checkboxes, consent screen, audience feedback, and rewrite comparison. Build it against the sample data in `demo-data.ts` first.
2. **Hinge:** the backend supports it, but it hasn't been tested end to end.
3. **Vercel:** add `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to Vercel before deploying the real app.
4. **Security:** revoke the old Gemini key that was briefly committed in `933a9c6`, at https://aistudio.google.com/apikey.
5. **Demo:** rehearse it and record a backup video.
