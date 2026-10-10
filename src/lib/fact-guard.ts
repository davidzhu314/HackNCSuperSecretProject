import { resolveSegmentIds } from "./segments";
import type { GuardWarning, IdentityFact, Rewrite, Segment } from "./schemas";

// FactCheck: deterministic, no model calls. It checks a rewrite against the user's
// original text and CONFIRMED facts only. Unconfirmed facts never count as support.
// Known limits: entity detection is a capitalization heuristic, and a clean result
// means "no unsupported concrete claims detected", not "true".

export type GuardInput = {
  rewrite: Pick<Rewrite, "content" | "usedFactIds">;
  segments: Segment[];
  facts: IdentityFact[];
};

// ---------- text helpers ----------

const WORD_RE = /[A-Za-z][A-Za-z0-9'’&+#]*(?:\.[A-Za-z0-9]+)*/g;

/** Very light stemmer so "contributed"/"contributor" and "plan"/"plans" match. Lenient on purpose. */
// Irregular past tenses, so "built" matches "builder"/"building" and "taught" matches "teaching".
const IRREGULAR: Record<string, string> = {
  built: "build", wrote: "write", written: "write", taught: "teach", led: "lead", ran: "run",
  made: "make", drove: "drive", oversaw: "oversee", began: "begin", grew: "grow", won: "win",
};

function stem(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, "");
  if (IRREGULAR[w]) return IRREGULAR[w];
  for (const suffix of ["ing", "ed", "er", "or", "es", "s"]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w;
}

function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

/**
 * Text that may support the rewrite: the user's original segments plus confirmed facts.
 * Hinge prompt questions count too: the user chose them, so echoing "Sunday" from
 * "A perfect Sunday" is not an invented claim.
 */
function buildCorpus(segments: Segment[], facts: IdentityFact[]): string {
  return [
    ...segments.flatMap((s) => (s.prompt ? [s.prompt, s.text] : [s.text])),
    ...facts.filter((f) => f.confirmed).map((f) => f.text),
  ].join("\n");
}

function dedupe(warnings: GuardWarning[]): GuardWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.kind}|${w.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------- 1. numbers, percentages, dates ----------

const WORD_NUMBERS: Record<string, number> = {
  zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, dozen: 12,
};
const MULTIPLIERS: Record<string, number> = {
  thousand: 1e3, million: 1e6, billion: 1e9,
};

export type NumberMention = { key: string; text: string };

/** Extract numbers as normalized keys ("95%", "2000000", "10x"). "95 percent" == "95%", "two hundred" == "200". */
export function extractNumbers(text: string): NumberMention[] {
  const out: NumberMention[] = [];

  const digitRe =
    /(?<![A-Za-z0-9.])\$?(\d[\d,]*(?:\.\d+)?)\s?(%|percent\b|[kKmMbB](?![A-Za-z])|x(?![A-Za-z]))?/g;
  for (const m of text.matchAll(digitRe)) {
    let value = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isNaN(value)) continue;
    const unit = (m[2] ?? "").toLowerCase();
    let suffix = "";
    if (unit === "k") value *= 1e3;
    else if (unit === "m") value *= 1e6;
    else if (unit === "b") value *= 1e9;
    else if (unit === "%" || unit === "percent") suffix = "%";
    else if (unit === "x") suffix = "x";
    out.push({ key: `${value}${suffix}`, text: m[0].trim() });
  }

  // Number words. A bare "one" is ignored ("one of the"); it only counts inside "one hundred" etc.
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  let i = 0;
  while (i < tokens.length) {
    const startsRun =
      tokens[i] in WORD_NUMBERS ||
      (tokens[i] === "one" && /^(hundred|thousand|million|billion)$/.test(tokens[i + 1] ?? ""));
    if (!startsRun) {
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    const start = i;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "one" || t in WORD_NUMBERS) current += t === "one" ? 1 : WORD_NUMBERS[t];
      else if (t === "hundred") current = (current || 1) * 100;
      else if (t in MULTIPLIERS) {
        total += (current || 1) * MULTIPLIERS[t];
        current = 0;
      } else break;
      i++;
    }
    const value = total + current;
    const isPercent = tokens[i] === "percent";
    out.push({
      key: `${value}${isPercent ? "%" : ""}`,
      text: tokens.slice(start, isPercent ? i + 1 : i).join(" "),
    });
  }
  return out;
}

function checkNumbers(content: string, corpus: string): GuardWarning[] {
  const supported = new Set(extractNumbers(corpus).map((n) => n.key));
  return extractNumbers(content)
    .filter((n) => !supported.has(n.key))
    .map((n) => ({
      kind: "unsupported_number" as const,
      text: n.text,
      explanation:
        "This number or date does not appear in your original text or confirmed facts.",
    }));
}

// ---------- 2. entities (heuristic) ----------

