# Evals

Picks which OpenRouter model handles each task (`extract`, `evaluate`, `rewrite`) per platform, based on measurements rather than reputation. Production reads the choice from `src/lib/models.ts`.

## What's here

| Path | What it is |
|---|---|
| `schema.ts` | `EvalCaseSchema`: a profile plus gold facts, traps, audiences, and traits |
| `cases/linkedin/li-001..010.json` | 10 synthetic LinkedIn cases, **status: draft** |
| `cases/hinge/hg-001..010.json` | 10 synthetic Hinge cases, **status: draft** |
| `cases.test.ts` | Runs with `npm test`. Validates every case, checks FactCheck catches every non-semantic trap, and checks gold facts don't trip FactCheck |
| `candidates.ts` | The 3 models to compare plus the judge, with OpenRouter ids and prices |

Coverage per platform: 3 average, 2 sparse, 2 numbers-heavy, 2 already-good, 1 awkward.

## Traps

Each case has 3-4 **traps**: plausible things a rewrite must not claim. Each trap says what should catch it:

- `unsupported_number`, `unsupported_entity`, `inflated_verb`: FactCheck must flag it. `cases.test.ts` enforces this (50 traps today).
- `semantic`: FactCheck can't see it (a new hobby, "top 3" becoming "first", "slow" becoming "sub-3-hour"). Only the LLM judge or a human can catch these. These cases are FactCheck's known blind spots, and they belong in the demo's "limitations" line.

## Reviewing a draft case (human, about 5 min each)

1. Read the input. Would a real person write this? Add a typo or a gap if it's too clean.
2. `goldFacts`: is every fact actually stated in the input? Is anything stated missing?
3. `traps`: is each one tempting for a model, and is `expect` right?
4. Set `"status": "reviewed"`.
5. Run `npm test`. If a trap fails, either the trap is badly written or you found a real FactCheck gap.

## Not built yet

- **Runner** (`evals/run.ts`): needs `src/lib/llm.ts` and the real prompts, so it calls exactly what production calls. It will run each candidate over every case, save raw outputs to `evals/runs/` (gitignored), and record parse failures as results.
- **Scorer**: Zod parse rate, FactCheck warnings by kind, trap hits, citation validity, extraction recall against `goldFacts`, plus the pairwise judge for voice.
- **Rubric anchors** for voice fit and critique usefulness.

Rough cost of one full run (20 cases x 3 models x 3 tasks, rewrite run twice): well under $1 for the small models, a few dollars with Sonnet and the judge.
