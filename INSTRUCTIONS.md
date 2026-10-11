# PERSONA profile rewrite instructions

These are the writing rules for PERSONA's AI rewrite API. The runtime prompt builders in `src/lib/prompts.ts` apply these rules to profile rewrites and LinkedIn section rewrites. Keep that prompt behavior aligned with this document when either is changed.

## Purpose

Rewrite the user's submitted profile for the selected application. Return ready-to-copy profile content that fits the selected app's audience, field, voice, and character limit. Improve how the user's real information is expressed; do not invent or infer who the user is.

The output is the profile copy itself. Do not replace it with advice, an explanation of the user's characteristics, or a summary of what was changed. The API's structured `changeSummary` field may briefly describe edits, but it must not be added to the copy. Keep that summary to at most three short, useful points; omit minor wording changes and implementation commentary.

## Rules for every application

- Use only the original profile text and facts the user explicitly confirmed.
- Do not invent or infer skills, accomplishments, numbers, dates, employers, schools, credentials, interests, preferences, personality traits, or goals.
- Do not strengthen a claim or verb beyond what the source supports.
- Keep the user's meaning and recognizable voice. Do not turn a real person's profile into generic marketing copy.
- Put the most useful supported detail first. Keep a phrase, sentence, or bullet only when it adds a concrete fact or useful context; remove filler and repeated information.
- Aim for high information per word, not maximum compression. Preserve the connecting words and context that make the copy clear when read aloud.
- Use short phrases or fragments only when they sound natural in that app and field. Do not cram keywords, stack unrelated details, force bullets, or remove grammar just to save characters.
- Do not fill the available character limit. Stop when more text would add little value; stay well under the limit when that produces a clearer profile.
- When rewriting several fields together, let them complement one another. Avoid repeating the same fact in every field when other supported details fit better. Do not force variety when the source does not provide it.
- Use bullets only when the field and its required format support them. Follow the app's format, existing bullet structure, and character limit exactly.
- When a section has a length control, honor that section's selected setting: shorter should reduce its actual text, same should stay near its actual text length, and longer may add only distinct detail supported by the source. Do not apply one section's setting to another section, expand a short field under "same" or "shorter" to a typical size, or pad to meet a target. A target is guidance, not a quota.
- Return only the requested profile field content in the rewrite field. Do not add labels, commentary, markdown fences, or a prefatory explanation.

## Match the selected application

### Professional: LinkedIn and Handshake

- Lead with the user's current work or studies, then the strongest relevant project, activity, or experience present in the source.
- Sound clear, credible, and professional, with a human conversational voice. State confirmed information directly without self-praise or inflated claims.
- Keep headlines brief and specific: prioritize role or field plus one relevant specialty when the source supports it. Avoid keyword strings.
- For LinkedIn About text, use a concrete opening and short, skimmable paragraphs. Give each paragraph a distinct purpose, and do not repeat the headline. Use concise bullets for lists of projects or roles when appropriate.
- For LinkedIn experience, education, project, or volunteering descriptions, preserve the selected paragraph or bullet format. Keep bullets compact, factual, and ordered by relevance. Describe the person's contribution and method; include an outcome only when the source provides one.
- Keep Handshake summaries to one or two short, natural sentences. Prioritize current study/work, one relevant example, and a stated role direction if present; omit lower-value details rather than listing keywords.

### Social: Instagram and Facebook

- Make the bio understandable at a glance and keep the user's own casual voice.
- Choose one clear identity anchor and, when the source supports them, one or two complementary interests or details. Prefer a natural short line or a few well-balanced lines over a dense list.
- Use punctuation or line breaks to make details easy to scan. Avoid awkward fragments, repeated facts, and strings of keywords separated by slashes or commas.
- Include only the user's stated interests and details. Do not add hashtags, links, handles, places, groups, or emoji that are not supported by the input.

### Personal and dating: Hinge and Tinder

- Keep wording warm, specific, and conversational without claiming what the user is like beyond their own stated information.
- For Hinge, answer each original prompt directly, in first person, as one short and natural thought. Keep each answer in its original slot and within its character limit. Give each answer a distinct supported detail when possible, without forcing variety or making a bullet list. Do not repeat the prompt.
- For Tinder, use one or two brief, connected thoughts built from a few complementary details. Keep enough grammar for a natural voice; avoid a long explanation, a checklist of traits, or a cramped string of interests.
- Make an answer easy to respond to through a real detail or point of view the user supplied. Do not add a question or conversation hook unsupported by their text.
- Keep jokes and playful details only when the user's source supports them. Do not invent dating preferences, relationship goals, activities, places, food, pets, or plans.

## Preferred output shape

- Profile text: concise, app-native copy that the user can copy directly.
- LinkedIn experience/project lists: short factual bullets when the input or selected format uses bullets.
- Hinge prompt: one concise answer per prompt, not a commentary list.
- Instagram/Facebook bio: a clear identity anchor plus the most useful supported details, readable at a glance.
- Tinder bio: a small number of related details in natural conversational wording.
- Concision should make the profile easier to understand, not make it sound abrupt, generic, or overloaded.

## Final self-check

Before returning a rewrite, check that it:

1. Fits the selected application's field and character limit.
2. Uses only supported source information and confirmed facts.
3. Preserves the required content shape and answers each original prompt when applicable.
4. Sounds concise and natural in that application's context.
5. Contains no extra explanation, invented characteristic, or generic filler.
6. Reads naturally aloud and uses each phrase, sentence, or bullet to add useful information.
7. Avoids repeated details and keyword stuffing without forcing the copy to use fewer words than natural phrasing needs.
