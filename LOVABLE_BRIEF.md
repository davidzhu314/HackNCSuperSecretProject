# PERSONA UI brief (for Lovable)

Paste everything below the line into Lovable. It describes the screens to build and the exact data they display.

---

## What we're building

**PERSONA**: "One identity. Every platform. Authentically you."

A web app that helps someone improve their LinkedIn profile (later also Hinge) **without inventing anything about them**. The user pastes their profile text, agrees to send it to the AI, ticks which facts about themselves are true, picks some simulated audiences, and gets:
1. feedback from those audiences, where every point is linked to the sentence it's about, and
2. a rewritten version that only uses facts they confirmed, checked by "FactCheck", which flags anything the AI made up.

Principle shown in the UI: **improve expression, not invent identity.**

## Hard constraints (important)

- **Frontend only. Use mock data only.** Do not add Supabase, a database, auth, login, or any AI/LLM calls. The real backend already exists in another app (Next.js) and these screens will be copied into it. All data comes from the mock data at the bottom of this brief.
- Put all fake data in one file, `src/mockData.ts`, using the exact JSON below. Do not change field names.
- Use **React + TypeScript + Tailwind + shadcn/ui + lucide-react** icons. No other UI libraries.
- Build each screen as its own component that **receives data through props** and reports user actions through callback props (e.g. `onConfirm(facts)`). Components should not fetch data or read mockData themselves; only the top-level page passes mock data in. This makes them easy to move into the real app.
- Mobile-friendly (works at phone width), accessible (labels on inputs, keyboard usable, good contrast). Every visible button must do something.
- No other platforms (no Instagram, no email, etc.). Only LinkedIn and Hinge, and Hinge can be a disabled "coming soon" option for now.

## Wording rules (the judges will check these)

- Label all feedback **"Simulated AI feedback"**. Audiences are simulated viewpoints, not real recruiters.
- Ratings are **words only**: Not evident / Weak / Moderate / Strong. **Never** show percentages, scores, stars, "hireability", or "match %".
- Any sample/demo result must show a visible badge **"Sample result"** (data with `"source": "sample"`). Never make a sample look like a live result.
- When FactCheck finds nothing, say exactly **"No unsupported concrete claims detected"** with a small note: "FactCheck catches concrete claims like numbers, names, and inflated verbs. It can miss subtle exaggeration." **Never** say "verified", "true", or "accurate".
- The consent screen must say that the text and confirmed facts are sent to **OpenRouter and the underlying AI model provider**, and that nothing is stored.

## Screens (one flow, a step indicator at the top)

### 1. Start / input
- Title, tagline, one-line explanation of the principle.
- Platform choice: LinkedIn (active), Hinge (disabled, "coming soon").
- LinkedIn fields: **Headline** (one line) and **About** (textarea). Optional **Job description** textarea (collapsed by default, "Target a specific job").
- Button **"Load demo persona"** fills the fields from `linkedinInput` and shows a small note "Fictitious demo persona".
- Button **"Continue"** (disabled while About is empty).

### 2. Consent
- Plain explanation of what is sent (the pasted text + confirmed facts), to whom (OpenRouter and the underlying model provider), and that nothing is saved.
- Consent comes **before** the facts screen, because suggesting facts already sends the text to the AI.
- Two buttons: **"I agree, continue"** and **"Go back"**. Declining must not move forward.

### 3. Identity DNA (component name: `IdentityFacts`)
- Explains: "Tick the facts that are true about you. Only ticked facts can be used in a rewrite."
- List of facts with checkboxes (`facts`). Each fact text is editable inline. A small tag shows where it came from ("Suggested by AI" for `source: "extracted"`, "Added by you" for `source: "user"`).
- "Add a fact" input + button.
- Suggested facts start **unticked**. Never pre-tick an AI-suggested fact.
- Empty state: "No concrete facts found in your text. Add a few true facts about yourself."
- Continue button.

### 4. Choose audiences and traits
- Pick 1-3 audiences and 1-5 traits from `platforms.linkedin` (show `label`, keep `id` internally). Default: all 3 audiences, first 3 traits.
- Button "Get feedback". Show a loading state (it takes a few seconds for real).

### 5. Audience Clash (component name: `AudienceClash`)
- Header with "Simulated AI feedback" label and, if `source` is "sample", the "Sample result" badge.
- **Matrix**: rows = audiences, columns = traits, each cell shows the rating word with a color (Not evident = gray, Weak = amber, Moderate = blue, Strong = green). Look up labels from `platforms` using the ids in each critique.
- **Critique cards** below: audience, trait, rating, rationale, suggestion.
- **Source panel** showing the user's text split into its `segments` (each segment is one sentence, with id like "s1").
- **Clicking a cell or card highlights the cited segments** (`segmentIds`) in the source panel. If `missingEvidence` is true, show "Missing evidence: nothing in your text supports this yet" instead of highlighting.
- If the response has `warnings`, show them in a small notice ("The AI cited text that doesn't exist; it was ignored").
- Button "Rewrite my profile".

