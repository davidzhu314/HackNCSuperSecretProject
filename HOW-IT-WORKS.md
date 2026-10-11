# How Personify Works (in plain English)

This file explains every technical piece of the project: **what it is, what it does, and why we chose it.** No prior knowledge needed. A glossary at the bottom explains the jargon.

---

## 1. The idea in one paragraph

People have profiles on many apps: LinkedIn, Tinder, Hinge, GitHub, and so on. Each app wants a different tone, but every version should still be *you*. Personify takes the text you already wrote, shows you how different kinds of readers might see it, and rewrites it to fit each app. The key rule: **it improves how you say things, it never invents things about you.** A built-in checker called **FactCheck** catches anything the AI made up (a fake number, a company you never worked at, "led" when you only "helped").

---

## 2. The big picture

```
 Your browser (what you see)                 Our server (on Vercel)             The AI
 ───────────────────────────                 ──────────────────────             ──────
 Type or import your profile
 Code-only checks run right here  ───────►   Checks the request is valid  ───►  Gemini or
 (Quick check, Where it fits, etc.)          and you said yes to sending        Claude (via
                                             Splits text into numbered           OpenRouter)
                                             pieces, builds the prompt
                                                                         ◄───  Sends back JSON
 Shows feedback and rewrites      ◄───────   Checks the AI's answer,
 with FactCheck warnings                     runs FactCheck, cleans it up
```

Three parts:
1. **The browser** shows the screens and runs the "checks by code" (no AI needed, instant, private).
2. **The server** is the middleman. It holds the secret AI key, checks every request, talks to the AI, and double-checks the AI's answer before you see it.
3. **The AI** reads your text and writes feedback and rewrites. We never trust it blindly.

---

## 3. The tools we used, and why

| Tool | What it is | Why we picked it |
|---|---|---|
| **Next.js 16** | A framework for building websites with React. It does both the screens and the server code in one project. | One project, one language, one deploy. We didn't need a separate backend. |
| **React 19** | The library that builds the screens out of reusable pieces called *components*. | Standard, fast, and the whole team knows it. |
| **TypeScript** | JavaScript with types (it knows a `name` is text and `count` is a number). | Catches mistakes before the code runs. Very useful when three people edit the same code. |
| **Tailwind CSS** | A way to style things by writing short class names (`p-4`, `text-sm`) right on the element. | Quick to style, no giant CSS files to keep in sync. |
| **shadcn/ui** | Ready-made buttons, cards, tabs, checkboxes. The code is copied into our project (`src/components/ui/`). | Looks good out of the box, and we can edit it because we own the code. |
| **lucide-react** | A set of icons. | Clean icons with one line of code. |
| **zod** | A tool that describes what data *should* look like and checks it. | The AI sometimes returns broken or wrong-shaped answers. zod catches that before it reaches the screen. |
| **openai (SDK)** | A code library for talking to AI models. | Google's Gemini and OpenRouter both accept the same "OpenAI-style" requests, so one library works with both. |
| **diff** | Compares two texts and finds what changed. | Shows your original next to the rewrite with the changes highlighted. |
| **pdfjs-dist** | Reads PDF files in the browser. | Lets you import LinkedIn's "Save to PDF" export without uploading it anywhere. |
| **Vitest** | Runs our automated tests (`npm test`). | Proves the checkers do what we say they do. |
| **ESLint** | Points out sloppy or risky code (`npm run lint`). | Keeps the code tidy. |
| **Vercel** | The hosting service that puts the site on the internet. | Made by the Next.js team, so deploying is one command (`vercel --prod`). |
| **GitHub** | Where the code lives and the team merges changes (pull requests). | Standard for teamwork and history. |

**What we deliberately did *not* use:** no database and no login. Your profile lives only in the open browser tab and disappears when you refresh. That's simpler to build and much safer for private data.

---

## 4. The AI part

### Which AI?
`src/lib/llm.ts` decides:
- If the server has a **`GEMINI_API_KEY`**, it uses **Google Gemini** (default model `gemini-3.8-flash`).
- Otherwise, if it has an **`OPENROUTER_API_KEY`**, it uses **OpenRouter**, a service that gives access to many models. By default: **Claude Haiku** for quick jobs and **Claude Sonnet** for rewrites (better writer).
- **Why the fallback?** Our Google key stopped working (it returned "unauthorized" everywhere), so the live site runs on OpenRouter. The code works either way without changes.

### How we ask the AI questions
- We ask for **structured JSON** (data in a fixed shape), not free text. We describe the exact shape with zod, and the AI must fill it in.
- If the answer isn't valid JSON or has the wrong shape, we **retry once** with a note saying "that wasn't valid, try again."
- If the AI service says "slow down" (a *rate limit*, error 429), we **wait 2 seconds and try once more**.
- The instructions we give the AI are in `src/lib/prompts.ts`. The scoring guides for each platform and audience are in `src/lib/rubrics.ts`.

