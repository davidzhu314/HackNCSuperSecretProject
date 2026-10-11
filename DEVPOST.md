# Personify

**Make every profile fit the platform without making it stop sounding like you.**

## Inspiration

Most of us have had to describe ourselves in a tiny bio box, a dating prompt, or a professional profile and wondered how to make it sound right. The same details that work on LinkedIn can feel stiff on Hinge, while a casual social bio does not belong in a job search.

We wanted to make that translation easier without turning people into generic personal brands or making up impressive-sounding details. Personify helps users show different sides of the same real person, depending on where they are posting.

## What it does

Personify helps people improve profiles for **LinkedIn, Handshake, Instagram, Facebook, X, Hinge, and Tinder**.

A user chooses a platform, enters profile details (or imports a LinkedIn PDF), confirms which suggested facts are actually true, and picks the audience perspectives and profile traits they want feedback on. Personify then:

- Gives short feedback tied to the exact profile text it refers to.
- Rewrites the profile in a style and format suited to the chosen platform.
- Compares original and rewrite ratings for the selected traits.
- Checks the rewrite for concrete claims that may not be supported by the supplied profile and confirmed facts.
- Lets the user edit and copy the result, and apply or undo supported LinkedIn section rewrites.
- Keeps confirmed facts in an Identity Hub so users can choose which platforms may use them.

The app also has quick local checks for character limits and repeated wording. LinkedIn PDF parsing happens in the browser. Personify does not sign in to social accounts or post on the user's behalf.

## How we built it

Personify is built with **Next.js 16, React 19, TypeScript, and Tailwind CSS**. Its server-side API routes call **Anthropic Claude Haiku 5.5** for profile analysis and **Claude Sonnet 5.5** for rewrites through **OpenRouter**, using the OpenAI SDK. **Zod** validates requests and structured model responses. **pdfjs-dist** parses LinkedIn PDF exports in the browser, and **Vitest** runs the automated test suite.

Each platform has its own input shape, audience lenses, writing guidance, and character limits. The rewrite prompts use the platform and section the user selected, while the app's deterministic checks look for unsupported numbers, names, credentials, stronger claims, and invalid source references. The AI suggests language; the checks and the user help keep that language grounded.

Profile text is sent to the AI provider only after the user consents. The app keeps profile work in a browser memory session rather than storing it in an account or cloud profile database.

## Challenges we ran into

The biggest challenge was improving a profile without quietly changing the person's story. AI can make an unsupported detail sound completely believable, so a prompt alone was not enough. We built FactCheck as a separate code-based review step and made users confirm extracted facts before rewrites can rely on them.

A second challenge was that "shorter" and "longer" mean different things for a headline, an experience entry, a social bio, and a dating prompt. We had to treat each field according to its own shape and limits, and make the length controls guide the rewrite without encouraging filler.

We also had to make feedback useful without presenting simulated audience reactions as real-world predictions. The score bars are a readable comparison, but they are labeled as guidance because separate AI evaluations can vary.

## Accomplishments we're proud of

- Supporting seven platforms across professional, social, and dating profiles in one app.
- Building sentence-level feedback and rewrite receipts that let users see which parts of their profile support the output.
- Keeping factual checks separate from AI-generated advice.
- Creating a reusable Identity Hub for confirmed facts and platform-specific sharing.
- Importing LinkedIn PDF profiles in the browser.
- Adding before-and-after trait comparisons, per-section LinkedIn length controls, and a focused Tinder flow that does not require filling out a long questionnaire.
- Passing **421 automated tests** in the current test suite.

## What we learned

We learned that profile writing is not just about making sentences sound polished. The right format, amount of detail, and tone depend on the platform, and good personalization still has to sound natural.

We also learned that AI works better as one part of a product than as the whole product. Clear constraints, user confirmation, visible evidence, deterministic checks, and easy editing all matter just as much as the generated rewrite.

## What's next for Personify

- Test the full experience with more students, job seekers, and people using social and dating apps.
- Improve consistency checks by comparing feedback across repeated runs and reviewing where the ratings disagree.
- Add end-to-end checks for the complete mobile and keyboard-accessible user journey.
- Expand profile import and export options while keeping consent and privacy clear.
- Continue refining each platform's guidance based on user feedback, not assumptions about what every audience wants.

## Built with

Next.js, React, TypeScript, Tailwind CSS, OpenRouter, Claude Haiku 5.5, Claude Sonnet 5.5, OpenAI SDK, Zod, pdfjs-dist, Vitest
