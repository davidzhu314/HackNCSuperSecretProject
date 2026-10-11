# Handoff: make the rewrites good

Written 2026-10-10 for the next Claude session. **Your primary goal is the quality of the rewritten text.** Everything else in the app works and is live. Read this first, then [CLAUDE.md](CLAUDE.md) (rules), then [AGENTS.md](AGENTS.md) (Next.js 16.4 is newer than your training data). [HANDOFF.md](HANDOFF.md) has the team, deploy, and testing gotchas, but parts of its "State" section are out of date (see "What changed since HANDOFF.md").

## The problem, in the user's words

> The rewritten text is not good. It's terrible, it's trash, it's absolutely dog water, it's potatoes.

Take that literally: users would not paste these rewrites into LinkedIn. The user provided a copywriting template (in the appendix below) as the direction for a better prompt. Earlier sessions had measured "how different" a rewrite is from the original and whether FactCheck flags it; **neither of those measures quality**, and both looked fine while the writing was bad.

## Success criteria

1. **The user would paste it.** Show the user before/after pairs early and often; their judgment is the bar, not a metric.
2. **Still true.** Every concrete claim traces to the profile or a confirmed fact. FactCheck stays clean on honest input (`warnings` empty for most sections), and FactCheck stays deterministic. Never loosen FactCheck to make writing pass.
3. **No AI slop.** The ban list in `src/lib/style-check.ts` stays (it already matches the template's list); the cliché lint stays clean.
4. **Fast enough.** About 3-6 s per entry, at most ~12 s for About. "Rewrite all" runs 3 at a time.
5. Tests, lint, and build pass; the sample data tests still pass (see "Sample data" below).

## How rewriting works today

LinkedIn sections, below, are the main target. **Since #20 there are seven platforms** in three groups:

| Group | Platforms |
|---|---|
| Professional | LinkedIn, Handshake |
| Social | Instagram, Facebook, X |
| Dating | Hinge, Tinder |

Everything except LinkedIn rewrites through `/api/rewrite` with `rewritePrompt` in `src/lib/prompts.ts`. Its rules come from the platform's group, and an `over_limit` style warning applies the platform's character limit (Handshake 300, Instagram 150, X 160, Facebook 101, Tinder 500). Those rewrites likely share the same weaknesses. Ask the user whether to fix LinkedIn first (recommended: it's the demo's main path) or all platforms at once. The template's ban list and tone rules apply to every group; its post framework applies to none of the short bios as written.

- **UI:** one card per rewritable section (headline, About, each entry's description). Each card has a style dropdown (Direct, Narrative, Professional; Professional is the default) and a 5-stop length slider. Results are cached per style + length. `src/components/SectionRewrites.tsx`, wired in `PersonaFlow.tsx`.
- **Route:** `src/app/api/rewrite-section/route.ts`. One model call per section, style, and length (`getRewriteModel()`, default `anthropic/claude-sonnet-5.5`, strict `json_schema` output `{ content, usedFactIds, changeSummary }`).
  - It retries once if the result:
    - breaks a checkable style rule (`styleIssues`)
    - misses its length step badly (`lengthIssue`)
    - is nearly identical to the original (`changeIssue`, word-bigram overlap above 0.8)
  - It then keeps the "better" attempt, ranked by:
    1. FactCheck warnings
    2. style breaks
    3. change
    4. length (shorter steps only)
- **Prompt:** `sectionRewritePrompt` in `src/lib/prompts.ts`. In order:
  1. hard truth rules
  2. format per section kind
  3. a "rewrite, not a proofread" paragraph
  4. the style's rules and format rules from `src/lib/styles.ts`
  5. a style-contrast line ("you are writing Professional; it must not read like Direct or Narrative")
  6. a length instruction
  7. the ban list
  8. the untrusted-data rule

  The user message holds the goal, the audiences, the confirmed facts, and the source segments (`[exp1-s2] …`).
- **Sources:** headline and About see the whole profile. An entry sees **only its own text** (title line plus description) plus confirmed facts. FactCheck uses exactly the same corpus (`factCheckSegments` in `src/lib/profile.ts`), so numbers and names can't move between jobs.
- **Postprocess:** `buildSectionRewrite` in `src/lib/postprocess.ts` normalizes bullets, restores dropped bullets, cuts to LinkedIn's limits, flags added bullets, runs FactCheck (`src/lib/fact-guard.ts`) and the cliché lint (`src/lib/style-check.ts`).

## Why the writing is probably bad (my diagnosis; verify before acting)

These are hypotheses from building it, not measured causes. Test them.

1. **The rules are almost all prohibitions.** "Use ONLY…", "never add purposes", "never restate", "no padding", "same number of bullets or fewer", "no 'I' in bullets"… The safest output under that pile of constraints is the original with words shuffled. There is very little positive guidance about what good looks like, and **no examples**.
2. **The prompt grew by accretion.** Each fix (style contrast, length, anti-padding, bullet counts, the overlap retry) added another rule. Nobody has read the whole system prompt as a writer would. Print it for one section and read it top to bottom.
3. **Styles are defined by mechanics, not by craft.** Direct means short clauses; Professional means no first person and connected clauses; Narrative means "I" and contractions. Those make the three *different*, not *good*.
4. **Entries are rewritten in isolation.** A bullet list can't be framed by who the person is, because the model only sees that entry. The isolation exists for FactCheck. The prompt context and the FactCheck corpus don't have to be the same thing (e.g. show the headline/About as read-only context but forbid using its facts in the entry). Decide carefully; numbers hopping between jobs was a real failure mode.
5. **Prose inside strict JSON**, plus `usedFactIds` and `changeSummary` bookkeeping in the same call, may cost quality.
6. **The retry ranking prefers "safe" over "good"**: fewest FactCheck warnings first, then closeness. A bolder, better version with one "needs review" flag loses to a timid one.
7. **The template targets LinkedIn *posts*.** Hook, context, insight, and a call to conversation fit an About section somewhat, and a bullet list not at all. It has to be adapted per section kind, not pasted in.

## Plan for the session

Do these in order, and show the user results at steps 1 and 3 before going further.

1. **Baseline (no code changes).**
   - Generate current rewrites for the demo persona and a few eval cases, in all three styles.
   - Put before/after side by side.
   - Ask the user which ones are worst and what "good" means to them. Do they have a profile they admire? Should bullets lead with results? How much should the wording change?
   - Use synthetic profiles for anything shared.
   - The user also has their real LinkedIn export locally. Ask for the path; test with it **locally only** (see the data rules below).
2. **A writing harness.**
   - A local script or local-only test that runs `sectionRewritePrompt` plus the route logic over a fixed set of sections and writes before/after to the scratchpad. Example: `src/lib/*.local.test.ts`, which is already git-excluded via `.git/info/exclude`; reuse the pattern and add the pattern to the exclude file if it's a fresh clone.
   - Cases: the demo persona (`DEMO_LINKEDIN_PROFILE`) plus `evals/cases/linkedin/*.json` (synthetic, draft status).
   - Optionally build a blind A/B review page for the user, with **synthetic profiles only** if it's published anywhere.
3. **Rewrite the prompt from the template, adapted per section kind.** Things to try:
   - **Lead with the role and goal:** an expert LinkedIn copywriter and ghostwriter making it human, authoritative, and specific. Then a compact, non-negotiable **truth block**: only facts in the sources and confirmed facts; no new numbers, names, credentials, or outcomes; no stronger verbs. Keep it short and put it where the model weighs it, not as 15 scattered "never"s.
   - **Per-kind frameworks** (template section 3, adapted):
     - **Headline:** role or field, focus, proof (tools, one credential from the sources). One line, ≤220 characters.
     - **About:**
       - Hook (a concrete, true first line under ~10 words)
       - Context
       - Core (short paragraphs or bullets)
       - A grounded close. A "what I'm looking for / open to" line only if the sources say it, and no generic question.
     - **Entry bullets:** action, what, with what or for whom, and the result *if the source states one*; strongest first; cut filler.
   - **Few-shot examples:** 2-3 synthetic before/after pairs per kind, showing the level of change wanted *without* inventing anything. This is likely the single biggest lever.
   - **Styles:** the template's Option A (Direct & Analytical) and Option B (Narrative & Relatable) map to Direct and Narrative. Ask the user whether Professional stays as a third option or folds into Direct. Define styles by what makes each *good*, not only by mechanics.
   - **Two-pass:** draft, then an editor pass that critiques against a rubric (specific? strongest first? sounds human? anything not in the sources?) and revises. Measure the latency cost.
   - **Plain-text prose:** ask for the content as plain text and get the change summary separately (or drop it). `usedFactIds` is advisory and never trusted anyway.
   - **Models:** compare Sonnet 5.5 against a stronger model on OpenRouter for the rewrite only (`OPENROUTER_REWRITE_MODEL`). Verify model ids, pricing, and that the endpoint accepts our parameters (`provider.require_parameters` + `json_schema`) in current OpenRouter docs before relying on one. **Anthropic models on OpenRouter reject `temperature`**: don't add it back.
   - **Retries:** re-examine the `changeIssue` overlap retry and the ranking once the prompt is better; they may no longer be needed.
4. **Keep the guards honest.** Run FactCheck on every output. If good writing trips FactCheck on honest input, look at *why* (a paraphrase? a real invention?) before touching FactCheck, and add a test for whatever you change.
5. **Ship.** Update `SAMPLE_SECTION_REWRITES` in `src/lib/demo-data.ts` (fictitious persona; tests require each sample to be FactCheck-clean and lint-clean and to pass `styleIssues`). Branch, PR, live check, and ask the user before merge and deploy.

## Rules that still apply

- **Truth first:** only the profile and confirmed facts support claims. Never invent numbers, employers, dates, credentials, tools, or outcomes. FactCheck stays deterministic and tested. Say "no unsupported concrete claims detected", never "verified".
- **Data:** the repo is **public**. Never commit a real person's profile, or anything from one (names, employers, numbers), in tests, demo data, prompts, comments, or commit messages. Real exports are for local testing only; outputs go to the session scratchpad. Grep your diff for real-profile strings before committing.
- **Secrets:** never ask for or print API keys. `.env.local` holds `OPENROUTER_API_KEY`. To check credit without printing the key, call `GET https://openrouter.ai/api/v1/key` with the key from the environment.
- **Process:**
  - Work on a branch; `git fetch` before every push.
  - Ask the user before pushing, merging, deploying, or deleting.
  - Teammates push to `main` directly (e.g. #19 scene photos), so check `HEAD..origin/main`.
  - `npm test`, `npm run lint`, and `npm run build` must pass before you say something is done.
- **Deploy:** manual, `vercel --prod --yes` from a clean `main` that matches `origin/main`. Confirm with `vercel inspect <deployment>`, then smoke-test the live site.

## Gotchas learned the hard way

- **Rate limits:** about 40 Sonnet calls in a few minutes triggered 429s from the provider. `callStructured` retries a 429 once after 2 s. Run measurement batches 2 at a time with short gaps.
- **Token caps:** a 600-token cap on headline calls caused truncated or empty JSON (502s). Every section now gets ≥2000 tokens (3000 for About). If you change the output format, re-check this.
- **Headline length:** short headlines (e.g. 21 characters) at "same" length used to echo themselves. `targetChars` in `styles.ts` now measures headline and About from at least 100 and 300 characters.
- **Length vs. honesty:** "longer" on an entry with nothing more to say used to pad with invented purposes ("with the aim of…"). The prompt now forbids that, and "longer" may stop short; the card says so.
- **Running the app locally:**
  - Use `npm run build && npx next start -p 3100`.
  - Kill the server with `lsof -ti:3100 -sTCP:LISTEN | xargs kill`.
  - After deleting a page, `rm -rf .next/dev` or the build typecheck fails on stale generated types.
  - Browser checks use `playwright-core` with the installed Chrome (`channel: "chrome"`), installed in a scratch folder, not the project.
- **CSS:** `.clash-grid` is Hinge's two-column layout; the LinkedIn rating table is `.rating-grid`.

## What changed since HANDOFF.md was written

- **#20 (Izad), merged but not deployed or live-tested yet:**
  - Seven platforms in three groups, with a `BioInput` screen for the five new ones.
  - A grouped platform picker.
  - An alternative landing page at `/tour`.
  - Its PR says no browser check and no live AI run on a new platform have been done. Do one before deploying.

All merged to `main` and deployed, PRs #15–#18:
- **Lens picker:** one-line summaries.
- **Section rewrites:** a Professional style and the length slider.
- **Profile step:** no platform has a separate facts step now (your text is the evidence); an optional "Add something that isn't in your …" box is on every rewrite screen.
- **Lenses:** pick any of the 8 (one model call per lens, 4 at a time), plus up to 3 questions the user types.
- **Audience Clash:** a rating grid, then one line per audience per section.
- **Rewrite card:** FactCheck is a single icon; receipts show only when a sentence is clicked.
- **Import notes:** routine import notes are hidden.

## Appendix: the user's copywriting template (verbatim)

Use this as the direction, adapted per section kind as described above. Where it conflicts with the app's rules, the rules win. Specifically:
- It's written for posts.
- Its "unless instructed by the user" exception to inventing facts does **not** apply here.
- A closing question isn't wanted on a profile.

> You are an expert LinkedIn copywriter and ghostwriter. Your job is to transform raw notes, rough text, or draft posts into polished LinkedIn content that sounds human, authoritative, and engaging—without sounding like generic "AI slop."
>
> ### GOAL
> Rewrite the user's provided text into compelling LinkedIn content using natural professional language, clean structure, and authentic formatting while strictly avoiding AI clichés.
>
> ---
>
> ### 1. STYLE & TONE GUIDELINES
> - **Tone:** Professional yet conversational, clear, confident, and direct.
> - **Hook First:** Start with a strong first line (under 10 words if possible) that sparks curiosity or makes a bold, relatable statement.
> - **Formatting:**
>   - Use short paragraphs (1–3 sentences max).
>   - Use whitespace to make the post highly skimmable on mobile devices.
>   - Use bullet points (`•` or `-`) for lists, processes, or key takeaways.
> - **Tone Adjuster:** Keep the voice grounded in real-world experience rather than theatrical corporate storytelling.
>
> ---
>
> ### 2. STRICT "NO-AI" BAN LIST
> You MUST NOT use the following overused AI words, phrases, or stylistic tropes:
>
> **Banned AI Buzzwords & Verbs:**
> - Delve, unpack, elevate, optimize, leverage, testament, beacon, tapestry, multifaceted, game-changer, paradigm shift, synergy, holistic, harness, foster, embark, realm, landscape, dynamic, testament to.
>
> **Banned AI Phrases & Structures:**
> - "In today's fast-paced digital world..." / "In an era of..."
> - "Let's dive in" / "Here's the takeaway:" / "Here's the kicker:"
> - "It's not just about X, it's about Y."
> - Ending with generic rhetorical questions like: "What are your thoughts?" / "Do you agree?" / "How do you handle this in your organization?"
> - Excessive rule-of-three listicles wrapped in heavy metaphors.
>
> **Banned Formatting:**
> - Do NOT use emojis as bullet points (e.g., 🚀, 💡, 🔥, 📌). Use max 1–2 emojis in the entire post if relevant, or none at all.
> - Do NOT use hyper-dramatic, single-sentence line breaks for every single line (e.g., "Bro-etry" style). Keep line breaks natural.
>
> ---
>
> ### 3. REWRITING FRAMEWORK
> When processing the user's input, follow this structure:
>
> 1. **The Hook:** Grab attention with a strong, clear opening line (a counterintuitive insight, a concrete result, or a honest observation).
> 2. **The Context / Problem:** Briefly explain the situation or challenge in plain, everyday language.
> 3. **The Core Insight / Solution:** Break down the main message using bullet points or concise paragraphs. Use real-world logic rather than buzzwords.
> 4. **The Takeaway / Conclusion:** End with a grounded conclusion or a low-friction, realistic call to conversation (e.g., sharing a specific perspective or asking a genuine, non-templated question).
>
> ---
>
> ### 4. OUTPUT INSTRUCTIONS
> - Provide **2 Variations** of the rewritten post:
>   - **Option A (Direct & Analytical):** Focused on clear logic, framework, and actionable takeaways.
>   - **Option B (Narrative & Relatable):** Focused on personal perspective, lessons learned, or story-driven context.
> - Keep the original message intact—do not invent fake facts, numbers, or company names unless instructed by the user.
>
> ---
>
> ### USER INPUT:
> [Insert your text, rough notes, or draft here]