### The server routes (the "doors" the browser knocks on)
All live in `src/app/api/`. Each one is a small piece of server code.

| Route | What it does |
|---|---|
| `facts/extract` | Pulls possible facts out of your text. They're **never** marked as confirmed automatically; you confirm them. |
| `facts/verify` | The **Lie Checker's** AI step: compares a fact you added against your original profile. |
| `evaluate` | Simulated readers (a recruiter, a hiring manager, a founder…) rate your text on plain questions like "Can they tell what you do?" |
| `rewrite` | Rewrites dating-app answers (Hinge, Tinder). |
| `rewrite-section` | Rewrites **one** LinkedIn section at a time, in a chosen style and length. |
| `draft` | "Draft with AI": rewords your text from other profiles to fill an empty spot. |

Every route goes through one shared wrapper (`src/lib/api.ts`) that:
1. Rejects the request if it isn't valid JSON.
2. Rejects it if you haven't said yes to sending your text (`consent: true`).
3. Checks the request's shape with zod.
4. Turns any error into a friendly message (for example "missing API key" or "rate limited").
5. **Never logs your profile text.**

### Smart retry on LinkedIn rewrites
In `rewrite-section`, if the first rewrite breaks a rule we can check by code (wrong style, way off the requested length, or barely changed anything), the server asks once more with the problems spelled out, then **keeps the better of the two**: fewest FactCheck warnings first, then fewest style problems, and so on.

---

## 5. The trust features (the heart of the project)

Anyone can put a nice screen on ChatGPT. These are what make Personify different.

### 5a. Numbered pieces instead of quotes ("segments")
**Problem:** if you ask an AI to quote your text, it changes punctuation and spacing, so the quote can't be found again.
**Solution (`src/lib/segments.ts`):** the server splits your text into numbered pieces (`s1`, `s2`… or for LinkedIn `about-s3`, `exp2-s1`). The AI only says "this comment is about piece `s3`." The server looks up the real text itself.
**Why:** every highlighted quote is guaranteed to be your exact words. If the AI cites a piece that doesn't exist, we flag it instead of showing it.

### 5b. FactCheck (`src/lib/fact-guard.ts`)
Plain code, no AI, same answer every time. It compares the rewrite against **your original text plus facts you confirmed** and flags:
- **Made-up numbers or dates**: "increased sales 40%" when you never said 40.
- **Made-up names**: a company, school, or product that isn't in your text. (It spots these by capital letters, which is a rough rule. We say so honestly.)
- **Puffed-up verbs**: you wrote "helped with," the rewrite says "led."
- **Bad fact references**: the AI says it used fact #7, but fact #7 doesn't exist or isn't confirmed.
- **Sentences with no source**: a sentence whose words don't trace back to anything you wrote.

**Why code instead of telling the AI "don't lie"?** Because the AI can ignore instructions. Code can't be talked out of its rules. A clean result says *"No unsupported concrete claims detected,"* never "verified true," because the checker can't prove truth, only spot things with no source.

For LinkedIn, each job entry is checked only against **that job's** text, so a number from one job can't sneak into another.

### 5c. Receipts (`src/lib/provenance.ts`)
For every sentence in a rewrite, shows which of your original sentences or facts it came from. If less than half of a sentence's words trace back, it's marked weak or untraced.