// Words that are capitalized only because of headline/title case or a section heading, not because
// they are names. Deliberately excludes job titles ("Developer", "Engineer"): those are claims.
const ENTITY_ALLOWLIST = new Set(
  [
    "I", "A", "An", "The", "And", "Or", "But", "Of", "In", "At", "On", "For", "With", "To", "By", "From", "As",
    "What", "Why", "How", "When", "Where", "Who", "My", "Our", "Your",
    "Student", "Students", "App", "Apps", "Project", "Projects", "Skills", "Experience", "Education",
    "About", "Summary", "Overview", "Highlights", "Interests", "Background", "Goals", "Tools", "Work",
  ].map((w) => w.toLowerCase()),
);

type Token = { text: string; start: number; end: number; atStart: boolean };

function tokenize(content: string): Token[] {
  const tokens: Token[] = [];
  let prevEnd = 0;
  for (const m of content.matchAll(WORD_RE)) {
    const start = m.index ?? 0;
    const gap = content.slice(prevEnd, start);
    tokens.push({
      text: m[0],
      start,
      end: start + m[0].length,
      atStart: tokens.length === 0 || /[.!?\n|•—–:;]/.test(gap),
    });
    prevEnd = start + m[0].length;
  }
  return tokens;
}

const isCapitalized = (w: string) => /^[A-Z]/.test(w);
const hasInnerCapsOrDigit = (w: string) => w.length > 1 && /[A-Z].*[A-Z]|\d/.test(w);

