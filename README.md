# PERSONA

**One identity. Every platform. Authentically you.**

**Live:** https://hackathon-app-nu.vercel.app (no login needed; click **Load demo persona** to try it)

PERSONA helps you improve your LinkedIn profile without inventing anything about yourself. You paste your profile, confirm which facts about you are true, and get:

1. **Simulated audience feedback** from a startup founder, a technical recruiter, and a research or hiring lead. Every critique links to the exact sentence it is about.
2. **A rewrite that only uses facts you confirmed**, checked by **FactCheck**, a deterministic layer that flags made-up numbers, names, and inflated verbs.

Principle: improve expression, not invent identity.

## Why this isn't just "ChatGPT with a nicer UI"

- **Several audiences side by side**, in one matrix, rated in words (Not evident / Weak / Moderate / Strong). No scores or "hireability" percentages.
- **Evidence you can click.** The AI cites numbered sentences (`s1`, `s2`, ...), not quotes, and the server checks every citation. Clicking a critique highlights the exact sentence; made-up citations are dropped and flagged.
- **FactCheck is code, not a prompt.** It compares the rewrite against your original text and confirmed facts and flags:
  - numbers and dates you never gave (including "two hundred" or "95 percent")
  - names (companies, schools, certifications) that weren't there
  - stronger verbs than your facts support ("contributed" turned into "led")
  - fact IDs that don't exist or that you didn't confirm
  - sentences that barely match anything you said, for you to review
- **Only confirmed facts count.** Suggested facts start unticked, and unticked facts can't support a claim.

When FactCheck finds nothing, the app says "No unsupported concrete claims detected", never "verified". It catches concrete claims, not every subtle exaggeration.

## Feature checklist

| Feature | Status |
|---|---|
| LinkedIn: paste, consent, confirm facts, audience feedback, grounded rewrite | Implemented, tested live |
| Clickable evidence (segment IDs checked on the server) | Implemented |
| FactCheck (numbers, names, verbs, fact IDs, loose claims) | Implemented, with unit tests |
| FactCheck re-runs when you edit the rewrite | Implemented |
| Consent before anything is sent to the AI | Implemented (enforced in the UI and by the API) |
| Sample mode for the demo persona | Cached demo data, always labeled "Sample result" |
| "FactCheck demo" (the "95% at Google" rewrite) | Cached, labeled "Intentional test case" |
| Job-description targeting | Implemented (optional field) |
| Hinge mode | Backend supports it; UI not built |
| Blind A/B comparison | Not built |
| Accounts, saving profiles, auto-posting | Out of scope by design |

## How it works

```
Paste profile ──> split into numbered sentences (s1, s2, ...)
      │
  Consent (nothing is sent before this)
      │
/api/facts/extract ──> suggested facts (never pre-confirmed) ──> you tick the true ones
      │
/api/evaluate ──> critiques citing sentence IDs ──> server drops unknown IDs
      │
/api/rewrite ──> rewrite from confirmed facts only ──> FactCheck ──> warnings shown with the text
```

- **AI provider:** [OpenRouter](https://openrouter.ai), called only from the server. Extract and evaluate use `anthropic/claude-haiku-5.5`; the rewrite uses `anthropic/claude-sonnet-5.5`. We picked these after comparing four models on the same inputs.
- **Structured output:** every AI response must match a strict JSON schema, is validated with zod, and is retried once if it doesn't.
- **Privacy:** profile text is not stored or logged. The API key never reaches the browser.

Key files: `src/lib/fact-guard.ts` (FactCheck), `src/lib/schemas.ts` (data shapes), `src/lib/llm.ts` (AI client), `src/lib/prompts.ts`, `src/app/api/*`, `src/components/PersonaFlow.tsx` (the page flow).

## Run it locally

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local     # then put your OpenRouter key in .env.local
npm run dev                    # http://localhost:3000
```

Get an OpenRouter API key at https://openrouter.ai/keys. Without a key, the app still runs in sample mode: click **Load demo persona**, then tick **Use sample results** on the consent screen.

### Environment variables

| Name | Required | Default |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes, for live AI | none |
| `OPENROUTER_MODEL` | No | `anthropic/claude-haiku-5.5` (extract, evaluate) |
| `OPENROUTER_REWRITE_MODEL` | No | `anthropic/claude-sonnet-5.5` (rewrite) |
| `OPENROUTER_TEMPERATURE` | No | unset. Anthropic models on OpenRouter don't accept it, so leave it empty for them. |

## Tests and checks

```bash
npm test          # FactCheck, AI client, post-processing, sample data
npm run lint
npm run build
```

## Deploy (Vercel)

```bash
vercel env add OPENROUTER_API_KEY production   # paste the key when prompted
vercel --prod
```

## Limits we know about

- Entity detection is a capitalization heuristic, not full named-entity recognition. It can miss a name at the very start of a sentence and occasionally flags an ordinary word.
- FactCheck catches concrete claims, not tone. A rewrite can still sound grander than you are without tripping it.
- Audiences are simulated lenses written by us, not real recruiters, and the feedback doesn't predict hiring outcomes.
