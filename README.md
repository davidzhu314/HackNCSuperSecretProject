# Personify

**Personify** helps people tailor a profile to the platform and audience they have in mind. It turns profile details into concise, platform-aware suggestions and rewrites, while showing the reasoning and checks behind them.

Personify is a writing and feedback tool. It does not sign in to LinkedIn, Hinge, or other platforms, impersonate you, or publish changes on your behalf.

## Supported platforms

- **Professional:** LinkedIn, Handshake
- **Social:** Instagram, Facebook, X
- **Dating:** Hinge, Tinder

## What you can do

- **Get platform-specific feedback.** Choose an app and provide profile details. Personify evaluates how the profile may come across to selected audience perspectives, then points to the profile details behind its feedback.
- **Rewrite selected content.** Generate concise profile copy suited to the chosen platform. Edit it, copy it, compare it with your original, and apply or undo supported changes.
- **Compare before and after.** Review separate trait score bars for the original and the rewrite, with score changes to help judge whether the revision addresses the feedback. Scores are guidance, not a prediction of real-world results.
- **Check factual support.** FactCheck flags details in a rewrite that may be unsupported by the facts provided. It is a review aid, not a fact-check against external records or a guarantee that every claim is true.
- **Keep a reusable set of facts.** Confirm profile facts and reuse them across platform flows through Identity Hub. You can also transfer details from another profile into empty fields.
- **Run quick local checks.** Review platform fit, character limits, repeated phrases, and other writing signals without an AI request.
- **Import a LinkedIn PDF.** Parse a LinkedIn "Save to PDF" export in the browser to help populate profile details.
- **Use a shorter Tinder flow.** Start with an About Me section and one prompt, then add more prompts only if desired. Optional profile details are tucked away until needed.
- **Explore a FactCheck benchmark.** The benchmark page demonstrates how the checks respond to examples containing planted unsupported claims.

## How it works

1. Select a platform and enter or import profile information.
2. Review and confirm the facts that can support suggestions.
3. Choose audience perspectives and the traits you want to improve.
4. Review feedback, inspect the original-versus-rewrite scores, and generate a rewrite.
5. Edit, copy, compare, or apply the result.

The app includes focused flows for section-based LinkedIn profiles and progressively prompted Hinge profiles, alongside platform-specific profile forms for the other supported apps.

## Privacy and limitations

- Personify asks for consent before sending profile text to an AI service.
- AI requests are handled by server routes using an OpenRouter API key kept on the server. Never put that key in a client-side variable.
- Profile details are held in the browser app’s in-memory session while you work; refreshing clears that session. The app does not provide accounts or persistent cloud profile storage.
- The audience perspectives are simulations, not interviews, user research, or measured platform outcomes.
- Personify does not connect to platform accounts or automatically update profiles.
- FactCheck and trait scores are decision aids. Review every suggestion and verify personal details before using a rewrite.

## Pages

- / - choose a platform
- /studio - profile feedback and rewrite flow
- /hub - Identity Hub for confirmed facts
- /factcheck - FactCheck benchmark
- /tour - product tour

## Local development

### Requirements

- Node.js 20.9 or newer
- npm

### Install and run

~~~bash
npm install
~~~

Create a local environment file from the example:

~~~powershell
Copy-Item .env.example .env.local
~~~

On macOS or Linux, use:

~~~bash
cp .env.example .env.local
~~~

Add your OpenRouter key to .env.local, then start the development server:

~~~bash
npm run dev
~~~

Open http://localhost:3000.

### Environment variables

| Variable | Purpose |
| --- | --- |
| OPENROUTER_API_KEY | Required for AI-powered feedback, extraction, and rewriting. Keep it private and server-side. |
| OPENROUTER_MODEL | Model used for analysis and evaluation. |
| OPENROUTER_REWRITE_MODEL | Model used for profile rewrites. |
| OPENROUTER_TEMPERATURE | Optional generation setting; leave unset if the selected model does not support it. |

See .env.example for the defaults expected by this project. Local quick checks do not require an AI key.

### Useful commands

~~~bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run start     # Run the production build
npm run lint      # Run lint checks
npm test          # Run the Vitest suite
~~~

## Built with

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS
- Zod for validation
- Vitest
- OpenRouter with the OpenAI SDK

## Project structure

- src/app/ - application pages and server API routes
- src/components/ - product interface and profile flows
- src/lib/ - profile handling, scoring, validation, and AI helpers
- INSTRUCTIONS.md - guidance for concise, platform-aware profile rewrites
