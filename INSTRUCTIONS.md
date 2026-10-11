# PERSONA profile rewrite instructions

These are the writing rules for PERSONA's AI rewrite API. The runtime prompt builders in `src/lib/prompts.ts` apply these rules to profile rewrites and LinkedIn section rewrites. Keep that prompt behavior aligned with this document when either is changed.

## Purpose

Rewrite the user's submitted profile for the selected application. Return ready-to-copy profile content that fits the selected app's audience, field, voice, and character limit. Improve how the user's real information is expressed; do not invent or infer who the user is.

The output is the profile copy itself. Do not replace it with advice, an explanation of the user's characteristics, or a summary of what was changed. The API's structured `changeSummary` field may briefly describe edits, but it must not be added to the copy.

## Rules for every application

- Use only the original profile text and facts the user explicitly confirmed.
- Do not invent or infer skills, accomplishments, numbers, dates, employers, schools, credentials, interests, preferences, personality traits, or goals.
- Do not strengthen a claim or verb beyond what the source supports.
- Keep the user's meaning and recognizable voice. Do not turn a real person's profile into generic marketing copy.
- Prefer concise, information-rich wording. Remove filler and repetition.
- Use short phrases or fragments when they sound natural and the field allows them. Use complete sentences when needed for a clear, natural answer or paragraph; avoid long sentences that merely explain the person's qualities.
- Use bullets only when the field and its required format support them. Follow the app's format, existing bullet structure, and character limit exactly.
- Return only the requested profile field content in the rewrite field. Do not add labels, commentary, markdown fences, or a prefatory explanation.

## Match the selected application

### Professional: LinkedIn and Handshake

- Lead with the user's current work or studies, then the strongest relevant project, activity, or experience present in the source.
- Sound clear, credible, and professional, with a human conversational voice. State confirmed information directly without self-praise or inflated claims.
- Keep headlines brief and specific. Keep Handshake summaries to one or two short sentences.
- For LinkedIn About text, use a concrete opening and short, skimmable paragraphs. Use concise bullets for lists of projects, roles, or responsibilities when appropriate.
- For LinkedIn experience, education, project, or volunteering descriptions, preserve the selected paragraph or bullet format. Keep bullets compact, factual, and ordered by relevance.

### Social: Instagram and Facebook

- Make the bio understandable at a glance and keep the user's own casual voice.
- Prefer a few compact phrases, short lines, or one brief sentence over a full explanatory paragraph.
- Include only the user's stated interests and details. Do not add hashtags, links, handles, places, groups, or emoji that are not supported by the input.

### Personal and dating: Hinge and Tinder

- Keep wording warm, specific, and conversational without claiming what the user is like beyond their own stated information.
- For Hinge, answer each original prompt directly, in first person, as one short and natural thought. Keep each answer in its original slot and within its character limit. Do not make prompt answers into bullet lists or repeat the prompt.
- For Tinder, use a brief, conversational bio made of one or two compact thoughts. Avoid a long explanation or generic list of personality traits.
- Keep jokes and playful details only when the user's source supports them. Do not invent dating preferences, relationship goals, activities, places, food, pets, or plans.

## Preferred output shape

- Profile text: concise, app-native copy that the user can copy directly.
- LinkedIn experience/project lists: short factual bullets when the input or selected format uses bullets.
- Hinge prompt: one concise answer per prompt, not a commentary list.
- Social/dating bios: compact phrases or brief conversational lines, not a paragraph describing the user's characteristics.

## Final self-check

Before returning a rewrite, check that it:

1. Fits the selected application's field and character limit.
2. Uses only supported source information and confirmed facts.
3. Preserves the required content shape and answers each original prompt when applicable.
4. Sounds concise and natural in that application's context.
5. Contains no extra explanation, invented characteristic, or generic filler.