function checkEntities(content: string, corpus: string): GuardWarning[] {
  const known = new Set(words(corpus).map(stem));
  const tokens = tokenize(content);
  const warnings: GuardWarning[] = [];

  tokens.forEach((tok, i) => {
    if (!isCapitalized(tok.text)) return;
    const bare = tok.text.replace(/['’]s$/, "");
    if (ENTITY_ALLOWLIST.has(bare.toLowerCase()) || /^I['’]/.test(bare)) return;

    if (tok.atStart) {
      // A capital at sentence start proves nothing, so only check names that look like names.
      const next = tokens[i + 1];
      const startsPhrase =
        next !== undefined &&
        isCapitalized(next.text) &&
        !next.atStart &&
        /^\s+$/.test(content.slice(tok.end, next.start));
      if (!hasInnerCapsOrDigit(bare) && !startsPhrase) return;
    }

    if (!known.has(stem(bare))) {
      warnings.push({
        kind: "unsupported_entity",
        text: bare,
        explanation:
          "This name or term does not appear in your original text or confirmed facts. (Heuristic check, not full entity recognition.)",
      });
    }
  });
  return warnings;
}

// ---------- 3. inflated verbs ----------

type VerbEntry = { lemma: string; rank: 1 | 2 | 3; forms: string[] };

// rank 1 = participation, 2 = doing the work, 3 = ownership / leadership.
// Ambiguous noun-like forms (lead, own, head, direct, drive) are left out on purpose.
const VERBS: VerbEntry[] = [
  { lemma: "contribute", rank: 1, forms: ["contribute", "contributed", "contributing", "contributes"] },
  { lemma: "help", rank: 1, forms: ["helped", "helping", "helps"] },
  { lemma: "assist", rank: 1, forms: ["assist", "assisted", "assisting", "assists"] },
  { lemma: "support", rank: 1, forms: ["supported", "supporting"] },
  { lemma: "participate", rank: 1, forms: ["participate", "participated", "participating"] },
  { lemma: "join", rank: 1, forms: ["joined", "joining"] },
  { lemma: "build", rank: 2, forms: ["built", "building"] },
  { lemma: "develop", rank: 2, forms: ["developed", "developing"] },
  { lemma: "create", rank: 2, forms: ["created", "creating"] },
  { lemma: "write", rank: 2, forms: ["wrote", "written"] },
  { lemma: "design", rank: 2, forms: ["designed", "designing"] },
  { lemma: "implement", rank: 2, forms: ["implemented", "implementing"] },
  { lemma: "deliver", rank: 2, forms: ["delivered", "delivering"] },
  { lemma: "maintain", rank: 2, forms: ["maintained", "maintaining"] },
  { lemma: "teach", rank: 2, forms: ["taught", "teaching"] },
  { lemma: "lead", rank: 3, forms: ["led", "leading"] },
  { lemma: "manage", rank: 3, forms: ["manage", "managed", "managing"] },
  { lemma: "direct", rank: 3, forms: ["directed", "directing"] },
  { lemma: "own", rank: 3, forms: ["owned", "owning"] },
  { lemma: "head", rank: 3, forms: ["headed", "heading"] },
  { lemma: "oversee", rank: 3, forms: ["oversaw", "overseeing", "overseen"] },
  { lemma: "spearhead", rank: 3, forms: ["spearheaded", "spearheading"] },
  { lemma: "found", rank: 3, forms: ["founded", "founding", "cofounded"] },
  { lemma: "launch", rank: 3, forms: ["launched", "launching"] },
  { lemma: "architect", rank: 3, forms: ["architected", "architecting"] },
  { lemma: "pioneer", rank: 3, forms: ["pioneered", "pioneering"] },
  { lemma: "drive", rank: 3, forms: ["drove", "driving"] },
  { lemma: "establish", rank: 3, forms: ["established", "establishing"] },
  { lemma: "orchestrate", rank: 3, forms: ["orchestrated", "orchestrating"] },
];

const FORM_TO_VERB = new Map<string, VerbEntry>(
  VERBS.flatMap((v) => v.forms.map((f) => [f, v] as const)),
);

function verbsIn(text: string): Map<string, VerbEntry> {
  const found = new Map<string, VerbEntry>();
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const v = FORM_TO_VERB.get(w);
    if (v) found.set(v.lemma, v);
  }
  return found;
}

function checkVerbs(content: string, corpus: string): GuardWarning[] {
  const inCorpus = verbsIn(corpus);
  const corpusMax = Math.max(0, ...[...inCorpus.values()].map((v) => v.rank));
  const strongest = [...inCorpus.values()].find((v) => v.rank === corpusMax);
  const warnings: GuardWarning[] = [];

  for (const [lemma, verb] of verbsIn(content)) {
    if (inCorpus.has(lemma)) continue;
    const inflated = verb.rank === 3 || (verb.rank === 2 && corpusMax === 1);
    if (!inflated) continue;
    const shown = content.toLowerCase().match(new RegExp(`\\b(${verb.forms.join("|")})\\b`))?.[1] ?? lemma;
    warnings.push({
      kind: "inflated_verb",
      text: shown,
      explanation: strongest
        ? `Your original text and confirmed facts go no further than "${strongest.forms[0]}"; "${shown}" claims a stronger role.`
        : `"${shown}" claims ownership or leadership that your original text and confirmed facts don't state.`,
    });
  }
  return warnings;
}

// ---------- 4. fact ids and loose claims ----------

function checkFactIds(usedFactIds: string[], facts: IdentityFact[]): GuardWarning[] {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const warnings: GuardWarning[] = [];
  for (const id of new Set(usedFactIds)) {
    const fact = byId.get(id);
    if (!fact) {
      warnings.push({
        kind: "invalid_fact_id",
        text: id,
        explanation: "The model cited a fact ID that does not exist.",
      });
    } else if (!fact.confirmed) {
      warnings.push({
        kind: "invalid_fact_id",
        text: id,
        explanation: "The model cited a fact you have not confirmed. Unconfirmed facts can't support claims.",
      });
    }
  }
  return warnings;
}

const STOPWORDS = new Set(
  ("a an the and or but of in at on for with to by from as is are was were be been being i my me we our you your it its " +
    "this that these those who which what when where how into about over more most very also not no than then so such " +
    "can will just have has had do does did").split(" "),
);

/**
 * A valid fact ID proves nothing about entailment. Flag sentences that share almost no
 * content words with the original or confirmed facts so a human reviews them.
 */
function checkLooseClaims(content: string, corpus: string): GuardWarning[] {
  const known = new Set(words(corpus).map(stem));
  const warnings: GuardWarning[] = [];
  for (const sentence of content.split(/[.!?\n|•]+/)) {
    const content_ = words(sentence).filter((w) => !STOPWORDS.has(w.toLowerCase()) && w.length > 2);
    if (content_.length < 4) continue;
    const hits = content_.filter((w) => known.has(stem(w))).length;
    if (hits / content_.length < 0.5) {
      warnings.push({
        kind: "unsupported_claim",
        text: sentence.trim(),
        explanation:
          "Most of this sentence isn't traceable to your original text or confirmed facts. Review it before using it.",
      });
    }
  }
  return warnings;
}

// ---------- public API ----------

/** Run every check on a rewrite. An empty result means "no unsupported concrete claims detected". */
export function checkRewrite({ rewrite, segments, facts }: GuardInput): GuardWarning[] {
  const corpus = buildCorpus(segments, facts);
  return dedupe([
    ...checkNumbers(rewrite.content, corpus),
    ...checkEntities(rewrite.content, corpus),
    ...checkVerbs(rewrite.content, corpus),
    ...checkFactIds(rewrite.usedFactIds, facts),
    ...checkLooseClaims(rewrite.content, corpus),
  ]);
}

/** Flag cited segment ids that don't exist. Those must never be highlighted. */
export function checkSegmentCitations(ids: string[], segments: Segment[]): GuardWarning[] {
  return resolveSegmentIds(ids, segments).unknown.map((id) => ({
    kind: "unverified_segment" as const,
    text: id,
    explanation: "The model cited a source segment that does not exist, so it was not highlighted.",
  }));
}
