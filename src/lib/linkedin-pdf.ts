import type { LinkedInProfile } from "./schemas";
import { emptyLinkedInProfile } from "./profile";

// LinkedIn "Save to PDF" import. Runs in the browser, so nothing leaves the device before consent.
// Contract only for now: the parser lands in a follow-up PR.

export type ParsedLinkedIn = { profile: LinkedInProfile; warnings: string[] };

/** Pure: text extracted from a LinkedIn PDF export -> sectioned profile. */
export function parseLinkedInText(text: string): ParsedLinkedIn {
  void text;
  return { profile: emptyLinkedInProfile(), warnings: ["PDF import isn't available yet. Enter your sections by hand."] };
}

/** Browser only: PDF file -> text -> parseLinkedInText. */
export async function parseLinkedInPdf(file: File): Promise<ParsedLinkedIn> {
  void file;
  throw new Error("PDF import isn't available yet. Enter your sections by hand.");
}
