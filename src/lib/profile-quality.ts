export type QualityField = { key: string; label: string; text: string; limit?: number };

export type RepeatedPhrase = { phrase: string; fields: string[] };

/** Conservative exact phrase scan: flags repeated wording, not merely similar themes. */
export function findRepeatedPhrases(fields: QualityField[], minimumWords = 5): RepeatedPhrase[] {
  const phrases = new Map<string, Set<string>>();
  for (const field of fields) {
    const words = field.text.toLocaleLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
    const uniqueHere = new Set<string>();
    for (let size = minimumWords; size <= Math.min(8, words.length); size++) {
      for (let start = 0; start + size <= words.length; start++) {
        const phrase = words.slice(start, start + size).join(" ");
        if (uniqueHere.has(phrase)) continue;
        uniqueHere.add(phrase);
        const labels = phrases.get(phrase) ?? new Set<string>();
        labels.add(field.label);
        phrases.set(phrase, labels);
      }
    }
  }
  return [...phrases]
    .filter(([, labels]) => labels.size > 1)
    .sort(([a], [b]) => b.split(" ").length - a.split(" ").length || a.localeCompare(b))
    .filter(([phrase], _, all) => !all.some(([other]) => other.length > phrase.length && other.includes(phrase)))
    .map(([phrase, labels]) => ({ phrase, fields: [...labels] }));
}
