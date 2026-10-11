# Handoff: a full Tinder profile

Written 2026-10-11 for a future Claude session (current as of `main` 4c7ef0f). **Plan only: nothing here is implemented yet.** Read [CLAUDE.md](CLAUDE.md) (rules) and [AGENTS.md](AGENTS.md) (Next.js 16.4) first. [HANDOFF-WRITING.md](HANDOFF-WRITING.md) is the other queued task (rewrite quality). Ask the user which comes first.

## Split for two people (2026-10-11)

> **Done:** all three parts were built in one branch, `feat/tinder-profile`. What's left: Tinder's real option lists and prompt limits (assumed for now; see the step 0 decisions), and Tinder sample results (Tinder always runs live).

The user moved this ahead of [HANDOFF-WRITING.md](HANDOFF-WRITING.md). The work is split so two sessions can run at once:
1. [HANDOFF-TINDER-0-CONTRACT.md](HANDOFF-TINDER-0-CONTRACT.md): the open questions and the shared contract. One small PR; **it blocks both halves**.
2. In parallel after that: [HANDOFF-TINDER-A.md](HANDOFF-TINDER-A.md) (data and AI) and [HANDOFF-TINDER-B.md](HANDOFF-TINDER-B.md) (UI). Their files don't overlap.
3. Merge order: step 0, then A, then B (rebased onto main and switched from the mock to the live routes), then a joint live check. The user approves the deploy.

This file stays the background and the design rules for all three.

## Goal

