# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Real users:** people polishing a LinkedIn profile (headline + About) or Hinge prompt answers who want it to read better without misrepresenting themselves. They arrive with existing text, paste it, and want concrete, trustworthy feedback and rewrites they can copy out.
- **HackNC judges:** evaluating the product in a short live demo. They need to grasp the trust mechanism (confirmed facts, cited evidence, deterministic FactCheck) fast, usually via the preloaded fictitious demo persona and sample mode.

## Product Purpose

"One identity. Every platform. Authentically you." The user pastes a profile, consents to sending it to the AI provider, confirms which suggested facts about themselves are true, picks simulated audiences, and gets evidence-linked feedback plus rewrites grounded only in confirmed facts. Success: a rewrite the user would actually post, with nothing invented in it.

Principle: improve expression, not invent identity.

## Positioning

Not "ChatGPT with a nicer UI":

1. Several simulated audience perspectives side by side, in one audience × trait matrix.
2. Every critique cites numbered source segments (`s1`, `s2`, ...); the server resolves quotes and flags unknown IDs, so clicking a critique highlights the exact sentence.
3. FactCheck is deterministic code, not a prompt: it flags unsupported numbers, entities, inflated verbs, invalid fact IDs, and loose claims.
4. Rewrites may only draw on facts the user confirmed. Suggested facts start unticked.

## Operating Context

- Flow (`/studio`): Profile → Consent → Facts → Audiences → Feedback → Rewrite. `/` is the landing page.
- LinkedIn is the lead platform and hero demo; Hinge proves the engine generalizes (per-answer rewrites keyed by segment ID; UI partially built).
- LinkedIn audiences: startup founder, technical recruiter, research/hiring lead; optional pasted job description. Hinge audiences: humor-, shared-interests-, serious-relationship-oriented.
- Two rewrite variations: Option A Direct, Option B Narrative. Users can edit a rewrite; FactCheck re-runs in the browser.
- Output leaves via copy; no posting, scraping, or OAuth.

## Capabilities and Constraints

- Ratings are categorical words only: Not evident / Weak / Moderate / Strong. No percentages, scores, stars, hireability, match predictions.
- All feedback labeled "simulated AI feedback"; audiences are simulated lenses, never real people, and descriptions avoid demographic stereotypes.
- Never say "verified true". When FactCheck finds nothing: "No unsupported concrete claims detected".
- Consent precedes any text going to OpenRouter and the underlying model provider, including fact extraction. Profile text is never stored or logged; localStorage only for non-sensitive prefs.
- Sample/cached outputs carry `source: "sample"` and a visible "Sample result" badge; never disguised as live. Sample mode only for the demo persona. The "95% at Google" FactCheck demo is labeled "Intentional test case".
- Seven platforms in three sections: Professional (LinkedIn, Handshake), Social (Instagram, Facebook, X), Dating (Hinge, Tinder). Each has its own simulated audiences, traits, and the platform's character limit. No dummy buttons for other platforms; every visible button works.
- No accounts, database, saved profiles, or auto-posting (out of scope by design).
- Stack: Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui on `@base-ui/react`, Vercel.
- **Open decision:** blind A/B comparison (stretch, not built).

## Brand Commitments

- Tagline: "One identity. Every platform. Authentically you."
- **Open decision:** product name. Repo and docs say PERSONA; the current UI says Personify. Neither is binding yet.
- Voice: plain, honest, no hype; never overclaims what FactCheck or the audiences can know.

## Evidence on Hand

- Fictitious demo persona and sample profiles (`src/lib/demo-data.ts`).
- Synthetic eval cases with traps (`evals/`), FactCheck unit tests (`src/lib/*.test.ts`).
- Live deploy: https://hackathon-app-nu.vercel.app.
- No real users, testimonials, usage numbers, or press exist. Do not fabricate any.

## Product Principles

1. Improve expression, not invent identity: every generated claim traces to a confirmed fact.
2. Show the evidence: claims, critiques, and warnings point at the user's own words.
3. Honest uncertainty: simulated, categorical, labeled; no false precision or predictions.
4. Consent before transmission, nothing retained after.
5. Legible in a demo, trustworthy in real use: the trust mechanism must be obvious at a glance, not buried.

## Accessibility & Inclusion

Works at phone width; labeled inputs; fully keyboard usable; good contrast. Audience lenses avoid demographic stereotypes.