### 6. Rewrite + FactCheck (component name: `RewriteComparison`)
- Options before generating: tone (Closer to my words / Balanced / More playful), optional goal text.
- **Side by side** (stacked on mobile): Original vs Rewritten. Word-level diff highlighting (added words green, removed words red/strikethrough). The rewrite `content` uses `\n` line breaks: first line is the headline, then a blank line, then the About text.
- **Change summary** list (`changeSummary`).
- **Facts used** chips (from `usedFactIds`, show the fact text).
- **FactCheck panel**:
  - If `warnings` is empty: green "No unsupported concrete claims detected" + the limitation note above.
  - Otherwise: a red/amber list, one item per warning, showing the flagged `text`, a friendly label for `kind`, and the `explanation`. Also highlight the flagged words inside the rewritten text.
  - Friendly labels: `unsupported_number` = "Number not in your facts", `unsupported_entity` = "Name not in your facts", `inflated_verb` = "Stronger claim than your facts", `invalid_fact_id` = "Unknown or unconfirmed fact", `unsupported_claim` = "Needs your review", `unverified_segment` = "Unknown source".
  - If there are warnings, the copy button says "Copy anyway" and the user can edit the rewritten text before copying.
- **Copy** button (copies the rewritten text, shows "Copied").
- A small **"Show FactCheck demo"** toggle that swaps in the `adversarial` mock (an intentionally exaggerated rewrite) so we can show FactCheck catching made-up claims. Label it "Intentional test case".

### General states
- Loading: skeletons or spinners with text ("Getting simulated feedback...").
- Errors: a friendly message + "Try again" button. Mock at least one error state (e.g. a toggle in dev) so it exists.

## Data shapes (TypeScript, match exactly)

```ts
type Platform = "linkedin" | "hinge";
type Segment = { id: string; text: string; prompt?: string };          // prompt is for Hinge only
type IdentityFact = { id: string; text: string; confirmed: boolean; source: "extracted" | "user" };
type Rating = "not_evident" | "weak" | "moderate" | "strong";
type AudienceCritique = {
  audience: string;      // audience id, e.g. "startup_founder"
  trait: string;         // trait id, e.g. "clarity"
  rating: Rating;
  segmentIds: string[];  // which segments this is about; empty when missingEvidence is true
  missingEvidence: boolean;
  rationale: string;
  suggestion: string;
};
type GuardWarning = {
  kind: "unsupported_number" | "unsupported_entity" | "inflated_verb"
      | "invalid_fact_id" | "unsupported_claim" | "unverified_segment";
  text: string;          // the flagged words
  explanation: string;
};
type Rewrite = { platform: Platform; content: string; usedFactIds: string[]; changeSummary: string[] };
type ResultSource = "live" | "sample";

type EvaluateResponse = { source: ResultSource; critiques: AudienceCritique[]; warnings: GuardWarning[] };
type RewriteResponse  = { source: ResultSource; rewrite: Rewrite; warnings: GuardWarning[] };
type RewriteTone = "closer_to_my_words" | "balanced" | "more_playful";
```

## Mock data (`src/mockData.ts`, use exactly)