Today the Tinder section is a single "About me" box. The user wants it to look like a real Tinder profile:
1. **About me** (500 characters).
2. **Tinder prompts**: pick prompts and answer them (the user's list is below).
3. **Profile fields**: the structured parts of a Tinder profile (relationship type, basics, lifestyle, job, school, and so on).

Some fields should carry over from LinkedIn: **job title, company, school, and languages**.

## How Tinder works today

- **Config:** `TINDER_CONFIG` in `src/lib/rubrics.ts`:
  - `input: "bio"`, `fieldLabel: "About me"`, `maxChars: 500`, group `dating`
  - audiences and traits are borrowed from `HINGE_CONFIG`
- **UI:** the shared `BioInput` screen (`src/components/BioInput.tsx`), driven by `PersonaFlow.tsx`.
- **Flow:**
  - Steps: profile, consent, Identity DNA (facts), lenses, Audience Clash (`AudienceClash`, the simpler screen), rewrite.
  - Rewrites go through `/api/rewrite` with `rewritePrompt` (dating-group rules, two versions).
  - Each rewrite gets FactCheck plus an `over_limit` style warning against 500 characters.
  - A Tinder-specific line was recently added in `rewriteFormat` ("brief, conversational line…").
- **Demo:** a demo bio for the fictitious persona exists in `src/lib/demo-data.ts` (`BioPlatform`, around line 571). There are no sample results for Tinder; it always runs live.
- **Reusable pieces from Hinge:** prompt/answer pairs (`segmentHinge`, segments carry `prompt`), the prompt picker (`HINGE_PROMPTS`, `MAX_HINGE_PROMPTS`, `MAX_HINGE_ANSWER` in `src/lib/persona-ui.ts`), and one rewrite per answer (`ModelHingeRewriteSchema`, `buildHingeVariations` in `postprocess.ts`). Tinder prompts should reuse these rather than duplicate them.
- **LinkedIn data available:** the LinkedIn profile lives in the shared session (`src/lib/identity-session.ts`):
  - **Job title and company:** come from `experience[0]` (title, organization).
  - **School:** comes from `education[0].organization`.
  - **Languages are not imported.** The PDF parser (`src/lib/linkedin-pdf.ts`) puts LinkedIn's "Languages" sidebar section in `notes` ("isn't imported"). Importing them needs:
    - a `languages: string[]` field on `LinkedInProfile` in `schemas.ts` (a contract change; update `emptyLinkedInProfile`, the profile tests, and the synthetic fixture, which already contains a Languages section)
    - parser support, mapping the sidebar `languages` key to that field

## What the user asked for

### Profile fields (the user's list, as given)

> - Open to
> - Relationship type (monogamy, ethical non-monogamy, open relationship, and all that)
> - Languages I know (that's something that can be added from LinkedIn)
> - Basics, such as zodiac sign and what your education level is
> - Do you want children?
> - What is your communication style (big-time texter, phone caller, video chat, or bad texter, better in person)?
> - How do you receive love?
> - Lifestyle, such as pets
> - How often do you drink?
> - How often do you smoke?
> - Are you 420-friendly?
> - Do you work out?
> - How active are you on social media?
> - Job title
> - Company
> - School
> - Living in
> - Ad city
>
> "We can give you the splits, though." There's also "Ask me about going out." There's a lot.

### Tinder prompts (the user's list, verbatim; it looks dictated)

> - Trust me on this...
> - My friends would say I'm...
> - I think it's super cringe when...
> - If I'm not home, you can find me...
> - Best friend, best first date in the city...
> - My unhinged success story...
> - I will cancel plans for...
> - Where I go to feel like myself...
> - My biggest badge flag is...
> - In my friend group, I'm the one who always...
> - We're the same type of weirdo...
> - I can't go a day without...
> - I go crazy for...
> - My sense of humor is basically just...
> - When we meet, I'll tell you about the time I...
> - Perks of dating me...
> - It's not a vacation I'm...
> - My greatest hyperfixation is...
> - I have the same energy as...
> - On a night out, I'm the one who...
> - The vibe I'm bringing to our first thing is...
> - My villain story...
> - The most authentic thing you can do for me is...
> - I want to get more into...
> - I can beat you in a game of...
> - Hell, I'll die on is...
> - My biggest green flag is...
> - I hang myself up by...
> - I feel most like myself when...
> - My ideal weekend includes...
> - You should know I...
> - I feel happiest when...
> - A surprising thing about me is...
> - Let's debate...
> - Do you agree or disagree that...?
> - My most chaotic daily habit is...
> - My guilty pleasure is...
> - My siblings tease me because...
> - I'm the person my friends call when...
> - My butterfly effect moment...
> - One first time. We live...
> - My go-to karaoke song is...
> - My hottest take is...

**Confirm wording with the user before shipping. Don't silently "correct" it.** Several lines look like speech-to-text slips:

| As given | Possibly meant |
|---|---|
| "My biggest badge flag is..." | "My biggest red flag is…" (there's a separate green-flag prompt) |
| "Hell, I'll die on is..." | "A hill I'll die on is…" |
| "I hang myself up by..." | "I hype myself up by…" (**must** be confirmed; the literal text must never ship) |
| "It's not a vacation I'm..." | "On vacation I'm…" |
| "Best friend, best first date in the city..." | "Best first date in the city…" |
| "One first time. We live..." | unclear; ask |
| "Ad city", "We can give you the splits", "Ask me about going out" (fields) | unclear; possibly "Hometown", or a "Going out" lifestyle field; ask |

Also check the list against the current Tinder app if possible; the user dictated it from memory or from the app.

## Design rules for this feature (consistent with SPEC and CLAUDE.md)

1. **The user picks profile fields; the AI never fills or infers them.** Relationship type, children, drinking, smoking, 420, zodiac, love language, and the rest are selections the user makes, kept exactly as chosen. A rewrite must never add, change, or imply a value the user didn't pick (e.g. never "loves a glass of wine" unless they chose a drinking answer that says so). This is the existing rule "never invent hobbies or preferences".
2. **Lenses judge the writing, not the life choices.** Audience Clash may comment on whether the About and prompt answers are specific, warm, and easy to reply to. It must never rate or advise on someone's relationship type, children, substances, zodiac, or similar. No stereotypes, no "this audience prefers non-smokers". Update the dating prompts and add tests.
3. **Data minimization:** send the AI only what a task needs.
   - Recommendation:
     - never send **location** ("Living in"), matching how LinkedIn entry locations are never sent
     - don't send the sensitive selections (relationship type, children, drinking, smoking, 420) to the evaluator at all
     - include only the fields a rewrite may mention (job, school, languages, interests) as confirmed facts
   - Confirm with the user. Update the consent screen text if what's sent changes.
4. **FactCheck sources.** Fields the user entered (job title, company, school, languages) are the user's own words, so they should count as source text for FactCheck. Then "software engineer at Tallowtree" in a prompt answer isn't flagged when the job field says so. Add them to the corpus the same way confirmed facts are; never trust the model's claim about using them. Tests required.
5. **Limits.** About me is 500 characters (`over_limit` already exists). Find out Tinder's real limits for prompt answers and the number of prompts; don't guess. If unknown, mirror Hinge's (`MAX_HINGE_PROMPTS = 3`, `MAX_HINGE_ANSWER = 300`) and say so in the UI and the PR.
6. **Demo and samples:** extend the fictitious persona (Priya) with Tinder fields and prompt answers; never use a real person. Sample results stay labeled "Sample result".

## Suggested implementation plan

1. **Settle open questions with the user:**
   - the prompt wording fixes above
   - the full field list with option values (verify against the app; don't invent Tinder's exact option sets)
   - which fields go to the AI
   - prompt and answer limits
   - priority versus the writing-quality task
2. **Contract first (`schemas.ts`):**
   - a `TinderProfile` with `about`, `prompts: {prompt, answer}[]`, and `fields` (typed, mostly enums plus free text for job, company, school, city)
   - its zod schema
   - `LinkedInProfile.languages`
   - a new `input` kind (e.g. `"tinder"`) on `PlatformConfig`, or the existing `"prompts"` input plus an About field; pick whichever keeps Hinge untouched
3. **Config:** `TINDER_CONFIG` gets its prompt list (a `TINDER_PROMPTS` constant next to `HINGE_PROMPTS`) and limits.
4. **Carry-over from LinkedIn:**
   - a pure, tested helper (e.g. `tinderFromLinkedIn(profile)`) that pre-fills job title, company, school, and languages from the session's LinkedIn profile
   - the user can edit or clear each value
   - shown as "from your LinkedIn"
5. **UI:** a Tinder editor with About me (counter /500), a prompt picker plus answers (reuse Hinge's), and grouped field pickers (Basics, Lifestyle, Work & education, Location). Mobile works at 390px; every control works; no dead buttons.
6. **AI:**
   - segment the About plus prompt answers (prompts carried like Hinge's)
   - rewrite About and each answer separately, keeping each answer under its limit and still answering its prompt
   - Audience Clash on the writing only (rule 2)
   - FactCheck with the user's field values in the corpus (rule 4)
7. **Tests:**
   - the schema
   - the carry-over helper
   - the parser `languages`
   - FactCheck accepting field values and still flagging invented ones
   - a prompt test that sensitive fields never reach the evaluator
   - sample data validity
8. **Live check** in headless Chrome (recipe in HANDOFF-WRITING.md "Gotchas"). Then branch, PR, and ask the user before merge and deploy.

## Rules that still apply

- **Public repo:** never commit a real person's profile or details; use the fictitious persona.
- **Secrets:** never ask for or print API keys.
- **Process:**
  - Work on a branch; `git fetch` before pushing (teammates push to `main` directly).
  - Ask the user before pushing, merging, deploying, or deleting.
  - `npm test`, `npm run lint`, and `npm run build` must pass. (Lint passes on `main` again since #30.)
