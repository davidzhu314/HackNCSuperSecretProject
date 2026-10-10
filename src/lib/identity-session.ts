import { useSyncExternalStore } from "react";
import type { HingePair } from "./persona-ui";
import type { IdentityFact, LinkedInProfile } from "./schemas";

// The Identity Hub's session: one pool of source material and confirmed facts shared by the
// hub and the studio on both platforms. Memory only (a module-level store), so it survives
// moving between pages but not a refresh. Nothing here is stored or sent anywhere; the studio
// still asks for consent before any of it reaches the AI.

export type IdentitySession = {
  /** A profile photo, as a local object URL. Shown on this device only; never uploaded. */
  photo: { name: string; url: string } | null;
  linkedin: LinkedInProfile | null;
  /** The LinkedIn profile before any "Use this version" rewrites; null when none are used. */
  linkedinOriginal: LinkedInProfile | null;
  /** Where the LinkedIn profile came from, if it was imported, with the parser's warnings. */
  linkedinImport: { fileName: string; warnings: string[] } | null;
  jobDescription: string;
  hinge: HingePair[] | null;
  /** Confirmed and user-typed facts carry across platforms; unconfirmed AI suggestions too, until replaced. */
  facts: IdentityFact[];
  /**
   * Bumped by edits made outside the studio (the hub's import, clearing the session). The studio
   * is keyed on it, so it starts over from the session instead of keeping a stale copy: Next keeps
   * pages you've left mounted but hidden (Cache Components preserves up to 3 routes).
   */
  rev: number;
};

const EMPTY_DATA: Omit<IdentitySession, "rev"> = {
  photo: null,
  linkedin: null,
  linkedinOriginal: null,
  linkedinImport: null,
  jobDescription: "",
  hinge: null,
  facts: [],
};
const EMPTY: IdentitySession = { ...EMPTY_DATA, rev: 0 };

let state: IdentitySession = EMPTY;
const listeners = new Set<() => void>();

export function getSession(): IdentitySession {
  return state;
}

/** `external`: the change came from outside the studio, so an open studio restarts from it. */
export function updateSession(patch: Partial<Omit<IdentitySession, "rev">>, { external = false } = {}) {
  if (patch.photo !== undefined && state.photo && patch.photo?.url !== state.photo.url) {
    URL.revokeObjectURL(state.photo.url);
  }
  state = { ...state, ...patch, rev: state.rev + (external ? 1 : 0) };
  listeners.forEach((l) => l());
}

export function clearSession() {
  updateSession({ ...EMPTY_DATA }, { external: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The session, re-rendering on change. The server always sees an empty session. */
export function useIdentitySession(): IdentitySession {
  return useSyncExternalStore(subscribe, getSession, () => EMPTY);
}

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Validates and stores a profile photo. Returns an error message, or null. */
export function setPhotoFile(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) {
    return "Choose a JPG, PNG, or WEBP photo under 10 MB.";
  }
  updateSession({ photo: { name: file.name, url: URL.createObjectURL(file) } });
  return null;
}
