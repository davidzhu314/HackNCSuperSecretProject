# Personify

**One identity. Every platform. Authentically you.** Write once, show up everywhere.

**Live:** https://hackathon-app-nu.vercel.app (no login needed; click **Load demo persona** to try it). Home at `/` (pick LinkedIn or Hinge), the studio at `/studio`, your Identity Hub at `/hub`. Deploys are manual, so the live site can lag behind `main`.

Personify helps you improve your LinkedIn or Hinge profile without inventing anything about yourself. You enter your profile (LinkedIn section by section, or import LinkedIn's "Save to PDF" export), confirm which facts about you are true, and get:

1. **Audience feedback** from any of 8 simulated LinkedIn lenses, plus up to 3 questions of your own, (recruiters, hiring managers and technical leads, research and admissions reviewers, founders and industry peers), or 3 Hinge lenses. Every critique links to the exact sentence it is about.
2. **Rewrites (direct or narrative) that only use facts you confirmed**, checked by **FactCheck**, a deterministic layer that flags made-up numbers, names, and inflated verbs, plus a lint for AI clichés ("leverage", "delve", emoji bullets).

Principle: improve expression, not invent identity.

**Write once, show up everywhere.** You confirm each fact about yourself once and choose which platforms may use it. Every platform's rewrite is checked against that same set of facts, and the Identity Hub shows where each fact appears. Profiles themselves are never generated from scratch: each platform improves the text you already have, because that's what FactCheck checks against.

### The flow
1. **Home**: pick LinkedIn (city) or Hinge (town).
2. **Studio** on the platform's scenery: your profile → consent → audience lenses → Audience Clash → rewrite + FactCheck. Hinge adds an Identity DNA step (tick true facts) after consent; LinkedIn skips it because the profile itself is the evidence, and facts that aren't on the profile can be added on the rewrite screen.
3. **Use this version** on the rewrites you like (undoable), then **Copy updated profile**, **See it in your Identity Hub**, or take your facts to the other platform.
4. **Identity Hub**: your photo and LinkedIn PDF, every confirmed fact with where it's used and found, and LinkedIn coverage before → after the rewrites you used.

## Why this isn't just "ChatGPT with a nicer UI"

- **Several audiences on your actual profile.** Each reaction sits on the sentence it's about, rated in words (Not evident / Weak / Moderate / Strong), and "Where they disagree" shows sentences two audiences rate far apart. No scores or "hireability" percentages.
- **Evidence you can click.** The AI cites numbered sentences (`about-s2`, `exp1-s3`, ...), not quotes, and the server checks every citation. Clicking a critique highlights the exact sentence; made-up citations are dropped and flagged.
- **FactCheck is code, not a prompt.** It compares the rewrite against your original text and confirmed facts and flags:
  - numbers and dates you never gave (including "two hundred" or "95 percent")
  - names (companies, schools, certifications) that weren't there
  - stronger verbs than your facts support ("contributed" turned into "led")
  - fact IDs that don't exist or that you didn't confirm
  - sentences that barely match anything you said, for you to review
- **Only confirmed facts count.** Suggested facts start unticked, and unticked facts can't support a claim.
- **Receipts.** Each rewritten sentence shows which of your sentences or confirmed facts it came from, or that it couldn't be traced.
- **Facts are per platform.** Each confirmed fact is shared with the platforms you choose; a fact you didn't share with Hinge can't support a claim on Hinge.
- **Accepted rewrites don't become their own evidence.** After "Use this version", rewrites and FactCheck keep working from your original text.

When FactCheck finds nothing, the app says "No unsupported concrete claims detected", never "verified". It catches concrete claims, not every subtle exaggeration.

## Feature checklist

| Feature | Status |
|---|---|
| LinkedIn: enter by section, consent, confirm facts, audience feedback, grounded rewrite | Implemented, tested live |
| Clickable evidence (segment IDs checked on the server) | Implemented |
| FactCheck (numbers, names, verbs, fact IDs, loose claims) | Implemented, with unit tests |
| FactCheck re-runs when you edit the rewrite | Implemented |
| Rewrite styles: Direct, Narrative, and Professional for LinkedIn sections (Hinge: Direct and Narrative) | Implemented; each style has checkable rules (e.g. no first person in Professional) and a retry if they break |
| AI-cliché lint (banned words, phrases, emoji bullets) | Implemented, shown as style suggestions |
| Consent before anything is sent to the AI | Asked once per browser, can be withdrawn; every API request is still rejected without it |
| Sample mode for the demo persona | Cached demo data, always labeled "Sample result" |
| "FactCheck demo" (the "95% at Google" rewrite) | Cached, labeled "Intentional test case" |
| Job-description targeting | Implemented (optional field) |
| Hinge mode (prompt answers, rewritten answer by answer) | Implemented |
| 8 LinkedIn audience lenses in 4 categories (pick any; evaluated in parallel, one AI call per lens) plus up to 3 questions you type | Implemented |
| LinkedIn by sections (headline, About, each entry), per-section rewrites with a style choice and a length slider (much shorter to much longer), "Rewrite all" (3 at a time) | Implemented, tested live. "Longer" only adds detail your sources contain; with nothing more to say, it stops short and says so |
| Import LinkedIn's "Save to PDF" export (parsed in the browser) | Implemented, with a review banner for parser warnings |
| Audience Clash on the annotated profile (reaction cards, filters, "Where they disagree", "Nobody could find") | Implemented (LinkedIn; Hinge uses the simpler grid) |
| Receipts: where each rewritten sentence came from | Implemented |
| Identity Hub (`/hub`): photo, LinkedIn PDF, your facts across platforms, coverage before → after | Implemented; session only (memory, cleared on refresh), no accounts |
| Scenic UI: LinkedIn / Hinge destinations, the platform's scenery behind the studio, step "pearls" | Implemented (merged from the team's Lovable design) |
| "Use this version" for a section rewrite (undoable), "Copy updated profile" | Implemented (LinkedIn; Hinge is copy-only) |
| Write once, show up everywhere: per-fact LinkedIn / Hinge sharing, "Start from my facts" | Implemented |
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
/api/rewrite ──> 2 versions from confirmed facts only ──> FactCheck + cliché lint on each   (Hinge)
/api/rewrite-section ──> one LinkedIn section, one style ──> FactCheck against that section's sources
```

For a LinkedIn entry (one job, school, or project), FactCheck accepts only that entry's own text plus your confirmed facts, so a number or name from one job can't move into another. Headline and About may draw on the whole profile.

- **AI provider:** [OpenRouter](https://openrouter.ai), called only from the server. Extract and evaluate use `anthropic/claude-haiku-5.5`; the rewrite uses `anthropic/claude-sonnet-5.5`. We picked these after comparing four models on the same inputs.
- **Structured output:** every AI response must match a strict JSON schema, is validated with zod, and is retried once if it doesn't.
- **Privacy:** profile text is not stored or logged. The API key never reaches the browser.

Key files: `src/lib/fact-guard.ts` (FactCheck), `src/lib/profile.ts` (profile sections and segment ids), `src/lib/linkedin-pdf.ts` (PDF import), `src/lib/identity-session.ts` (the in-memory session shared by hub and studio), `src/lib/fact-platforms.ts` (which platforms each fact is used on), `src/lib/profile-edits.ts` ("Use this version"), `src/lib/style-check.ts` (cliché lint), `src/lib/schemas.ts` (data shapes), `src/lib/llm.ts` (AI client), `src/lib/prompts.ts`, `src/app/api/*`, `src/components/PersonaFlow.tsx` (the page flow).

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
| `OPENROUTER_REWRITE_MODEL` | No | `anthropic/claude-sonnet-5.5` (rewrite, rewrite-section) |
| `OPENROUTER_TEMPERATURE` | No | unset. Anthropic models on OpenRouter don't accept it, so leave it empty for them. |

## Tests and checks

```bash
npm test          # 266 tests: FactCheck, PDF parser, profile sections, clash, receipts, consent, session, fact platforms, AI client, sample data
npm run lint
npm run build
```

Don't run `npm run build` while `npm run dev` is running: both write to `.next/`, and the dev server then serves an old stylesheet. If styles look wrong, stop the server, `rm -rf .next`, and restart.

## Deploy (Vercel)

```bash
vercel env add OPENROUTER_API_KEY production   # paste the key when prompted
vercel --prod
```

## Limits we know about

- Entity detection is a capitalization heuristic, not full named-entity recognition. It can miss a name at the very start of a sentence and occasionally flags an ordinary word.
- FactCheck catches concrete claims, not tone. A rewrite can still sound grander than you are without tripping it.
- Audiences are simulated lenses written by us, not real recruiters, and the feedback doesn't predict hiring outcomes.
