# Handoff: Tinder, Person A (data and AI)

> **Done (2026-10-11):** built together with step 0 on `feat/tinder-profile`. Kept for reference only.

Written 2026-10-11. **Start only after the step 0 PR ([HANDOFF-TINDER-0-CONTRACT.md](HANDOFF-TINDER-0-CONTRACT.md)) is merged.** Its "Decisions" section has the user's answers on wording, fields, what goes to the AI, and limits. Background and design rules: [HANDOFF-TINDER.md](HANDOFF-TINDER.md). Rules: [CLAUDE.md](CLAUDE.md). Person B builds the UI in parallel: [HANDOFF-TINDER-B.md](HANDOFF-TINDER-B.md).

## You own these files (Person B doesn't touch them)

`linkedin-pdf.ts`, `profile.ts`, `src/lib/__fixtures__/`, the function bodies in `tinder.ts`, `fact-guard.ts`, `prompts.ts`, `segments.ts`, `postprocess.ts`, `api/rewrite`, `api/evaluate`, `demo-data.ts`, and their tests.

Don't edit `PersonaFlow.tsx` or any component; Person B owns those. If you need a contract change (`schemas.ts`, exported names in `tinder.ts`), make it a tiny separate PR and tell Person B.

## Tasks

1. **Languages from LinkedIn PDFs.**
   - The parser (`linkedin-pdf.ts`, the sidebar loop around line 295) currently writes a note that "Languages" isn't imported.
   - Map the sidebar `languages` key to `profile.languages`.
   - Strip proficiency text if step 0 decided so.
   - Update `emptyLinkedInProfile` (`profile.ts`), the synthetic fixture (`__fixtures__/linkedin-synthetic.ts`, which already has a Languages section), and the tests.
   - Check against the user's real export locally only (see the local tests `*.local.test.ts`); never commit it or anything from it.
2. **`tinder.ts` function bodies, each with tests:**
   - `tinderFromLinkedIn`: job title and company from `experience[0]`, school from `education[0].organization`, languages from `languages`. Pure. An empty profile gives an empty result.
   - `segmentTinder`: About plus each prompt answer, with the prompt carried on the segment the way `segmentHinge` does it.
   - `tinderFactSources`: the user-entered job, company, school, and languages as segments for the FactCheck corpus.
   - `tinderAiPayload`: only what each task may send.
     - It never includes location.
     - It never includes the sensitive selections (relationship type, children, drinking, smoking, 420, zodiac, love style, lifestyle).
     - The evaluator gets only the About and prompt answers.
3. **FactCheck.** Add `tinderFactSources` to the corpus the same way confirmed facts are added.
   - "Software engineer at Tallowtree" in an answer passes when the job field says so.
   - Invented employers, numbers, and schools are still flagged.
   - Never trust the model's `usedFactIds`.
   - Never loosen the existing checks; their tests must stay green.
4. **Prompts and routes.**
   - Rewrite the About and each answer separately. Each answer stays under the answer limit and still answers its prompt.
   - Reuse Hinge's pieces (`ModelHingeRewriteSchema`, `buildHingeVariations`) rather than copying them.
   - Dating lenses judge only the writing (specific, warm, easy to reply to). Add an explicit rule that they never rate or advise on relationship type, children, substances, zodiac, or similar, and never stereotype.
   - Route `input === "tinder"` in `api/rewrite` and `api/evaluate`, validated with zod, still requiring `consent: true`.
   - Required test: build the evaluate and rewrite prompts from a Tinder profile with every sensitive field and location filled in, and assert none of those values appear.
5. **Demo data.** Give Priya Tinder fields and prompt answers in `demo-data.ts`. Keep sample results labeled "Sample result", and extend `demo-data.test.ts` so the samples validate and pass FactCheck.

## Check before handing off

- Drive both routes live with Priya once, so the request contains no sensitive or location values. Log the payload locally, not the profile text in committed code.
- `npm test`, `npm run lint`, and `npm run build` pass.
- Open a PR. Per [HANDOFF-TINDER.md](HANDOFF-TINDER.md), **A merges first**, then Person B rebases and switches the UI from the mock to the live routes. Ask the user before merging.

## Rules

Same as step 0: no real profile in the repo, no API keys, branch and PR, `git fetch` before pushing, ask before pushing, merging, deploying, or deleting. FactCheck stays deterministic and tested.
