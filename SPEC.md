# Personify — Spec

(Earlier name: PERSONA.)

**Tagline:** One identity. Every platform. Authentically you.
**Principle:** Improve expression, not invent identity.

Users paste profile text, confirm a few true facts about themselves ("Identity DNA"), pick an audience, and get evidence-backed feedback plus rewrites grounded only in confirmed facts. A deterministic **FactCheck** layer flags anything the rewrite invented. MVP platforms: **LinkedIn and Hinge only**. No dummy buttons for other platforms.

Why it isn't "ChatGPT with a nicer UI": (1) several audience perspectives side by side, (2) every critique links to the exact source text, (3) a deterministic fabrication check instead of a prompt that says "don't make things up", (4) rewrites limited to user-approved facts.

Superseded idea: SkinOS spec is archived at `archive/SKINOS-SPEC.md`.

## Trust rules (non-negotiable)
- Audiences are **simulated evaluation lenses**, not real recruiters or daters. Never claim to predict hiring, matches, or engagement. No percentages, no hireability scores, no made-up "profile scores": anything numeric shown to users must be a real count. (The on-screen "simulated AI feedback" label is dropped for now, by user decision in the sections phase; the rule against predictions still applies.)
- Never invent credentials, employers, numbers, dates, skills, hobbies, or romantic preferences. Only **confirmed** facts may support generated personal claims. Inferred facts are never auto-confirmed.
- Never say a rewrite is "verified true". Say "no unsupported concrete claims detected" when the guard finds nothing.
- Explicit consent before any text goes to the AI provider (OpenRouter and the underlying model provider). Consent is asked once per browser and remembered as a flag in `localStorage` (never profile text), with a visible way to withdraw it; every API request still carries `consent: true` and is rejected without it. Don't persist profiles by default. Don't log profile text. No scraping, OAuth, or auto-posting.
- No silent fake results. Demo/cached outputs are visibly labeled and never disguised as live runs.
- Avoid demographic stereotypes in audience descriptions.

## Stack
Next.js 16 App Router (`src/app/`), TypeScript, Tailwind, shadcn/ui, lucide-react, zod, the `openai` SDK pointed at OpenRouter (`https://openrouter.ai/api/v1`, server-side only). React state plus localStorage for non-sensitive prefs only. No DB, no auth. Deploy on Vercel.

Env: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (configurable, must support structured JSON output; verify by test, since support varies by model/provider). Provide `.env.example`. Follow current official OpenRouter docs, not remembered examples. Validate every response with zod and retry once on invalid JSON. Use low temperature; it reduces variation but doesn't guarantee reproducibility.

