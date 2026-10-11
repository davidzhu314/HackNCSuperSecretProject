# Handoff: Tinder, Person B (UI)

> **Done (2026-10-11):** built together with step 0 on `feat/tinder-profile`. Kept for reference only.

Written 2026-10-11. **Start only after the step 0 PR ([HANDOFF-TINDER-0-CONTRACT.md](HANDOFF-TINDER-0-CONTRACT.md)) is merged.** It provides the `TinderProfile` type, `TINDER_PROMPTS`, limits, field groups and option labels, and `MOCK_TINDER_PROFILE`. Its "Decisions" section has the user's answers. Background and design rules: [HANDOFF-TINDER.md](HANDOFF-TINDER.md). Rules: [CLAUDE.md](CLAUDE.md). Next.js 16 notes: [AGENTS.md](AGENTS.md); read `node_modules/next/dist/docs/` before writing Next code. Person A builds the data and AI side in parallel: [HANDOFF-TINDER-A.md](HANDOFF-TINDER-A.md).

## You own these files (Person A doesn't touch them)

New `src/components/TinderEditor.tsx`, `PersonaFlow.tsx`, `RewriteComparison.tsx`, `AudienceClash.tsx` (only if it needs changes), and `ConsentScreen.tsx`.

Don't edit `prompts.ts`, the API routes, `fact-guard.ts`, or `demo-data.ts`; Person A owns those. Build against `MOCK_TINDER_PROFILE` until Person A's PR is merged. If you need a contract change, make it a tiny separate PR and tell Person A.

## Tasks

1. **`TinderEditor`**, replacing `BioInput` for Tinder:
   - About me with a counter out of 500 (the existing `over_limit` warning applies)
   - A prompt picker plus answers. Reuse the Hinge form's pieces (see `PersonaFlow.tsx`, the `config.input === "prompts"` input step) instead of copying them.
     - Show each answer's character limit.
     - If the limits are assumed (see Decisions), say so in the UI.
   - Grouped field pickers (Basics, Lifestyle, Work & education, Location), from `TINDER_FIELD_GROUPS`.
     - Every field can be left blank.
     - The user picks every value; nothing is filled in by the AI.
   - Job title, company, school, and languages carry over from the LinkedIn profile in the shared session (`identity-session.ts`) via `tinderFromLinkedIn`. Until Person A's PR lands, a local mock is fine.
     - Tag carried-over values "from your LinkedIn".
     - The user can edit or clear each value.
2. **Wire `input: "tinder"` into `PersonaFlow.tsx`.** Cover input, segmenting (`segmentTinder`), the demo check, the Identity DNA and lens steps, Audience Clash, and the rewrite step.
   - On the rewrite step, show About and each answer separately, with FactCheck and limit warnings, reusing `RewriteComparison`.
   - Audience Clash shows comments on the writing only.
   - Check the other `config.input ===` branches (`api-client.ts`, `RewriteComparison.tsx`, `IdentityHub.tsx`), which may count Tinder as a bio platform today.
3. **Consent text** (`ConsentScreen.tsx`): list what's sent for Tinder (About, prompt answers, job, company, school, languages) and what isn't (location and the lifestyle and relationship answers), matching the step 0 decisions.
4. **Session:** keep the Tinder profile in the memory-only session like the other platforms (never `localStorage`, never sent anywhere except the API calls above).

## Check before handing off

- Live in headless Chrome (recipe in [HANDOFF-WRITING.md](HANDOFF-WRITING.md), "Gotchas"):
  - at desktop width and at 390px
  - every control works; no dead buttons
  - the carry-over works from an imported LinkedIn PDF: a synthetic one, or the user's real export locally only, never committed
- After Person A's PR merges: rebase, switch from the mock to the live routes, and run Priya end to end.
- `npm test`, `npm run lint`, and `npm run build` pass.
- Open a PR and ask the user before merging and deploying.

## Rules

Same as step 0: no real profile in the repo, no API keys, branch and PR, `git fetch` before pushing, ask before pushing, merging, deploying, or deleting.