```json
{
  "platforms": {
    "linkedin": {
      "audiences": [
        {
          "id": "startup_founder",
          "label": "Startup founder"
        },
        {
          "id": "technical_recruiter",
          "label": "Technical recruiter"
        },
        {
          "id": "research_lead",
          "label": "Research or hiring lead"
        }
      ],
      "traits": [
        {
          "id": "clarity",
          "label": "Clarity"
        },
        {
          "id": "technical_specificity",
          "label": "Technical specificity"
        },
        {
          "id": "ownership_impact",
          "label": "Ownership and impact"
        },
        {
          "id": "relevance",
          "label": "Relevance"
        },
        {
          "id": "approachability",
          "label": "Approachability"
        }
      ]
    },
    "hinge": {
      "audiences": [
        {
          "id": "humor",
          "label": "Humor-oriented"
        },
        {
          "id": "shared_interests",
          "label": "Shared-interests-oriented"
        },
        {
          "id": "serious_relationship",
          "label": "Serious-relationship-oriented"
        }
      ],
      "traits": [
        {
          "id": "specificity",
          "label": "Specificity"
        },
        {
          "id": "warmth",
          "label": "Warmth"
        },
        {
          "id": "authenticity",
          "label": "Authenticity"
        },
        {
          "id": "conversational_tone",
          "label": "Conversational tone"
        },
        {
          "id": "distinctiveness",
          "label": "Distinctiveness"
        }
      ]
    }
  },
  "linkedinInput": {
    "headline": "Aspiring tech professional | Passionate about innovation",
    "about": "I am a motivated team player who is passionate about technology. I have experience with various projects and love learning new things. Looking for opportunities to grow and make an impact."
  },
  "hingeInput": [
    {
      "prompt": "I'm weirdly good at",
      "answer": "Finding the best food truck in any city."
    },
    {
      "prompt": "A perfect Sunday",
      "answer": "Making pancakes and then a long walk with no plan."
    }
  ],
  "segments": [
    {
      "id": "s1",
      "text": "Aspiring tech professional | Passionate about innovation"
    },
    {
      "id": "s2",
      "text": "I am a motivated team player who is passionate about technology."
    },
    {
      "id": "s3",
      "text": "I have experience with various projects and love learning new things."
    },
    {
      "id": "s4",
      "text": "Looking for opportunities to grow and make an impact."
    }
  ],
  "facts": [
    {
      "id": "f1",
      "text": "I am a senior studying computer science.",
      "confirmed": true,
      "source": "user"
    },
    {
      "id": "f2",
      "text": "I contributed bug fixes and documentation to an open-source data visualization library.",
      "confirmed": true,
      "source": "user"
    },
    {
      "id": "f3",
      "text": "I was a teaching assistant for an introductory programming course.",
      "confirmed": true,
      "source": "user"
    },
    {
      "id": "f4",
      "text": "I built a course-planning web app with Python and React for a class project.",
      "confirmed": true,
      "source": "user"
    },
    {
      "id": "f5",
      "text": "I enjoy explaining technical ideas to non-technical people.",
      "confirmed": true,
      "source": "user"
    }
  ],
  "evaluate": {
    "source": "sample",
    "warnings": [],
    "critiques": [
      {
        "audience": "startup_founder",
        "trait": "ownership_impact",
        "rating": "weak",
        "segmentIds": [
          "s3"
        ],
        "missingEvidence": false,
        "rationale": "\"Experience with various projects\" does not say what was built or what the person did.",
        "suggestion": "Name one project and your specific part in it."
      },
      {
        "audience": "technical_recruiter",
        "trait": "technical_specificity",
        "rating": "not_evident",
        "segmentIds": [],
        "missingEvidence": true,
        "rationale": "No languages, tools, or technical work are mentioned anywhere in the text.",
        "suggestion": "Add the technologies you have actually used, drawn from your confirmed facts."
      },
      {
        "audience": "research_lead",
        "trait": "clarity",
        "rating": "weak",
        "segmentIds": [
          "s1",
          "s2"
        ],
        "missingEvidence": false,
        "rationale": "The headline and opening use general phrases (\"passionate\", \"innovation\") that could describe anyone.",
        "suggestion": "Lead with your field and one concrete thing you have done."
      }
    ]
  },
  "rewrite": {
    "source": "sample",
    "warnings": [],
    "rewrite": {
      "platform": "linkedin",
      "content": "Computer science senior | Python and React | Teaching assistant and open-source contributor\n\nI am a computer science senior who builds practical tools and enjoys explaining technical ideas to non-technical people. I built a course-planning web app with Python and React, contributed bug fixes and documentation to an open-source data visualization library, and was a teaching assistant for an introductory programming course.",
      "usedFactIds": [
        "f1",
        "f2",
        "f3",
        "f4",
        "f5"
      ],
      "changeSummary": [
        "Replaced generic phrases with your confirmed projects and roles.",
        "Headline now states your field and tools instead of \"aspiring\" and \"passionate\".",
        "No numbers, employers, or dates were added."
      ]
    }
  },
  "adversarial": {
    "source": "sample",
    "rewrite": {
      "platform": "linkedin",
      "content": "Software engineer who led the open-source data visualization library and improved model accuracy by 95% at Google. Led a team of 200 students as head teaching assistant.",
      "usedFactIds": [
        "f2",
        "f3",
        "f9"
      ],
      "changeSummary": [
        "Intentionally embellished test case."
      ]
    },
    "warnings": [
      {
        "kind": "unsupported_number",
        "text": "95%",
        "explanation": "This number does not appear in your original text or confirmed facts."
      },
      {
        "kind": "unsupported_number",
        "text": "200",
        "explanation": "This number does not appear in your original text or confirmed facts."
      },
      {
        "kind": "unsupported_entity",
        "text": "Google",
        "explanation": "This name does not appear in your original text or confirmed facts. (Heuristic check.)"
      },
      {
        "kind": "inflated_verb",
        "text": "led",
        "explanation": "Your confirmed fact says \"contributed\"; \"led\" claims a stronger role."
      },
      {
        "kind": "invalid_fact_id",
        "text": "f9",
        "explanation": "The model cited a fact ID that does not exist."
      },
      {
        "kind": "unsupported_claim",
        "text": "Software engineer who led the open-source data visualization library and improved model accuracy by 95% at Google",
        "explanation": "Most of this sentence isn't traceable to your original text or confirmed facts. Review it before using it."
      }
    ]
  }
}
```
