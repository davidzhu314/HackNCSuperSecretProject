import { LIMITS, type Segment } from "./schemas";

// Input is split into numbered segments server-side. The model cites ids;
// quotes are resolved here, so highlighted text is guaranteed to exist.

function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function makeSegments(pieces: { text: string; prompt?: string }[]): Segment[] {
  return pieces.slice(0, LIMITS.maxSegments).map((p, i) => ({
    id: `s${i + 1}`,
    text: p.text.slice(0, LIMITS.segmentText),
    ...(p.prompt ? { prompt: p.prompt.slice(0, 200) } : {}),
  }));
}

/** LinkedIn: the headline is one segment; the About section is split into sentences. */
export function segmentLinkedIn(input: { headline: string; about: string }): Segment[] {
  const pieces = [
    ...(input.headline.trim() ? [{ text: input.headline.trim() }] : []),
    ...splitSentences(input.about).map((text) => ({ text })),
  ];
  return makeSegments(pieces);
}

/** Hinge: each answer is one segment and keeps its prompt question. */
export function segmentHinge(pairs: { prompt: string; answer: string }[]): Segment[] {
  return makeSegments(
    pairs
      .filter((p) => p.answer.trim())
      .map((p) => ({ text: p.answer.trim(), prompt: p.prompt.trim() })),
  );
}

/** Split cited ids into ones that exist (with their text) and unknown ones. Duplicates are dropped. */
export function resolveSegmentIds(ids: string[], segments: Segment[]) {
  const byId = new Map(segments.map((s) => [s.id, s]));
  const resolved: Segment[] = [];
  const unknown: string[] = [];
  for (const id of new Set(ids)) {
    const seg = byId.get(id);
    if (seg) resolved.push(seg);
    else unknown.push(id);
  }
  return { resolved, unknown };
}

/** Render segments for a model prompt: "[s1] text". */
export function formatSegmentsForPrompt(segments: Segment[]): string {
  return segments
    .map((s) => (s.prompt ? `[${s.id}] (${s.prompt}) ${s.text}` : `[${s.id}] ${s.text}`))
    .join("\n");
}
