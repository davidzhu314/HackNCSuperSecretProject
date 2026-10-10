# SkinOS — Spec

**Tagline:** Your skin. Your budget. Your routine.

Upload a selfie (optional), answer a short questionnaire, set a budget, and get a conservative AM/PM skincare routine with real products. Moving the budget slider instantly recomputes the product combination. **SmartSpend** (the budget optimizer plus owned-product reuse) is the defining feature.

SkinOS is educational and shopping assistance. It is NOT diagnostic.

## SmartSpend (defining feature)
The demo is not a chatbot listing products. It is a real optimization: your budget, your concerns, and what you already own go in, and the cheapest appropriate routine comes out.
1. Build a routine from reported concerns, preferences, and optional non-diagnostic photo observations.
2. Ask which skincare products the user already owns (pick from catalog or type a name).
3. Reuse an owned product only when its identity and relevant ingredients can be established. If ingredients can't be verified, mark it "owned, ingredients unverified" and flag it against the user's sensitivities instead of silently trusting it.
4. Work out which routine categories remain uncovered.
5. Find purchases and retailer links for uncovered categories (catalog first, live Gemini discovery second).
6. Label every price as verified live, catalog reference, or unavailable.
7. Deterministic TypeScript optimizer. Budget $20–$250. The slider recomputes locally from existing candidates, with no new Gemini request per movement.
8. Prioritize foundational steps and ingredient-safety constraints. No duplicate purchases, no unnecessary optional products.
9. Explain every substitution and skipped item. Support swapping. Never silently exceed the budget. If nothing fits, explain why.
10. **Already Owned** toggle on any product: it drops out of the shopping cost, and the freed budget is reallocated to missing products (or a justified optional step).
11. Final screen shows: the routine, products already owned, remaining purchases with retailer links, and total spending.

## Reference repo (inspiration only)
https://github.com/micpana/AI-Powered-Skin-Facial-Condition-Diagnosis-Mobile-Application (checked 2026-10-10).
- It is a React Native + Flask + MongoDB app with a custom CNN. No trained model or dataset is included, no license is shown, and it has no budget optimizer or documented product data source.
- It *diagnoses* conditions (acne, eczema, rosacea) with no disclaimer. SkinOS must not. Our non-diagnostic rules override anything from the repo.
- Use it only for the idea of: facial input, profile collection, product matching, allergen filtering, lifestyle suggestions. Do not copy code. We use Next.js and Gemini instead, with no CNN training.

## Safety rules (non-negotiable)
- Never diagnose (acne, rosacea, eczema, etc.) or claim a selfie shows a medical condition.
- No clinical scores, no prescriptions, no promised results. Photo observations are always labeled as limited (lighting, filters).
- Separate "visible in photo" from "you reported". State uncertainty. Serious symptoms: advise a professional.
- Conservative routines: cleanser, moisturizer, SPF 30+ first. No aggressive multi-active routines by default.
- Respect reported allergies, pregnancy/breastfeeding and dermatologic-treatment flags (avoid actives, refer out).
- Photos: explicit consent before sending to Gemini, never persisted, never logged. Skip-photo path must work.
- Never invent prices, retailers, ratings, images, or URLs. No checkout or payments.
- Gemini failure: never fake an analysis. Offer a clearly labeled demo mode with sample data.

## Stack
Next.js 16 App Router (`src/app/`), TypeScript, Tailwind, shadcn/ui, lucide-react, motion, zod, `@google/genai` (server-side only). No DB, no auth. React state plus localStorage (non-sensitive prefs only). Follow current official `@google/genai` docs, not remembered examples.

Env: `GEMINI_API_KEY`, `GEMINI_MODEL` (configurable, must support images and structured output). Provide `.env.example`.

## Flow
1. **Landing**: hero ("Better skin starts with a smarter routine."), 3 feature cards, product preview mockup. CTAs: Analyze My Skin / Explore How It Works.
2. **Onboarding** (multi-step): photo (upload or camera, jpg/png/webp, size limit, guidelines, consent, skip) → questionnaire (skin type, concerns multi-select, time commitment, sensitivities free text, current products, special considerations) → budget (default $75, $20–$250 step $5, presets $30/$75/$150, country US/USD, include owned products toggle) → analyze with honest progress states and retry on error. No fake percentages.
3. **Dashboard**: Overview, Routine (AM/PM tabs), Budget Studio, Shop Your Routine, AI Explanation + disclaimer.

## Data model
```ts
type RoutineStep = { id; name; category; timing: "AM"|"PM"|"Both"; priority: "essential"|"optional"; explanation }
type SkinAnalysis = {
  observations: { summary; visibleFeatures: string[]; limitations: string[] };
  reportedConcerns: string[]; priorities: string[]; routineSteps: RoutineStep[];
  ingredientGuidance: { consider: string[]; avoidOrReview: string[] };
  reasoning: string; disclaimer: string;
}
type PriceStatus = "verified" | "reference" | "unavailable"
type Product = { id; brand; name; category; sizeLabel?; ingredients?: string[]; price?: number; priceStatus: PriceStatus;
  retailer?; url?; linkType: "product-page" | "search"; imageUrl?; source: "live" | "catalog"; suitabilityTags: string[]; ingredientsKnown: boolean }
type OwnedItem = { productId?: string; freeText?: string; category: string; matched: boolean; ingredientsVerified: boolean }
```
Validate every model response with zod server-side. Handle invalid output gracefully.

## API
- `POST /api/analyze`: image (optional) plus questionnaire → validated `SkinAnalysis`.
- `POST /api/products/search`: category + concerns + exclusions + country + budget → candidate `Product[]` (Gemini with Google Search grounding where supported, using source metadata).