## User flow
1. Choose platform: LinkedIn or Hinge.
2. Enter existing text. LinkedIn: a profile by **sections** (headline, About, and entries under Experience, Education, Projects, Volunteering), pasted into a section editor or imported from LinkedIn's "Save to PDF" export (parsed in the browser; name, contact details, and location are dropped). Hinge: 1–3 prompt question/answer pairs. A preloaded fictitious demo persona and sample profiles are available.
3. **Confirm Identity DNA:** AI proposes candidate facts, user ticks which are true and may edit or add. Demo default: 4–6 facts. Keep it short: paste → tick facts → choose audience.
4. **Consent** (first live use in this browser): selected text and confirmed facts are sent to OpenRouter and the underlying model provider. Sample mode needs no consent.
5. Choose goal traits and up to 3 audiences. LinkedIn: 8 lenses in 4 categories; the default is one lens from each of 3 categories. Optionally paste a real job description to target.
6. **Audience Clash:** categorical critique cards plus audience × trait matrix. Click a critique to highlight its source text or show "missing evidence".
7. **Rewrite:** grounded in confirmed facts. LinkedIn: one card per rewritable section (headline, About, each entry's description; titles, organizations, and dates are never rewritten), with a style dropdown (Direct, Narrative, Professional; defined in `src/lib/styles.ts` by format so other professional platforms can reuse them) and a 5-stop length slider (relative to the original; longer may only add detail the sources contain, never purposes, outcomes, or restatement), generated on demand and cached, plus "rewrite all" (at most 3 requests at a time). Hinge: two versions of the user's own prompt answers (default: minimal edit; toggle "keep closer to my words" vs "more playful").
8. **FactCheck** runs before a rewrite is shown as publish-ready. User can reject or edit flagged text.
9. **Compare:** original vs revised, change summary, linked facts, copy button.

## Platform modes
**LinkedIn** — inputs: a profile by sections (headline, About, Experience, Education, Projects, Volunteering entries; skills and honors listed, not rewritten), up to 10,000 characters, optional job description. Audiences, 4 categories × 2, each defined by what it looks for: Recruitment (talent acquisition specialist, technical recruiter), Hiring & Leadership (hiring manager, technical lead), Research & Academia (research lead, admissions/fellowship reviewer), Entrepreneurship & Networking (startup founder, industry professional). The rubric adapts to the job description when given. Traits: clarity, technical specificity, ownership/impact, relevance, approachability, shown as plain questions ("Can they tell what you do?"). Output: per-section edits that keep the section's format (headline one line, About short paragraphs, entries keep their bullets and never gain new ones), no manufactured metrics, employers, dates, qualifications, or skills.

**Hinge** — inputs: prompt question + the user's answer (1–3 pairs). Audiences: humor-oriented, shared-interests-oriented, serious-relationship-oriented (simulated interpretations, not demographic truth). Traits: specificity, warmth, authenticity, conversational tone, distinctiveness. Output: phrasing alternatives preserving the user's voice, never new experiences or preferences.

Build one configurable engine (`PlatformConfig` with rubric, audiences, traits, input shape), not two apps.

## Data model (agree on this at hour 0)
```ts
type Segment = { id: string; text: string };   // input split into numbered sentences / prompt answers
type IdentityFact = { id: string; text: string; confirmed: boolean; source: "extracted" | "user" };
type Rating = "not_evident" | "weak" | "moderate" | "strong";
type AudienceCritique = {
  audience: string; trait: string; rating: Rating;
  segmentIds: string[];          // cites segments; empty + missingEvidence=true if none
  missingEvidence: boolean; rationale: string; suggestion: string;
};
type Rewrite = { platform: "linkedin" | "hinge"; content: string; usedFactIds: string[]; changeSummary: string[] }; // usedFactIds is advisory
// LinkedIn by sections (see src/lib/schemas.ts for the zod source of truth)
type ProfileEntry = { id: string; title: string; organization: string; dates?: string; location?: string; description: string }; // only description is rewritten; location never reaches the AI
type LinkedInProfile = { headline: string; about: string; experience: ProfileEntry[]; education: ProfileEntry[];
  projects: ProfileEntry[]; volunteering: ProfileEntry[]; skills: string[]; honors: string[] };
// Profile segment ids are `${sectionKey}-s${n}`: "headline-s1", "about-s3", "exp2-s1" (an entry's s1 is its title line).
type GuardWarning = {
  kind: "unsupported_number" | "unsupported_entity" | "inflated_verb" | "invalid_fact_id" | "unsupported_claim" | "unverified_segment";
  text: string; explanation: string;
};
```
Validate every request and response with zod. Bound input lengths.

## Evidence citations (design decision)
Do not ask the model for free-text quotes: it alters whitespace, quotes, and punctuation, so exact-substring checks fail often. Instead, split the input into numbered `Segment`s server-side, have the model cite `segmentIds`, and resolve quotes from the segments on the server. Quotes are then guaranteed to exist and highlighting is trivial. Reject or flag any unknown segment ID as `unverified_segment`.

## API routes (server-side only)
- `POST /api/facts/extract`: input text → candidate facts, never marked confirmed.
- `POST /api/evaluate`: platform, segments, audiences, traits, optional job description → `AudienceCritique[]` (zod-validated, segment IDs checked).
- `POST /api/rewrite`: segments, confirmed facts only, goal, tone control → `Rewrite` plus `GuardWarning[]` from FactCheck. Used by Hinge.
- `POST /api/rewrite-section` (LinkedIn): one section, one style (`direct` | `narrative`), the profile, confirmed facts → that section's `Rewrite` plus FactCheck and style warnings. The server rewrites the profile's own copy of the section, not client-supplied text.
- `POST /api/compare` (stretch): blind A/B, fresh context, randomized order, 2–3 runs, report agreement.

## FactCheck (`src/lib/fact-guard.ts`) — signature technical feature
Deterministic and testable. Don't trust model `usedFactIds`.
1. Extract numbers, percentages, and dates from the rewrite (include simple word-numbers, e.g. "two hundred"). Flag any not present in the original text or a confirmed fact: `unsupported_number`.
2. Extract capitalized tokens / named entities (not sentence-initial, not on a small allowlist of general vocabulary, normalized for case/format). Flag any not in the original or confirmed facts: `unsupported_entity`. Admit in the UI that this is a heuristic, not perfect entity recognition.
3. **Inflation check:** a small verb list (led, managed, founded, owned, architected, launched, etc.). If the rewrite uses a stronger verb than the supporting fact (e.g. fact says "contributed", rewrite says "led"), flag `inflated_verb`.
4. Verify every referenced fact ID exists and is confirmed: `invalid_fact_id`. A valid ID doesn't prove entailment, so flag ambiguous cases for human review (`unsupported_claim`).
5. UI shows highlighted flags with reasons. Clean result reads "No unsupported concrete claims detected", with a note that qualitative inflation can still slip through.
6. Tests: fabricated metric, fabricated company, fabricated date, unsupported qualification, inflated verb, correct quotation, legitimate paraphrase, unconfirmed fact, invalid ID.
7. **Per-section corpus (LinkedIn):** a headline or About rewrite is checked against the whole profile plus confirmed facts (it may summarize); an entry rewrite only against that entry's own text plus confirmed facts, so numbers and names can't hop between jobs. The model sees the same sources FactCheck accepts.

## UI
Polished, responsive, accessible. Every visible button works. Real loading, empty, and error states. Components: `IdentityFacts`, `AudienceClash` (matrix + critique cards + source highlighting), `RewriteComparison` (diff, change summary, copy). Build with mock typed JSON first so UI and AI work can proceed in parallel. Use `diff` for word-level highlighting.

## Demo data
Fictitious persona with 4–6 confirmed facts and a deliberately vague LinkedIn profile (now by sections, with invented organizations). Cached sample outputs are clearly labeled "sample result", never shown as a live run. Keep a backup path in case the API is slow. Never use a real person's profile in demo data or tests; PDF parser tests use a synthetic export.

**Identity Hub (demo only):** a `/hub` page for the fictitious persona, labeled as a demo, with LinkedIn and Hinge cards and real fact-coverage counts ("N of M confirmed facts appear on your LinkedIn", per section) from `factCoverage`. No login, nothing saved, no invented scores.

## Build order (24h, three developers)
| Hours | Work |
|---|---|
| 0–3 | Repo, **zod schemas agreed**, screens with mock JSON, demo persona, consent screen |
| 3–8 | LinkedIn editor, `/api/evaluate`, `/api/rewrite`, first FactCheck checks |
| 8–12 | **LinkedIn end to end**: segment-citation highlighting, FactCheck warnings, copy |
| 12–17 | Hinge mode on the same engine and guard; refine audience matrix |
| 17–20 | Blind A/B only if core is solid; otherwise reliability and UX |
| 20–24 | Testing, deploy, seeded demo, 90-second pitch, backup video |

Cut rules: if LinkedIn isn't end-to-end by hour 12, cut Hinge. If the core isn't solid by hour 17, skip A/B. Never sacrifice FactCheck for visual polish.

Split: **Person 1** UI (landing, input, fact checkboxes, comparison). **Person 2** AI (LLM client, extraction, rubrics, structured outputs, rewrite prompts). **Person 3** trust (FactCheck, segment validation, matrix interactions, tests, deploy, integration).

## 90-second demo
1. Hook (15s): "Different platforms need different versions of your voice, but every version should still be you."
2. Identity (15s): load the seeded persona with confirmed facts, show the checkbox approval.
3. Audience Clash (20s): founder / recruiter / research lead, categorical matrix, click a critique to highlight its source text.
4. Rewrite (15s): grounded LinkedIn revision, before/after.
5. **FactCheck reveal (15s):** run one live adversarial prompt ("make me sound more impressive") and show the guard flagging whatever the model invents. Keep the seeded "95% accuracy at Google" example as a fallback, labeled as an intentional test. State the limitation: it catches concrete claims, not every subtle exaggeration.
6. Hinge (10s, only if stable): same facts, edited prompt answer, no new facts created.

## Acceptance tests
- Paste LinkedIn bio, confirm facts, consent → audience feedback and grounded rewrite.
- Changing audience changes the rubric and critiques; adding a job description changes the target.
- Every highlighted quote resolves from a real segment ID; unknown IDs are flagged, not highlighted.
- Unconfirmed facts can't support generated claims.
- Rewrite adding an unsupported number, employer, or stronger verb is flagged.
- Hinge uses question/answer pairs and keeps the user's own context.
- Empty input, invalid model JSON, rate limits, missing API key, and denied consent each give a sensible error.
- Mobile view, all buttons, and copy-to-clipboard work.
- No hireability percentages, simulated human endorsement, or auto-posting anywhere.

## Deliverables
Working deployed Next.js app, `.env.example`, README (install, OpenRouter API key setup, dev server, Vercel deploy), and an honest feature checklist (implemented / cached demo / not built). `npm run build`, typecheck, lint, and FactCheck tests passing. Don't claim tests passed unless they ran.

## Out of scope
Login (the hub is a demo only), database, payments, OAuth, scraping, auto-publishing, photo scoring, Identity Drift, shareable human voting, Instagram/Handshake/email (future platform configs).
