# Handoff: Tinder, step 0 (questions and contract)

> **Done (2026-10-11):** step 0, A, and B were built together on `feat/tinder-profile`. This file is kept for its decisions. What exists now is described in [CLAUDE.md](CLAUDE.md) and `src/lib/tinder.ts`.

Written 2026-10-11. **This step blocks both halves of the Tinder work.** [HANDOFF-TINDER-A.md](HANDOFF-TINDER-A.md) (data and AI) and [HANDOFF-TINDER-B.md](HANDOFF-TINDER-B.md) (UI) start only after this PR is merged. Background and design rules: [HANDOFF-TINDER.md](HANDOFF-TINDER.md). Rules: [CLAUDE.md](CLAUDE.md). Next.js 16 notes: [AGENTS.md](AGENTS.md).

Priority (user decision, 2026-10-11): the Tinder work comes before writing quality ([HANDOFF-WRITING.md](HANDOFF-WRITING.md)).

## 1. Get the user's answers (not answered yet as of this writing)

Ask before writing the contract. Each question has a suggested default, so the user can reply "defaults except …".

1. **Prompt wording.** These look like dictation slips. Never "fix" them silently, and the literal "I hang myself up by" must never ship.

   | As given | Suggested |
   |---|---|
   | "My biggest badge flag is…" | "My biggest red flag is…" |
   | "Hell, I'll die on is…" | "A hill I'll die on is…" |
   | "I hang myself up by…" | "I hype myself up by…" |
   | "It's not a vacation I'm…" | "On vacation I'm…" |
   | "Best friend, best first date in the city…" | "Best first date in the city…" |
   | "One first time. We live…" | no guess: ask, or drop it |
   | "Do you agree or disagree that…?" | keep as is? |

2. **Unclear fields.**
   - "Ad city": Hometown, or drop it?
   - "We can give you the splits, though": probably a joke; drop it?
   - "Ask me about going out": a "Going out" lifestyle field, or drop it?
   - "Open to": does it mean Tinder's relationship goals?
3. **Field options.** Ask for the app's real option lists (screenshots are best).
   - Relationship type as of 2023: monogamy, ethical non-monogamy, open relationship, polyamory, open to exploring.
   - Anything the user can't supply gets a short neutral list plus "Prefer not to say". Never call these "Tinder's exact options".
   - Every field can be left blank.
   - Pets: one choice or several?
4. **What reaches the AI.** Suggested default:
   - Location (Living in, Hometown): never sent.
   - Relationship type, children, drinking, smoking, 420, zodiac, love style, and the other lifestyle answers: never sent anywhere.
   - Job, company, school, languages: sent to rewrites as confirmed facts.
   - Evaluator: gets only the About and prompt answers.
   - Ask whether any lifestyle field may go to rewrites if the user opts in (default: no).
5. **Limits.** A web search (2026-10-11) confirmed 500 characters for About me and found no number for prompts or answer length. Unless the user knows the real limits, mirror Hinge (3 prompts, 300 characters each) and say "assumed" in the UI and the PR.
6. **Languages from LinkedIn.** Add `languages: string[]` to `LinkedInProfile` and drop proficiency text such as "(Native or Bilingual)"?

Record the answers in this file, under "Decisions" below, in the same PR.

## 2. Write the contract (one small PR, merged before A and B start)

Show the user the contract and wait for their OK before writing it. Keep Hinge untouched.

- **`src/lib/schemas.ts`**
  - Add `"tinder"` to `InputShape` (currently `"sections" | "prompts" | "bio"`).
  - Add `TinderProfileSchema` and `type TinderProfile`:
    - `about: string`
    - `prompts: { prompt: string; answer: string }[]`
    - `fields`, typed: enums for the picked fields, free text for job, company, school, and city
  - Add `languages: string[]` to the LinkedIn profile schema (default `[]`). Only add the field; Person A writes the parser.
- **New `src/lib/tinder.ts`, constants and stubs:**
  - `TINDER_PROMPTS` (the confirmed wording), `MAX_TINDER_PROMPTS`, `MAX_TINDER_ANSWER`, `TINDER_ABOUT_MAX = 500`
  - `TINDER_FIELD_GROUPS`: groups (Basics, Lifestyle, Work & education, Location), each listing its fields with labels and option labels
  - `AI_SHAREABLE_FIELDS`: the fields allowed to reach the AI, from answer 4
  - `emptyTinderProfile()`
  - stubbed signatures that throw "not implemented"; Person A fills them in:
    - `tinderFromLinkedIn(p: LinkedInProfile): Partial<TinderFields>`
    - `segmentTinder(t: TinderProfile): Segment[]`
    - `tinderFactSources(t: TinderProfile): Segment[]`
    - `tinderAiPayload(t: TinderProfile, task: "rewrite" | "evaluate")`
  - `MOCK_TINDER_PROFILE`: a filled-in profile for the fictitious demo persona (Priya), so Person B can build the UI before the AI side exists
- **`src/lib/rubrics.ts`:** `TINDER_CONFIG.input` becomes `"tinder"`.
  - Check every `config.input ===` branch so Tinder doesn't break in the meantime: `PersonaFlow.tsx` (`isBioPlatform`, segmenting, demo check), `api-client.ts`, `RewriteComparison.tsx`, `prompts.ts`, `api/rewrite/route.ts`, `IdentityHub.tsx`, `platforms.test.ts`.
  - If keeping Tinder working until A and B land is too invasive, leave `input: "bio"` here and let Person B switch it. Write down which one you chose.
- **Tests:** schema round trip, `emptyTinderProfile` validates, `MOCK_TINDER_PROFILE` validates, prompt list has no duplicates.

`npm test`, `npm run lint`, and `npm run build` must pass. After this merges, `schemas.ts` and `tinder.ts`'s exported names are frozen. Change them only through a tiny PR that both people know about.

## Decisions

User answers, 2026-10-11:
1. **Prompt wording:** ship the suggested fixes ("My biggest red flag is…", "A hill I'll die on is…", "I hype myself up by…", "On vacation I'm…", "Best first date in the city…"). Drop "One first time. We live…". Keep "Do you agree or disagree that…?". Every other prompt ships as given.
2. **Fields:** "Open to" means Tinder's relationship goals. Add a "Going out" lifestyle field. Drop "Ad city" (no Hometown) and "We can give you the splits".
3. **Options and limits:** the user re-sent their list without option sets or limits and asked to build it. So:
   - Option lists come from Tinder's app as best known, marked unverified in the code and UI. Going out is a neutral list.
   - Relationship type and pets allow several picks.
   - Limits are assumed, copied from Hinge (3 prompts, 300 characters), and the UI says so. Replace them when the user sends the real ones (`TINDER_OPTIONS` in `schemas.ts`, `LIMITS.maxTinderPrompts`, `LIMITS.tinderAnswer`).
4. **What reaches the AI:** the default.
   - Rewrites get the About, prompt answers, job title, company, school, and languages.
   - The evaluator gets the About and prompt answers only.
   - Location and every relationship, basics, and lifestyle answer are never sent.
5. **Languages from LinkedIn:** not answered; going with the default (add `languages`, strip proficiency text).

## Rules (all halves)

- Public repo: never commit a real person's profile or details, and never paste the user's real LinkedIn export (path given in chat, local only) into tests, fixtures, demo data, prompts, comments, or commit messages. Use Priya or synthetic fixtures.
- Never ask for or print API keys.
- Work on a branch, `git fetch` before pushing (teammates push to `main`), open a PR, and ask the user before pushing, merging, deploying, or deleting.