### 5d. The Lie Checker (`ExtraFacts` + `src/lib/fact-claims.ts`)
When you **add** a fact on the rewrite screen, it's compared with your original profile:
- Code rules run as you type ("best in the company", a number that doesn't match what you wrote before, "led" where your profile said "worked on").
- Then an optional AI check. If the AI says something needs evidence but doesn't point to any, we downgrade its verdict.
- It **never blocks** you and **never claims a fact is true**. It just tells you what it noticed.

### 5e. One fact pool, shared per platform (`src/lib/fact-platforms.ts`)
You write a fact once and choose which apps it's allowed on. A fact you didn't share with Tinder can't be used to support a claim on Tinder.

---

## 6. Checks done by code in your browser (no AI, instant, private)

All in `src/lib/`, all with tests.

| File | What it checks |
|---|---|
| `lint.ts` | **Quick check:** buzzwords ("synergy", "passionate"), no specifics, no clear role, listing duties instead of results, repeated words. |
| `fit.ts` | **Where it fits:** your text against each platform's real character limit. |
| `consistency.ts` | **Hub:** contradictions between your profiles (different job title on LinkedIn and Tinder). |
| `styles.ts` / `style-check.ts` | Does a rewrite follow its chosen style (Direct, Narrative, Professional) and length? |
| `answered.ts` | **Audience questions answered:** how many reader questions moved to "Moderate" or "Strong" after the rewrite. Real counts only, never a made-up score. |
| `proof.ts` | Copy or download your profile with its sources attached. |
| `benchmark.ts` | The `/factcheck` page: plants fake claims and shows how many FactCheck caught, and lists the misses. |
| `autofill.ts` | "Fill from your other profiles": copies your own sentences into empty spots, picking what suits each platform. |

**Why in the browser?** It's instant, free, works without an AI key, and your text never leaves your computer for these.

---

## 7. The screens and where they live

| Page | Folder | What it is |
|---|---|---|
| **Home** | `src/app/page.tsx` | Scenic landing page, one picture per group: professional, social, dating. |
| **Identity Hub** | `src/app/hub/` | Your "sources": import your LinkedIn PDF, add a photo, see which facts appear where, spot contradictions. |
| **Studio** | `src/app/studio/` | The main flow for one platform (`?platform=hinge`, etc.). |
| **FactCheck benchmark** | `src/app/factcheck/` | Shows FactCheck catching planted fakes. |

The **Studio flow** (`PersonaFlow.tsx`) goes step by step, shown as stops on a rail (`TourStops.tsx`):
1. **Enter your profile**: `LinkedInEditor`, `TinderEditor`, or the Hinge prompt boxes. Quick check and Where it fits show up right away.
2. **Say yes to sending your text** (once per browser): `ConsentScreen`.
3. **Pick audiences**: `AudienceSelection`. Readers are defined by *what they look for*, never by age, gender, or other demographics.
4. **See feedback**: `AudienceClash` / `ProfileClash`. Click a comment to highlight the exact sentence it's about.
5. **Get rewrites**: `SectionRewrites` (LinkedIn) or `RewriteComparison` (dating and bios), with FactCheck warnings, a before/after diff, and "Use this version" (with undo).
6. **Finish**: copy everything, with sources.

A **progress bar** (`ProgressBar.tsx`) shows while an AI request runs.

---

## 8. Data shapes (`src/lib/schemas.ts`)

This file is the "contract" everyone agreed on first. It defines, with zod, what a segment, a fact, a critique, a rewrite, and a warning look like. **Why first?** So the screen-builders could work with fake sample data while the AI-builders worked on the real thing, at the same time, without waiting for each other.

`src/lib/demo-data.ts` holds a **made-up person** used for sample mode. Sample results are always labeled as samples, never passed off as live.

---

## 9. Privacy and safety rules (and why)

- **Ask before sending anything to the AI.** Your text goes to Google or OpenRouter only after you agree. We remember just a yes/no flag in your browser (`localStorage`), never your text, and you can take it back.
- **The server double-checks consent** on every request, so skipping the screen doesn't work.
- **No database, no login.** Your profile lives only in the open tab (`src/lib/identity-session.ts`) and is gone on refresh.
- **Location and personal picks are never sent** (on Tinder: location, relationship goals, lifestyle choices).
- **The PDF import drops your name, contact info, and location** and runs entirely in your browser.
- **The AI key stays on the server.** It's in `.env.local` (never uploaded to GitHub) and in Vercel's settings. The browser never sees it.
- **No real profiles in the code.** The repo is public, so tests use made-up profiles.
- **No fake scores.** No "85% hireable." Any number on screen is a real count.

---

## 10. Testing

- `npm test` runs about **40 test files** with Vitest. Every code-only checker has tests (FactCheck has cases for fake numbers, fake companies, fake dates, puffed-up verbs, honest rewording, and more).
- Files ending in `.local.test.ts` run against real profiles **on your own computer only** and are never committed with real data.
- The `evals/` folder has **20 made-up test profiles** (10 LinkedIn, 10 Hinge), each with "traps": tempting lies a rewrite must not make. Tests confirm FactCheck catches every trap it's supposed to catch. Traps it *can't* catch (like a brand-new hobby) are listed honestly as known blind spots.

---

## 11. Running and shipping it

| Command | What it does |
|---|---|
| `npm run dev` | Runs the site on your computer at http://localhost:3000 |
| `npm test` | Runs the tests |
| `npm run lint` | Checks code style |
| `npm run build` | Builds the production version. Must pass before deploying. |
| `vercel` / `vercel --prod` | Puts a preview / the real site online |

Live site: https://hackathon-app-nu.vercel.app

---

## 12. Glossary

- **API / route**: a web address the browser sends data to and gets an answer back from.
- **Component**: a reusable piece of a screen (a button, a card, a whole editor).
- **Deterministic**: gives the same answer every time for the same input. FactCheck is; the AI isn't.
- **Environment variable**: a setting (like a secret key) stored outside the code.
- **JSON**: a simple text format for data, like `{"name": "Sam", "age": 30}`.
- **LLM**: Large Language Model, the kind of AI that reads and writes text (Gemini, Claude).
- **localStorage**: a small storage box inside your browser for one website.
- **Prompt**: the instructions we send the AI.
- **Rate limit**: the AI service saying "too many requests, slow down."
- **Schema**: a description of what data should look like.
- **Segment**: one numbered piece of your text (roughly a sentence).
- **SDK**: a ready-made code library for using a service.
- **Server**: a computer on the internet that runs our backend code. Here, Vercel runs it for us.
