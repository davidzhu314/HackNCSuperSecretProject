import type { GuardWarning } from "./schemas";

// Deterministic "AI cliche" lint for rewrites. Style only: it says nothing about truth
// (that's FactCheck's job), and a flagged word can still be legitimate in context
// (e.g. "optimized SQL queries"), so the UI shows these as suggestions.

/** Banned words, each with its inflected forms. */
const BANNED_WORDS: Record<string, string> = {
  delve: "delve|delves|delved|delving",
  unpack: "unpack|unpacks|unpacked|unpacking",
  elevate: "elevate|elevates|elevated|elevating",
  optimize: "optimi[sz]e|optimi[sz]es|optimi[sz]ed|optimi[sz]ing",
  leverage: "leverage|leverages|leveraged|leveraging",
  testament: "testament",
  beacon: "beacons?",
  tapestry: "tapestry|tapestries",
  multifaceted: "multi-?faceted",
  "game-changer": "game[- ]changers?|game[- ]changing",
  "paradigm shift": "paradigm shifts?",
  synergy: "synergy|synergies|synergistic",
  holistic: "holistic|holistically",
  harness: "harness|harnesses|harnessed|harnessing",
  foster: "foster|fosters|fostered|fostering",
  embark: "embark|embarks|embarked|embarking",
  realm: "realms?",
  landscape: "landscapes?",
  dynamic: "dynamic|dynamics|dynamically",
};

const BANNED_PHRASES: { phrase: string; re: RegExp }[] = [
  { phrase: "In today's fast-paced...", re: /\bin today'?s fast[- ]paced\b/i },
  { phrase: "In an era of...", re: /\bin an era of\b/i },
  { phrase: "Let's dive in", re: /\blet'?s dive in\b/i },
  { phrase: "Here's the takeaway", re: /\bhere'?s the takeaway\b/i },
  { phrase: "Here's the kicker", re: /\bhere'?s the kicker\b/i },
  { phrase: "It's not just about X, it's about Y", re: /\bit'?s not just about\b/i },
  { phrase: "What are your thoughts?", re: /\bwhat are your thoughts\b/i },
  { phrase: "Do you agree?", re: /\bdo you agree\?/i },
  { phrase: "How do you handle this...?", re: /\bhow do you handle this\b/i },
];

const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJI_G = /\p{Extended_Pictographic}/gu;

const issue = (text: string, explanation: string): GuardWarning => ({ kind: "ai_cliche", text, explanation });

export function checkStyle(content: string): GuardWarning[] {
  const text = content.replace(/[’‘]/g, "'");
  const out: GuardWarning[] = [];

  for (const [word, forms] of Object.entries(BANNED_WORDS)) {
    const m = text.match(new RegExp(`\\b(${forms})\\b`, "i"));
    if (m) out.push(issue(m[1], `"${word}" is an overused AI-style word. Plainer wording usually reads as more human.`));
  }

  for (const { phrase, re } of BANNED_PHRASES) {
    const m = text.match(re);
    if (m) out.push(issue(m[0], `"${phrase}" is a common AI-writing pattern.`));
  }

  if (text.split("\n").some((line) => EMOJI.test(line.trim().slice(0, 2)))) {
    out.push(issue("emoji bullet", "Emojis used as bullet points read as AI-generated. Use plain bullets."));
  }
  const emojiCount = (text.match(EMOJI_G) ?? []).length;
  if (emojiCount > 2) {
    out.push(issue(`${emojiCount} emojis`, "More than 1-2 emojis in total tends to read as AI-generated."));
  }
  return out;
}

/**
 * Platform length limit. `pieces` is the whole text for bio and headline platforms, or each
 * answer for prompt platforms (the limit applies per answer). Counts code points, so an emoji is 1.
 */
export function checkLength(pieces: string[], limit: number | undefined, platformLabel: string): GuardWarning[] {
  if (!limit) return [];
  return pieces
    .map((piece) => [...piece.trim()].length)
    .filter((length) => length > limit)
    .map((length) => ({
      kind: "over_limit" as const,
      text: `${length} / ${limit} characters`,
      explanation: `${platformLabel} allows ${limit} characters here. Trim it before you paste it in.`,
    }));
}

/** The ban list as prompt text, kept next to the checker so they can't drift apart. */
export const STYLE_BAN_PROMPT = [
  `Never use these words or their forms: ${Object.keys(BANNED_WORDS).join(", ")}.`,
  `Never use these phrases or patterns: ${BANNED_PHRASES.map((p) => `"${p.phrase}"`).join(", ")}.`,
  "Never use emojis as bullet points. Use at most one emoji in total, and preferably none.",
].join("\n");