## Product sourcing (reliability decision)
**Catalog-first, live-enrichment second.** The optimizer needs trustworthy numeric prices, and grounded search often can't return them.
- `src/lib/product-catalog.ts`: ~25–30 real products across cleanser/moisturizer/sunscreen/serum, 3–4 candidates per category at different price tiers, prices labeled `reference`, retailer search links labeled "Find at retailer". Verify before the demo.
- Live Gemini discovery adds candidates marked `source: "live"`. Only use a price as `verified` if backed by retrieved evidence. Otherwise "Price unavailable".
- UI always distinguishes live vs catalog/demo results. Link wording: "Find at retailer" for search links, never "Buy now" unless it is a product page.

## Budget optimizer (`src/lib/budget-optimizer.ts`) — deterministic TypeScript, no LLM arithmetic
1. Input: routine steps, candidate products per category, user exclusions, budget, owned products.
2. Hard-filter by allergies/exclusions and special-consideration rules.
3. Exclude unknown-price products from exact-budget math.
4. Essentials first, then optional steps. Search combinations (small: brute force or knapsack) maximizing a transparent suitability score subject to total <= budget.
5. Dedupe shared AM/PM products so the total counts each unique product once.
6. Owned products fill their steps first at $0 (only if suitable and not excluded). Then re-run the search over uncovered categories with the freed budget, so marking something owned can unlock an upgrade or a justified optional step.
7. Output: selected products, total, remaining, distinct count, substitutions vs previous result, status. If no essential routine fits, say so. Never exceed budget silently. Higher price must not be treated as higher quality.
8. Unit test it (budgets $35/$75/$150, dedupe, exclusions, impossible budget).

Slider recomputes instantly from existing candidates (debounce any extra search). **Swap Product**: show alternatives with price and relevance, recalc, warn if over budget, allow revert. Explain that more budget does not mean more products or better results.

## UI
Premium skincare feel: warm off-white, sage, peach, big whitespace, rounded cards, subtle motion, no generic chatbot look. Palette: bg `#FAF9F6`, sage `#809B87`, deep green `#283E34`, peach `#F4D9CA`, cream `#F2EDE4`, text `#26332C`. Inter or Geist body. Responsive. Every visible button works. Real loading, error, and empty states. Links open in a new tab with `rel="noopener noreferrer"`. Tasteful placeholder when no verified image.

## Build order (24h)
| Hours | Work |
|---|---|
| 0–2 | shadcn/ui setup, palette, landing page, deploy a hello-world to Vercel |
| 2–5 | Onboarding steps, validation, consent, skip-photo |
| 5–9 | `/api/analyze`, zod schema, demo mode, routine view |
| 9–14 | Catalog, optimizer (incl. owned products) plus unit tests, Budget Studio slider |
| 14–18 | Product cards, swap, Already Owned toggle, shopping list, final summary screen |
| 18–21 | Live grounded discovery as enrichment |
| 21–24 | Polish, README, deploy, rehearse demo, record backup video |

Priority 0 is the full flow plus optimizer. Cut list if behind: live discovery, routine saving, animations. Stretch only if time: budget tier comparison, ingredient label scanner, skin journal.

## Acceptance tests
1. **Normal flow:** landing → photo → questionnaire → $75 → analyze → real Gemini guidance, AM/PM routine, products with source and price status shown.
2. **Budget adjustment:** $100 → $40; products recompute, optional items drop, verified total <= $40; if impossible, clear message; no fictional products.
3. **Swap:** pick an alternative; total updates, other choices preserved, over-budget warning shown, revert works.
4. **No photo:** skip upload, complete questionnaire, get a routine; dashboard says no photo analysis occurred.
5. **Invalid image:** unsupported type shows a useful message and no API request is sent.
6. **API failure:** remove or invalidate the Gemini key; show an informative error and a clearly labeled demo mode; never pretend the analysis succeeded.
7. **Discovery failure:** simulate retailer discovery failing; show catalog fallback with "reference price" labels, never presented as live; budget controls still work.
8. **Duplicate product:** same moisturizer in AM and PM counts once in the total.
9. **Allergy:** a reported ingredient sensitivity removes matching products.
10. **Privacy:** API key never in the client bundle; images never stored or logged.

11. **Already Owned:** marking a moisturizer owned removes its price from the total, adds $0 for that step, and reallocates the freed budget; an owned item with unverified ingredients is flagged, not trusted.

## Demo script (the catalog and optimizer must support this exactly)
1. Open the landing page.
2. Upload a selfie, pick concerns.
3. Set budget to **$100**.
4. Gemini proposes a conservative routine.
5. Products appear with shopping links and clear price-source labels.
6. Show the total routine price.
7. **Wow moment:** drag the slider **$100 → $40**. Expensive options swap for affordable ones, non-essentials drop, total stays <= $40 (or the UI explains why a full routine isn't possible).
8. Mark a suitable moisturizer **Already Owned**: it leaves the shopping cost and the freed budget is reallocated to missing products.
9. Final screen: routine, owned products, remaining purchases, retailer links, total spending.
10. Click a product and show where to buy it.
11. Raise the budget to **$150**; recommendations adjust again.

Catalog design constraint: the cheapest in-category picks (cleanser + moisturizer + SPF) must total comfortably under $40, and the $100 and $150 results must look visibly different. Check this before building any UI.

Philosophy: SkinOS recommends an appropriate routine that fits skin concerns, preferences, and wallet, never the most expensive one.

## Deliverables
- Working Next.js app, deployed to Vercel
- `.env.example`
- README: install, how to get and set a Gemini API key, run dev server, deploy to Vercel
- README section stating which features are real, which use fallback/demo data, and which are not implemented
- `npm run build` and TypeScript checks passing