import { traceSentences } from "./provenance";
import type { GuardWarning, IdentityFact, Segment } from "./schemas";
import { WARNING_LABEL } from "./persona-ui";

// "Prove it" export: a rewrite as plain text with a source for every sentence (from the same
// deterministic receipts the studio shows) and the FactCheck result. Built in the browser; it is
// the user's to copy or save, nothing is sent anywhere.

export function buildProofText(args: {
  platformLabel: string;
  /** e.g. "About" or "Bio". */
  section: string;
  text: string;
  segments: Segment[];
  facts: IdentityFact[];
  warnings: GuardWarning[];
}): string {
  const { platformLabel, section, text, segments, facts, warnings } = args;
  const receipts = traceSentences(text, segments, facts);
  const lines = [`${platformLabel}: ${section}`, "", text.trim(), "", "Sources"];
  if (!receipts.length) lines.push("(Too short to trace.)");
  receipts.forEach((r, i) => {
    lines.push(`${i + 1}. "${r.text}"`);
    if (r.status === "untraced" || !r.sources.length) {
      lines.push("   No source in your text or facts. Review before using.");
    } else {
      for (const s of r.sources) lines.push(`   ${s.kind === "segment" ? "Your profile" : "Your fact"}: "${s.text}"`);
      if (r.status === "weak") lines.push("   Only partly traced.");
    }
  });
  lines.push("", "FactCheck");
  if (!warnings.length) lines.push("No unsupported concrete claims detected.");
  else for (const w of warnings) lines.push(`- ${WARNING_LABEL[w.kind]}: ${w.text}`);
  lines.push(
    "",
    "Sources and FactCheck are deterministic checks in Personify (code, not AI) against your own words and the facts you added. A clean result means no unsupported concrete claims were detected; it can't catch every subtle exaggeration.",
  );
  return lines.join("\n");
}
